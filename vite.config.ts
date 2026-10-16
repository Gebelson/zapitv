import path from 'path';
import { fileURLToPath } from 'url';
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export default defineConfig(({ mode }) => {
    const env = loadEnv(mode, '.', '');
    return {
      server: {
        port: 3000,
        host: '0.0.0.0',
      },
      plugins: [react(), tailwindcss()],
      define: {
        'process.env.API_KEY': JSON.stringify(env.GEMINI_API_KEY),
        'process.env.GEMINI_API_KEY': JSON.stringify(env.GEMINI_API_KEY)
      },
      resolve: {
        alias: {
          '@': path.resolve(__dirname, '.'),
          'fs': path.resolve(__dirname, 'src/core/rankings/browserNodeShim.ts'),
          'path': path.resolve(__dirname, 'src/core/rankings/browserNodeShim.ts'),
        }
      },
      build: {
        target: 'es2020',
        cssCodeSplit: true,
        chunkSizeWarningLimit: 600,
        rollupOptions: {
          output: {
            manualChunks(id) {
              if (id.includes('constants.tsx') || id.includes('featuredCatalogItems') || id.includes('verifiedCatalog') || id.includes('imdbTop500Snapshot')) {
                return 'catalog-seed';
              }
              if (id.includes('node_modules')) {
                if (id.includes('hls.js')) return 'vendor-hls';
                if (id.includes('firestore')) return 'vendor-firestore';
                if (id.includes('firebase') || id.includes('@firebase')) return 'vendor-firebase';
                if (id.includes('trystero')) return 'vendor-trystero';
                if (id.includes('dexie')) return 'vendor-dexie';
                if (id.includes('lucide-react')) return 'vendor-icons';
                if (id.includes('react-dom') || id.includes('react-router') || id.includes('scheduler')) return 'vendor-react';
              }
            }
          }
        }
      }
    };
});
