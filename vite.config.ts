import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import { attachMaterialsApiMiddleware } from './src/server/materialsApiMiddleware'
import { attachDevLocalAuthMiddleware } from './src/server/devLocalAuthMiddleware'
import { fileURLToPath, URL } from 'node:url'

const buildVersion = `${process.env.npm_package_version ?? '0.0.0'}+${(process.env.GITHUB_SHA ?? 'local').slice(0, 7)}`;
const projectRoot = fileURLToPath(new URL('.', import.meta.url));

/**
 * Proxy /api em DEV:
 * - DEFAULT: sem proxy para Production (pimo.pro).
 * - Só com VITE_DEV_API_PROXY_TARGET explícito (ex.: staging URL).
 * - materials + auth/dev-local ficam sempre no middleware local.
 */
function resolveDevApiProxy(mode: string) {
  const env = loadEnv(mode, projectRoot, '');
  const target = (env.VITE_DEV_API_PROXY_TARGET || '').trim();
  if (!target) {
    console.info(
      '[vite] /api proxy DESLIGADO (default). ' +
        'Defina VITE_DEV_API_PROXY_TARGET para staging/local PHP explícito — nunca Production por omissão.'
    );
    return undefined;
  }
  if (/pimo\.pro/i.test(target) && env.VITE_ALLOW_DEV_PROXY_PRODUCTION !== 'true') {
    console.warn(
      '[vite] VITE_DEV_API_PROXY_TARGET aponta para pimo.pro — BLOQUEADO. ' +
        'Defina VITE_ALLOW_DEV_PROXY_PRODUCTION=true apenas se for intencional.'
    );
    return undefined;
  }
  console.info(`[vite] /api proxy → ${target}`);
  return {
    '/api': {
      target,
      changeOrigin: true,
      secure: true,
      bypass(req: { url?: string }) {
        const u = req.url ?? '';
        if (u.startsWith('/api/materials')) return u;
        if (u.startsWith('/api/auth/dev-local')) return u;
        return undefined;
      },
    },
  };
}

// https://vite.dev/config/
export default defineConfig(({ mode }) => ({
  base: '/',
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  plugins: [
    react(),
    {
      name: 'exclude-tests-from-bundle',
      enforce: 'pre',
      resolveId(id) {
        const clean = id.split('?')[0] ?? id;
        if (/\.(test|spec)\.[cm]?[jt]sx?$/.test(clean) || clean.includes('/__tests__/') || clean.includes('\\__tests__\\')) {
          return { id: clean, external: true };
        }
        return null;
      },
    },
    {
      name: 'materials-api-middleware',
      configureServer(server) {
        attachMaterialsApiMiddleware(server, projectRoot);
        attachDevLocalAuthMiddleware(server);
      },
      configurePreviewServer(server) {
        // Preview ≠ desenvolvimento local: sem K/K middleware.
        attachMaterialsApiMiddleware(server, projectRoot);
      },
    },
  ],
  assetsInclude: ['**/*.gltf'],
  server: {
    proxy: resolveDevApiProxy(mode),
  },
  define: {
    __PIMO_VERSION__: JSON.stringify(buildVersion),
  },
  build: {
    chunkSizeWarningLimit: 2000,
    rollupOptions: {
      onwarn(warning, warn) {
        const message = warning?.message ?? "";
        const isMixedImportWarning =
          message.includes("is dynamically imported by") &&
          message.includes("but also statically imported by");
        if (isMixedImportWarning) {
          return;
        }
        warn(warning);
      },
      output: {
        manualChunks: {
          three: ['three'],
          pdf: ['jspdf', 'jspdf-autotable'],
          viewer: ['three/examples/jsm/controls/OrbitControls'],
          core: ['react', 'react-dom']
        },
      },
    },
  },
}))
