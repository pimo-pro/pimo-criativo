/** URL do MES (pimo-pro-industrial) — produção via VITE_INDUSTRIAL_URL */
export const INDUSTRIAL_APP_URL =
  (import.meta.env.VITE_INDUSTRIAL_URL as string | undefined)?.replace(/\/$/, '') ??
  'http://localhost:5174';

export function industrialProjectsUrl(path = '/PROJETOS'): string {
  return `${INDUSTRIAL_APP_URL}${path.startsWith('/') ? path : `/${path}`}`;
}
