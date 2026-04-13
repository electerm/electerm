import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
// import htmlPurge from 'vite-plugin-purgecss'
import { cwd, version } from './common.js'
import { resolve } from 'path'
import def from './def.js'

function buildInput () {
  return {
    electerm: resolve(cwd, '../../src/client/entry/electerm.jsx'),
    basic: resolve(cwd, '../../src/client/entry/basic.js'),
    worker: resolve(cwd, '../../src/client/entry/worker.js')
  }
}

// Custom plugin to replace window.et.isWebApp with false
function replaceWebAppPlugin () {
  return {
    name: 'replace-webapp',
    renderChunk (code, chunk) {
      // Replace window.et.isWebApp with false in the bundled code
      const newCode = code.replace(/window\.et\.isWebApp/g, 'false')
      if (newCode !== code) {
        return {
          code: newCode,
          map: null
        }
      }
      return null
    }
  }
}

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [
    react({ include: /\.(mdx|js|jsx|ts|tsx|mjs)$/ }),
    replaceWebAppPlugin()
  ],
  resolve: {
    alias: {
      'ironrdp-wasm': resolve(cwd, '../../node_modules/ironrdp-wasm/pkg/rdp_client.js')
    }
  },
  optimizeDeps: {
    exclude: ['ironrdp-wasm']
  },
  define: def,
  publicDir: false,
  legacy: {
    inconsistentCjsInterop: true
  },
  root: resolve(cwd, '../..'),
  build: {
    target: 'esnext',
    cssCodeSplit: false,
    emptyOutDir: false,
    outDir: resolve(cwd, '../../work/app/assets'),
    rollupOptions: {
      input: buildInput(),
      output: {
        inlineDynamicImports: false,
        format: 'esm',
        entryFileNames: `js/[name]-${version}.js`,
        chunkFileNames: `chunk/[name]-${version}-[hash].js`,
        dir: resolve(cwd, '../../work/app/assets'),
        assetFileNames: chunkInfo => {
          const { name } = chunkInfo
          if (/\.(png|jpe?g|gif|svg|webp|ico|bmp)$/i.test(name)) {
            return `images/${name}`
          } else if (name && name.endsWith('.css')) {
            return `css/style-${version}[extname]`
          } else {
            return 'assets/[name]-[hash][extname]'
          }
        }
      }
    }
  }
})
