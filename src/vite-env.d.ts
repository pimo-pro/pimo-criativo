/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_INDUSTRIAL_URL?: string;
  readonly VITE_INDUSTRIAL_DASHBOARD_URL?: string;
  readonly VITE_INDUSTRIAL_API_URL?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}

declare const __PIMO_VERSION__: string;

declare module "*.md?raw" {
  const content: string;
  export default content;
}
