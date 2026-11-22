/**
 * Patch lib/install-src.js inside app.asar without repacking the archive.
 *
 * `asar extract` + `asar pack` rewrites the whole archive and drops every
 * `unpacked: true` flag, which breaks native modules such as node-pty and
 * serialport. Rewriting the file in place keeps the header, offsets and
 * unpacked metadata intact.
 *
 * The replacement must fit in the original file slot, so build scripts write
 * the first value through write_install_src() with padding to a fixed width.
 */
const fs = require('node:fs')
const asar = require('@electron/asar')

const [archivePath, newSrc] = process.argv.slice(2)
if (!archivePath || !newSrc) {
  console.error('Usage: node patch-asar-install-src.js <app.asar> <install-src>')
  process.exit(1)
}

const target = 'lib/install-src.js'
const info = asar.statFile(archivePath, target)
if (!info || typeof info.offset !== 'string' || info.unpacked) {
  console.error(`Cannot find packed file ${target} in ${archivePath}`)
  process.exit(1)
}

const size = Number(info.size)
const { headerSize } = asar.getRawHeader(archivePath)
// asar data starts after the 8-byte size pickle and the header pickle
const offset = 8 + headerSize + Number.parseInt(info.offset, 10)
const buffer = fs.readFileSync(archivePath)
const before = buffer.subarray(offset, offset + size).toString('utf8')
const next = `module.exports = '${newSrc}'`

if (Buffer.byteLength(next) > size) {
  console.error(
    `Cannot patch ${target}: original slot is ${size} bytes, new content needs ${Buffer.byteLength(next)} bytes`
  )
  process.exit(1)
}

buffer.write(next.padEnd(size, ' '), offset, 'utf8')
fs.writeFileSync(archivePath, buffer)

console.log(`Patched ${target}: ${before.trim()} -> ${newSrc}`)
