import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
// import htmlPurge from 'vite-plugin-purgecss'
import { cwd, version } from './common.js'
import { resolve } from 'path'
import def from './def.js'
import commonjs from 'vite-plugin-commonjs'
// import externalGlobals from 'rollup-plugin-external-globals'

function buildInput () {
  return {
    electerm: resolve(cwd, '../../src/client/entry/index.jsx'),
    basic: resolve(cwd, '../../src/client/entry/basic.js'),
    worker: resolve(cwd, '../../src/client/entry/worker.js')
  }
}

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [
    // htmlPurge(),
    commonjs(),
    // externalGlobals({
    //   react: 'React',
    //   'react-dom': 'ReactDOM'
    // }),
    react({ include: /\.(mdx|js|jsx|ts|tsx|mjs)$/ })
  ],
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
    emptyOutDir: false,
    outDir: resolve(cwd, '../../work/app/assets'),
    rollupOptions: {
      input: buildInput(),
      // external: [
      //   'react',
      //   'react-dom'
      // ],
      output: {
        manualChunks: {
          react: ['react-dom'],
          'lodash-es': ['lodash-es'],
          dayjs: ['dayjs'],
          antd1: [
            '@ant-design/colors',
            '@ant-design/react-slick',
            '@rc-component/color-picker',
            '@rc-component/mutate-observer',
            '@rc-component/tour',
            '@rc-component/trigger',
            'rc-cascader',
            'rc-checkbox',
            'rc-collapse',
            'rc-dialog',
            'rc-drawer',
            'rc-dropdown',
            'rc-field-form',
            'rc-image',
            'rc-input',
            'rc-input-number',
            'rc-mentions',
            'rc-menu',
            'rc-motion',
            'rc-notification',
            'rc-pagination',
            'rc-picker',
            'rc-progress',
            'rc-rate',
            'rc-resize-observer',
            'rc-segmented',
            'rc-select',
            'rc-slider',
            'rc-steps',
            'rc-switch',
            'rc-table',
            'rc-tabs',
            'rc-textarea',
            'rc-tooltip',
            'rc-tree',
            'rc-tree-select',
            'rc-upload',
            'rc-util',
            'scroll-into-view-if-needed',
            'throttle-debounce'
          ],
          antd: ['antd'],
          '@ant-design/icons': ['@ant-design/icons'],
          xterm: [
            'xterm'
          ],
          'xterm-addon1': [
            'xterm-addon-attach',
            'xterm-addon-canvas',
            'xterm-addon-fit',
            'xterm-addon-ligatures'
          ],
          'xterm-addon2': [
            'xterm-addon-search',
            'xterm-addon-unicode11',
            'xterm-addon-web-links',
            'xterm-addon-webgl'
          ],
          '@electerm/electerm-themes': ['@electerm/electerm-themes'],
          trzsz: ['trzsz'],
          manate: ['manate'],
          'zmodem.js': ['zmodem.js'],
          'vscode-icons-js': ['vscode-icons-js'],
          'react-utils': ['react', 'react-colorful', 'react-delta', 'memoize-one', 'prop-types']
        },
        inlineDynamicImports: false,
        format: 'esm',
        entryFileNames: `js/[name]-${version}.js`,
        chunkFileNames: `chunk/[name]-${version}-[hash].js`,
        assetFileNames: chunkInfo => {
          const { name } = chunkInfo
          return name.endsWith('.css')
            ? `css/${version}-${name}`
            : `images/${name}`
        },
        dir: resolve(cwd, '../../work/app/assets')
      }
    }
  },
  resolve: {
    alias: {
      events: 'eventemitter3'
    }
  }
})
