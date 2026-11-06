export type WaTemplate = { id: string; label: string; text: string };

/** Normalizează un număr românesc la format internațional fără „+" (ex. 40732512405). */
export function waNumber(raw?: string | null): string | null {
  if (!raw) return null;
  let d = raw.replace(/[^\d+]/g, "");
  if (d.startsWith("+")) d = d.slice(1);
  d = d.replace(/\D/g, "");
  if (d.startsWith("00")) d = d.slice(2);
  else if (d.startsWith("40")) { /* deja internațional */ }
  else if (d.startsWith("0")) d = "40" + d.slice(1);
  else if (d.length === 9 && d.startsWith("7")) d = "40" + d;
  return d.length >= 10 && d.length <= 15 ? d : null;
}

export function waLink(raw: string | null | undefined, text: string): string | null {
  const n = waNumber(raw);
  return n ? `https://wa.me/${n}?text=${encodeURIComponent(text)}` : null;
}

export function fill(t: string, vars: { nume?: string | null; magazin?: string | null }): string {
  const nume = (vars.nume ?? "").trim().split(/\s+/)[0] || "";
  return t
    .replaceAll("{salut}", nume ? `Bună, ${nume}!` : "Bună!")
    .replaceAll("{magazin}", vars.magazin?.trim() || "magazinul vostru");
}

export const LEAD_TEMPLATES: WaTemplate[] = [
  {
    id: "primul",
    label: "Primul contact (după email)",
    text: "{salut} Sunt de la Creative Rapide. Ți-am scris pe email despre reclame video pentru {magazin}. Facem creative video pentru magazine cu plata la livrare, 20 RON/creativ, livrate rapid. Vrei să-ți arăt câteva exemple?",
  },
  {
    id: "followup",
    label: "Follow-up",
    text: "{salut} Revin cu un mesaj scurt: ai apucat să te uiți la ce ți-am trimis pentru {magazin}? Pot să-ți pregătesc un exemplu pe unul din produsele voastre.",
  },
  {
    id: "oferta",
    label: "Ofertă / prețuri",
    text: "{salut} Avem trei variante: Standard 20 RON/creativ, Plus 30 RON (livrare prioritară, 2 formate TikTok/Meta, 2 revizii) și Performanță 35 RON (Plus, plus 3 hook-uri la aceeași reclamă). De la 50 de creative Standard prețul scade la 19 RON. În plus, până pe 30 noiembrie, la prima comandă de minim 6 reclame, 2 dintre ele sunt doar 10 RON. Care variantă te interesează și câte creative vrei să începem?",
  },
  {
    id: "brief",
    label: "Cerere brief",
    text: "{salut} Ca să începem pentru {magazin}, am nevoie de: linkul produsului, ce îl face special, publicul țintă și, dacă ai, materiale (poze/video). Le poți trimite aici.",
  },
];

export const CLIENT_TEMPLATES: WaTemplate[] = [
  {
    id: "livrare",
    label: "Creative livrate",
    text: "{salut} Creativele pentru {magazin} sunt gata. Te rog să te uiți și să-mi spui dacă vrei ajustări; le facem rapid.",
  },
  {
    id: "recenzie",
    label: "Cerere recenzie",
    text: "{salut} Mulțumim că ai lucrat cu noi. Dacă ești mulțumit de creative, ne-ar ajuta mult o recenzie scurtă, iar dacă ai ceva de îmbunătățit, spune-ne direct.",
  },
  {
    id: "reactivare",
    label: "Reactivare / comandă nouă",
    text: "{salut} Cum merg reclamele pentru {magazin}? Dacă vrei creative noi, le pregătim rapid. Avem acum și variantele Plus (30 RON) și Performanță (35 RON, cu 3 hook-uri la aceeași reclamă) pentru mai mult testing.",
  },
  {
    id: "recomandare",
    label: "Cerere recomandare",
    text: "{salut} Dacă știi un alt magazin cu plata la livrare care ar avea nevoie de reclame video, ne poți face cunoștință? Îți mulțumim cu un bonus la următoarea comandă.",
  },
];
