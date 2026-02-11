import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
// import htmlPurge from 'vite-plugin-purgecss'
import { cwd, version } from './common.js'
import { resolve } from 'path'
import def from './def.js'
// import commonjs from 'vite-plugin-commonjs'

const nodeVersion = parseInt(process.version.split('.')[0].slice(1))
const isNode16 = nodeVersion === 16

const manualChunks = (id) => {
  if (id.includes('node_modules')) {
    if (id.match(/node_modules\/(react|react-dom|scheduler)\//) ||
      id.includes('object-assign') ||
      id.includes('loose-envify')) {
      return 'react-vendor'
    }
    if (
      id.includes('react-delta-hooks') ||
      id.includes('react-markdown')
    ) {
      return 'react-utils'
    }
    if (id.includes('lodash-es')) {
      return 'lodash-es'
    }
    if (id.includes('dayjs')) {
      return 'dayjs'
    }
    if (id.includes('@ant-design/icons')) {
      return 'ant-icons'
    }
    if (id.includes('@ant-design') || id.includes('@rc-component') || id.includes('classnames') || id.includes('@ctrl/tinycolor')) {
      return 'antd-deps'
    }
    if (id.includes('antd')) {
      return 'antd'
    }
    if (id.includes('@xterm/addon-attach')) {
      return 'xterm-addon-attach'
    }
    if (id.includes('@xterm/addon-fit')) {
      return 'xterm-addon-fit'
    }
    if (id.includes('@xterm/addon-search')) {
      return 'xterm-addon-search'
    }
    if (id.includes('@xterm/addon-web-links')) {
      return 'xterm-addon-web-links'
    }
    if (id.includes('@xterm/addon-canvas')) {
      return 'xterm-addon-canvas'
    }
    if (id.includes('@xterm/addon-ligatures')) {
      return 'xterm-addon-ligatures'
    }
    if (id.includes('@xterm/addon-unicode11')) {
      return 'xterm-addon-unicode11'
    }
    if (id.includes('@xterm/addon-webgl')) {
      return 'xterm-addon-webgl'
    }
    if (id.includes('@xterm')) {
      return 'xterm'
    }
    if (id.includes('trzsz')) {
      return 'trzsz'
    }
    if (id.includes('manate')) {
      return 'manate'
    }
    if (id.includes('zmodem-ts')) {
      return 'zmodem-ts'
    }
    if (id.includes('electerm-icons')) {
      return 'electerm-icons'
    }
    if (id.includes('@novnc/novnc')) {
      return 'novnc'
    }
    if (id.includes('ironrdp-wasm')) {
      return 'ironrdp-wasm'
    }
    // Combine rest of node_modules into one chunk
    return 'vendor'
  }
}

// Custom plugin to combine CSS with separate basic.css
function combineCSSPlugin () {
  return {
    name: 'combine-css',
    generateBundle (options, bundle) {
      let mainCSS = ''
      let basicCSS = ''

      for (const fileName in bundle) {
        if (fileName.endsWith('.css')) {
          // Get the CSS source
          const cssSource = bundle[fileName].source
          // Check if this CSS is from basic.js's imports
          // We can check the source for imports from mobile.styl or basic.styl
          if (fileName.includes('basic.css')) {
            basicCSS += cssSource
          } else {
            mainCSS += cssSource
          }

          // Remove the original CSS chunk
          delete bundle[fileName]
        }
      }

      // Emit main CSS bundle
      if (mainCSS) {
        this.emitFile({
          type: 'asset',
          fileName: `css/${version}-electerm.css`,
          source: mainCSS
        })
      }

      // Emit basic CSS bundle
      if (basicCSS) {
        this.emitFile({
          type: 'asset',
          fileName: `css/${version}-basic.css`,
          source: basicCSS
        })
      }
    }
  }
}

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
    // wasm(),
    // topLevelAwait(),
    // htmlPurge(),
    // commonjs(),
    // externalGlobals({
    //   react: 'React',
    //   'react-dom': 'ReactDOM'
    // }),
    react({ include: /\.(mdx|js|jsx|ts|tsx|mjs)$/ }),
    combineCSSPlugin(),
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
  // optimizeDeps: {
  //   esbuildOptions: {
  //     loader: {
  //       '.js': 'jsx'
  //     }
  //   }
  // },
  define: def,
  publicDir: false,
  css: {
    codeSplit: false
  },
  root: resolve(cwd, '../..'),
  build: {
    target: 'esnext',
    emptyOutDir: false,
    outDir: resolve(cwd, '../../work/app/assets'),
    rollupOptions: {
      input: buildInput(),
      // external: [
      //   'react',
      //   'react-dom'
      // ],
      output: {
        ...(isNode16 ? {} : { manualChunks }),
        inlineDynamicImports: false,
        format: 'esm',
        entryFileNames: `js/[name]-${version}.js`,
        chunkFileNames: `chunk/[name]-${version}-[hash].js`,
        assetFileNames: chunkInfo => {
          const { name } = chunkInfo
          return name.endsWith('.css')
            ? `css/_temp_${name}`
            : `images/${name}`
        },
        dir: resolve(cwd, '../../work/app/assets')
      }
    }
  }
})
