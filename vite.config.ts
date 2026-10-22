import path from 'path';
import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'url';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export default defineConfig(() => {
    let outputDir = path.resolve(__dirname, 'dist');
    return {
      server: {
        port: 3000,
        host: '0.0.0.0',
      },
      plugins: [react(), tailwindcss(), {
        name: 'offline-shell-assets',
        configResolved(config) {
          outputDir = path.resolve(config.root, config.build.outDir);
        },
        generateBundle(_options, bundle) {
          const assets = Object.keys(bundle)
            .filter(file => /\.(?:js|css)$/.test(file))
            .map(file => `/${file}`);
          this.emitFile({ type: 'asset', fileName: 'offline-assets.json', source: JSON.stringify(assets) });
        },
        closeBundle() {
          const shell = readFileSync(path.join(outputDir, 'index.html'));
          const assets = readFileSync(path.join(outputDir, 'offline-assets.json'));
          const swPath = path.join(outputDir, 'sw.js');
          const version = createHash('sha256').update(shell).update(assets).digest('hex').slice(0, 12);
          writeFileSync(swPath, readFileSync(swPath, 'utf8').replace('__BUILD_VERSION__', version));
        }
      }],
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
