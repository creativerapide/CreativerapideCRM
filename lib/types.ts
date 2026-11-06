/* eslint-disable @typescript-eslint/no-explicit-any */
export type Row = Record<string, any>;

export function one<T = Row>(v: T | T[] | null | undefined): T | null {
  if (!v) return null;
  return Array.isArray(v) ? (v[0] ?? null) : v;
}

export type SP = Promise<{ ok?: string; eroare?: string; q?: string; pagina?: string; status?: string; [k: string]: string | undefined }>;
