export type Opt = Record<string, string>;

export const TARGET_LUNAR_RON = 20000;
export const ZILE_FARA_COMANDA_RISC = 21;
export const PAGE_SIZE = 25;

export const LEAD_STAGES: Opt = {
  raspuns_email: "Au răspuns pe email",
  contactat_whatsapp: "Contactați pe WhatsApp",
  test_trimis: "Test trimis",
  client: "Client",
  pierdut: "Pierdut",
};

export const CLIENT_STATUS: Opt = {
  lead: "Lead",
  calificat: "Calificat",
  test: "Test",
  activ: "Activ",
  in_pauza: "În pauză",
  inactiv: "Inactiv",
  pierdut: "Pierdut",
};

export const SATISFACTION: Opt = {
  necunoscuta: "Necunoscută",
  multumit: "Mulțumit",
  neutru: "Neutru",
  nemultumit: "Nemulțumit",
};

export const RISK: Opt = { scazut: "Scăzut", mediu: "Mediu", ridicat: "Ridicat" };

export const ORDER_STATUS: Opt = {
  noua: "Nouă",
  brief_incomplet: "Brief incomplet",
  aprobata: "Aprobată",
  in_lucru: "În lucru",
  verificare_qc: "Verificare QC",
  revizii: "Revizii",
  livrata: "Livrată",
  anulata: "Anulată",
};

export const CREATIVE_STATUS: Opt = {
  de_facut: "De făcut",
  in_lucru: "În lucru",
  verificare_qc: "Verificare QC",
  revizii: "Revizii",
  livrata: "Livrată",
  anulata: "Anulată",
};

export const FINANCIAL: Opt = {
  neemisa: "Neemisă",
  facturata: "Facturată",
  partial_incasata: "Parțial încasată",
  incasata: "Încasată",
};

export const CHANNELS: Opt = {
  email: "Email",
  whatsapp: "WhatsApp",
  apel: "Apel",
  intalnire: "Întâlnire",
  altul: "Altul",
};

export const PRIORITY: Opt = {
  scazuta: "Scăzută",
  normala: "Normală",
  ridicata: "Ridicată",
  urgenta: "Urgentă",
};

export const TASK_STATUS: Opt = {
  de_facut: "De făcut",
  in_lucru: "În lucru",
  facut: "Făcut",
  anulat: "Anulat",
};

export const ROLES: Opt = {
  admin: "Admin",
  account_manager: "Account manager",
  editor: "Editor",
  viewer: "Vizualizare",
};

export const SOURCES: Opt = {
  email: "Email outreach",
  ad_library: "Ad Library",
  instagram: "Instagram",
  recomandare: "Recomandare",
  altul: "Altul",
};

export const PACKAGES: Opt = {
  standard: "Standard (20 RON / reclamă)",
  plus: "Plus (30 RON / reclamă)",
  performanta: "Performanță (35 RON / reclamă)",
  volum50: "50+ reclame Standard (19 RON / reclamă)",
  start_bf: "Ofertă de start (prima comandă 6+ reclame: 2 la 10 RON, restul 20 RON; până pe 30.11)",
  volum100: "Pachet personalizat (preț negociat)",
  test: "Test gratuit",
  altul: "Altul",
};

/** Preț automat pe reclamă, în RON. null = se negociază sau se introduce manual. */
export function autoUnitPrice(pkg: string | null | undefined, count: number): number | null {
  switch (pkg) {
    case "standard":
    case "volum50":
      return count >= 50 ? 19 : 20;
    case "plus":
      return 30;
    case "performanta":
      return 35;
    default:
      return null;
  }
}

/**
 * Totalul automat al comenzii, în RON. null = se negociază sau se introduce manual.
 * Oferta de start (prima comandă, minim 6 reclame): 2 reclame la 10 RON, restul la 20 RON.
 * Sub 6 reclame se aplică prețul Standard (20 RON / reclamă).
 */
export function autoOrderTotal(pkg: string | null | undefined, count: number): number | null {
  if (pkg === "start_bf") return count >= 6 ? 2 * 10 + (count - 2) * 20 : count * 20;
  const unit = autoUnitPrice(pkg, count);
  return unit === null ? null : count * unit;
}
