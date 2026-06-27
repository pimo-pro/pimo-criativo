import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import { buildMaterialsApiPayload } from './src/server/materialsApi'
import { fileURLToPath, URL } from 'node:url'

const buildVersion = `${process.env.npm_package_version ?? '0.0.0'}+${(process.env.GITHUB_SHA ?? 'local').slice(0, 7)}`;

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  const industrialApiUrl =
    env.VITE_INDUSTRIAL_API_URL || 'https://pimo-pro-industrial-api.onrender.com'

  return {
    base: '/',
    resolve: {
      alias: {
        '@': fileURLToPath(new URL('./src', import.meta.url)),
      },
    },
    plugins: [
      react(),
      {
        name: 'materials-api-middleware',
        configureServer(server) {
          server.middlewares.use('/api/materials', (req, res) => {
            if (req.method === 'OPTIONS') {
              res.statusCode = 200;
              res.setHeader('Access-Control-Allow-Origin', '*');
              res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS');
              res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
              res.end(JSON.stringify({ ok: true }));
              return;
            }
            if (req.method !== 'GET') {
              res.statusCode = 405;
              res.setHeader('Content-Type', 'application/json; charset=utf-8');
              res.end(JSON.stringify({ ok: false, error: 'Method not allowed' }));
              return;
            }
            res.statusCode = 200;
            res.setHeader('Access-Control-Allow-Origin', '*');
            res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS');
            res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
            res.setHeader('Content-Type', 'application/json; charset=utf-8');
            res.end(JSON.stringify(buildMaterialsApiPayload()));
          });
        },
        configurePreviewServer(server) {
          server.middlewares.use('/api/materials', (req, res) => {
            if (req.method === 'OPTIONS') {
              res.statusCode = 200;
              res.setHeader('Access-Control-Allow-Origin', '*');
              res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS');
              res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
              res.end(JSON.stringify({ ok: true }));
              return;
            }
            if (req.method !== 'GET') {
              res.statusCode = 405;
              res.setHeader('Content-Type', 'application/json; charset=utf-8');
              res.end(JSON.stringify({ ok: false, error: 'Method not allowed' }));
              return;
            }
            res.statusCode = 200;
            res.setHeader('Access-Control-Allow-Origin', '*');
            res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS');
            res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
            res.setHeader('Content-Type', 'application/json; charset=utf-8');
            res.end(JSON.stringify(buildMaterialsApiPayload()));
          });
        },
      },
    ],
    server: {
      proxy: {
        '/api': {
          target: industrialApiUrl,
          changeOrigin: true,
          secure: false,
        },
      },
    },
    preview: {
      proxy: {
        '/api': {
          target: industrialApiUrl,
          changeOrigin: true,
          secure: false,
        },
      },
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
  }
})
