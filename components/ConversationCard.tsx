import { Card, Empty } from "@/components/ui";
import { fmtDateTime } from "@/lib/format";
import type { Row } from "@/lib/types";

export function ConversationCard({ messages }: { messages: Row[] }) {
  // cele mai noi primele din interogare; afișăm cronologic, ultimele 60
  const list = [...messages].slice(0, 60).reverse();
  return (
    <Card title="Conversație WhatsApp">
      {list.length === 0 ? (
        <Empty text="Încă nu există mesaje salvate. Apar automat după conectarea numărului la CRM." />
      ) : (
        <ul className="max-h-[28rem] space-y-2 overflow-y-auto pr-1">
          {list.map((m) => (
            <li key={m.id} className={`flex ${m.direction === "out" ? "justify-end" : "justify-start"}`}>
              <div className={`max-w-[85%] rounded-lg px-3 py-2 text-sm ${m.direction === "out" ? "bg-emerald-50 text-slate-800" : "bg-slate-100 text-slate-800"}`}>
                <p className="whitespace-pre-wrap break-words">{m.body || `[${m.msg_type}]`}</p>
                <p className="mt-1 text-[10px] text-slate-500">{m.direction === "out" ? "Noi" : m.wa_name || "Client"} · {fmtDateTime(m.occurred_at)}</p>
              </div>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}
