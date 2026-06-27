/** URL do dashboard MES (SPA industrial) */
export const INDUSTRIAL_DASHBOARD_URL =
  (
    (import.meta.env.VITE_INDUSTRIAL_DASHBOARD_URL as string | undefined) ??
    (import.meta.env.VITE_INDUSTRIAL_URL as string | undefined)
  )?.replace(/\/$/, '') ?? 'http://localhost:5174';

/** @deprecated Use INDUSTRIAL_DASHBOARD_URL */
export const INDUSTRIAL_APP_URL = INDUSTRIAL_DASHBOARD_URL;

/** API central industrial (Render) — piece, session, factory floor, WebSocket, SGPI */
export const INDUSTRIAL_API_URL =
  (
    (import.meta.env.VITE_INDUSTRIAL_API_URL as string | undefined) ??
    'https://pimo-pro-industrial-api.onrender.com'
  ).replace(/\/$/, '');

/** Base REST central: URL absoluta Render ou relativa `/api` em dev */
export function industrialCentralApiBase(): string {
  return INDUSTRIAL_API_URL ? `${INDUSTRIAL_API_URL}/api` : '/api';
}

/**
 * SGPI / MES — em produção usa API Render directamente (CORS pimo.pro).
 * Em dev usa middleware Vite `/api/industrial`.
 */
export function industrialMesApiBase(): string {
  if (import.meta.env.DEV) {
    return '/api/industrial';
  }
  return `${INDUSTRIAL_API_URL}/api/industrial`;
}

export function industrialProjectsUrl(path = '/PROJETOS'): string {
  return `${INDUSTRIAL_DASHBOARD_URL}${path.startsWith('/') ? path : `/${path}`}`;
}

export function industrialCentralApiUrl(path: string): string {
  const base = industrialCentralApiBase();
  return `${base}${path.startsWith('/') ? path : `/${path}`}`;
}

export function industrialMesApiUrl(path: string): string {
  const base = industrialMesApiBase().replace(/\/$/, '');
  return `${base}${path.startsWith('/') ? path : `/${path}`}`;
}
