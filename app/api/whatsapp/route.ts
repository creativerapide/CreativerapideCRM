import { createHmac, timingSafeEqual } from "node:crypto";
import { NextResponse, type NextRequest } from "next/server";

export const dynamic = "force-dynamic";

type Msg = { wa_id: string; phone: string; direction: "in" | "out"; body: string; type: string; name?: string; ts?: string };

/* eslint-disable @typescript-eslint/no-explicit-any */
function bodyOf(m: any): string {
  const t = m?.type ?? "text";
  if (t === "text") return m?.text?.body ?? "";
  const cap = m?.[t]?.caption;
  return cap ? `[${t}] ${cap}` : `[${t}]`;
}

function extract(payload: any): Msg[] {
  const out: Msg[] = [];
  for (const entry of payload?.entry ?? []) {
    for (const ch of entry?.changes ?? []) {
      const v = ch?.value ?? {};
      const names: Record<string, string> = {};
      for (const c of v.contacts ?? []) if (c?.wa_id) names[c.wa_id] = c?.profile?.name ?? "";

      // mesaje primite de la clienți
      for (const m of v.messages ?? []) {
        if (!m?.from || !m?.id) continue;
        out.push({ wa_id: m.id, phone: m.from, direction: "in", body: bodyOf(m), type: m.type ?? "text", name: names[m.from], ts: String(m.timestamp ?? "") });
      }
      // mesaje trimise din aplicația WhatsApp Business (coexistence)
      for (const m of v.message_echoes ?? []) {
        if (!m?.to || !m?.id) continue;
        out.push({ wa_id: m.id, phone: m.to, direction: "out", body: bodyOf(m), type: m.type ?? "text", ts: String(m.timestamp ?? "") });
      }
      // istoricul sincronizat la conectare
      for (const h of v.history ?? []) {
        for (const th of h?.threads ?? []) {
          const customer = String(th?.id ?? "");
          for (const m of th?.messages ?? []) {
            if (!customer || !m?.id) continue;
            out.push({ wa_id: m.id, phone: customer, direction: String(m.from) === customer ? "in" : "out", body: bodyOf(m), type: m.type ?? "text", ts: String(m.timestamp ?? "") });
          }
        }
      }
    }
  }
  return out;
}

export async function GET(req: NextRequest) {
  const p = req.nextUrl.searchParams;
  const expected = process.env.WA_VERIFY_TOKEN;
  if (expected && p.get("hub.mode") === "subscribe" && p.get("hub.verify_token") === expected) {
    return new NextResponse(p.get("hub.challenge") ?? "", { status: 200 });
  }
  return new NextResponse("forbidden", { status: 403 });
}

export async function POST(req: NextRequest) {
  const secret = process.env.WA_APP_SECRET;
  const token = process.env.WA_INGEST_TOKEN;
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if (!secret || !token || !url || !key) return new NextResponse("not configured", { status: 503 });

  const raw = await req.text();
  const sig = req.headers.get("x-hub-signature-256") ?? "";
  const expected = "sha256=" + createHmac("sha256", secret).update(raw).digest("hex");
  const a = Buffer.from(sig);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return new NextResponse("bad signature", { status: 401 });

  let payload: unknown;
  try {
    payload = JSON.parse(raw);
  } catch {
    return new NextResponse("bad json", { status: 400 });
  }
  const msgs = extract(payload);
  if (msgs.length === 0) return NextResponse.json({ ok: true, salvate: 0 });

  const res = await fetch(`${url}/rest/v1/rpc/wa_ingest`, {
    method: "POST",
    headers: { "content-type": "application/json", apikey: key, authorization: `Bearer ${key}` },
    body: JSON.stringify({ p_token: token, p_msgs: msgs }),
  });
  if (!res.ok) return new NextResponse("ingest failed", { status: 500 });
  return NextResponse.json({ ok: true, ...(await res.json()) });
}
