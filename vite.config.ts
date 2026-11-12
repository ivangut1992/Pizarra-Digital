import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import fs from 'fs';
import zlib from 'zlib';
import { fileURLToPath } from 'url';
import { defineConfig, Plugin } from 'vite';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

function brotliCompressionPlugin(): Plugin {
  return {
    name: 'brotli-compression-plugin',
    apply: 'build',
    closeBundle() {
      const distDir = path.resolve(__dirname, 'dist');
      if (!fs.existsSync(distDir)) return;

      const compressDir = (dir: string) => {
        const files = fs.readdirSync(dir);
        for (const file of files) {
          const filePath = path.join(dir, file);
          const stat = fs.statSync(filePath);
          if (stat.isDirectory()) {
            compressDir(filePath);
          } else if (/\.(html|js|css|json|svg)$/i.test(file) && !file.endsWith('.br')) {
            try {
              const content = fs.readFileSync(filePath);
              const compressed = zlib.brotliCompressSync(content, {
                params: {
                  [zlib.constants.BROTLI_PARAM_MODE]: zlib.constants.BROTLI_MODE_TEXT,
                  [zlib.constants.BROTLI_PARAM_QUALITY]: 11, // Maximum quality for static pre-compressed files
                },
              });
              fs.writeFileSync(`${filePath}.br`, compressed);
            } catch (err) {
              console.warn(`Error al comprimir con Brotli ${file}:`, err);
            }
          }
        }
      };

      compressDir(distDir);
    },
  };
}

export default defineConfig(() => {
  return {
    plugins: [react(), tailwindcss(), brotliCompressionPlugin()],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
    },
    server: {
      // HMR is disabled in AI Studio via DISABLE_HMR env var.
      // Do not modify—file watching is disabled to prevent flickering during agent edits.
      hmr: process.env.DISABLE_HMR !== 'true',
      // Disable file watching when DISABLE_HMR is true to save CPU during agent edits.
      watch: process.env.DISABLE_HMR === 'true' ? null : {},
    },
  };
});
