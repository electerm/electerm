/**
 * copy static assets into the built app
 *
 * `work/app/assets` is the web root the packaged app serves (src/app/lib/file-server.js),
 * and the file-manager icons are fetched from `icons/` (src/app/common/runtime-constants.js),
 * so this copy is what makes them exist at runtime.
 *
 * The destination is removed first on purpose: shelljs `cp -r` copies *into* an existing
 * directory, so a second `npm run compile` without a `npm run clean` would create
 * `assets/icons/icons` and then fail. Removing it also drops icons deleted upstream.
 */
const { resolve } = require('path')
const { cp, rm } = require('shelljs')

const from = resolve(
  __dirname,
  '../../../node_modules/electerm-icons/icons'
)
const to = resolve(
  __dirname,
  '../../../work/app/assets/icons'
)

rm('-rf', to)
cp('-r', from, to)
