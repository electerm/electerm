import { build } from 'esbuild'
import { readFileSync } from 'fs'
import { createRequire } from 'module'
import { fileURLToPath } from 'url'

const require = createRequire(import.meta.url)
const entry = fileURLToPath(new URL('../../client/components/terminal/x11/frame.cjs', import.meta.url))

// Build the opaque-origin iframe as a self-contained document. It gets a
// MessagePort for each X client, with no access to the terminal or its token.
export default function x11Frame () {
  const id = 'virtual:electerm-x11-frame'
  return {
    name: 'electerm-x11-frame',
    resolveId (source) {
      if (source === id) return '\0' + id
    },
    async load (source) {
      if (source !== '\0' + id) return
      this.addWatchFile(entry)
      const licenses = ['x11', 'buffer', 'events', 'base64-js', 'ieee754']
        .map(pkg => readFileSync(require.resolve(pkg + '/LICENSE'), 'utf8'))
      const result = await build({
        banner: { js: '/*!\n' + licenses.join('\n') + '\n*/' },
        entryPoints: [entry],
        bundle: true,
        write: false,
        minify: true,
        target: 'es2020',
        alias: { events: require.resolve('events/'), buffer: require.resolve('buffer/') },
        external: ['net', 'fs'] // only used for native sockets and file descriptors
      })
      const script = result.outputFiles[0].text.replace(/<\/script/gi, '<\\/script')
      const html = `<!doctype html><meta charset="utf-8">
<meta http-equiv="Content-Security-Policy" content="default-src 'none'; script-src 'unsafe-inline'; style-src 'unsafe-inline'">
<style>*{box-sizing:border-box}html,body{margin:0;height:100%;background:black}canvas{display:block;width:100%;height:100%}</style>
<canvas aria-label="X11 display"></canvas><script>${script}</script>`
      return 'export default ' + JSON.stringify(html)
    }
  }
}
