/**
 * Install a widget from the widgets.electerm.org registry.
 *
 * A registry record pins ONE commit of ONE repository and lists every file in
 * the widget folder with its size and sha256 (see scripts/lib/registry.mjs in
 * ~/dev/electerm-widgets — computeDigest here must stay byte-for-byte the same
 * as the build script's). The site only indexes metadata; the bytes still come
 * from GitHub/AtomGit through widget-source.js, including its mirror and CDN
 * fallbacks, so the tree is verified against the record BEFORE it is copied
 * into the widgets folder. A moved branch, a compromised mirror, an extra file
 * or a changed dependency all fail the install instead of being installed.
 *
 * Note this does not make a widget safe: main.js still runs in the main process
 * with full Node privileges (see the wiki's security model). What it gives is a
 * verifiable, pinned origin and an explicit install decision in the UI.
 */

const crypto = require('crypto')
const fs = require('fs')
const path = require('path')
const { isValidWidgetId } = require('./paths')
const { importWidget, normalizeWidgetId } = require('./user-widget')
const { fetchWidgetSource } = require('./widget-source')

// Same budgets as widget-source.js: they bound both the download and the
// amount of hashing done on it.
const MAX_FILES = 800
const MAX_BYTES = 32 * 1024 * 1024
const HOSTS = ['github.com', 'atomgit.com']
const SHA = /^[a-f0-9]{40}$/
const HASH = /^[a-f0-9]{64}$/
const DIGEST = /^sha256:[a-f0-9]{64}$/
const SEGMENT = /^[A-Za-z0-9._-]+$/

function fail (message) {
  throw new Error(message)
}

function computeDigest (files) {
  const sorted = [...files].sort((a, b) => a.path < b.path ? -1 : a.path > b.path ? 1 : 0)
  const canonical = sorted.map(f => `${f.path}\0${f.size}\0${f.sha256}\n`).join('')
  return 'sha256:' + crypto.createHash('sha256').update(canonical, 'utf8').digest('hex')
}

function checkSegment (value, what) {
  if (typeof value !== 'string' || !SEGMENT.test(value) || value === '.' || value === '..') {
    fail(`registry ${what} is not usable`)
  }
}

// Must match isSafeRelativePath in the site's build script: file names may
// contain spaces, @ (scoped npm packages) or dots, but never a separator.
function checkFilePath (p) {
  if (typeof p !== 'string' || !p || p.startsWith('/') || p.startsWith('\\') ||
    /^[A-Za-z]:/.test(p) || p.includes('\\') || p.includes('\0')) {
    fail(`registry file path is not usable: ${String(p)}`)
  }
  const parts = p.split('/')
  for (const part of parts) {
    if (!part || part === '.' || part === '..' || part.includes('/') || part.includes('\\')) {
      fail(`registry file path is not usable: ${p}`)
    }
  }
}

function stringField (record, key, max) {
  const value = record[key]
  if (typeof value !== 'string' || value.length > max) {
    fail(`registry ${key} is not usable`)
  }
  return value
}

/**
 * Reject a malformed or hostile record before any network request or disk
 * write. Returns a copy with optional display fields filled in.
 */
function validateRegistryRecord (record) {
  if (!record || typeof record !== 'object' || Array.isArray(record)) {
    fail('no registry record given')
  }
  const id = record.id
  if (typeof id !== 'string' || !isValidWidgetId(id)) {
    fail(`registry id is not usable: ${String(id)}`)
  }
  if (!HOSTS.includes(record.host)) {
    fail(`registry host is not supported: ${String(record.host)}`)
  }
  checkSegment(record.owner, 'owner')
  checkSegment(record.repo, 'repository name')
  if (typeof record.subdir !== 'string') {
    fail('registry subdir is not usable')
  }
  for (const part of record.subdir.split('/').filter(Boolean)) {
    checkSegment(part, 'subdir')
  }
  if (typeof record.ref !== 'string' || !SHA.test(record.ref)) {
    fail('registry ref must be a 40 character commit sha')
  }
  if (typeof record.digest !== 'string' || !DIGEST.test(record.digest)) {
    fail('registry digest is not usable')
  }
  if (!Array.isArray(record.files) || !record.files.length || record.files.length > MAX_FILES) {
    fail('registry file list is empty or too large')
  }
  let total = 0
  const seen = new Set()
  const files = record.files.map(file => {
    if (!file || typeof file !== 'object' || Array.isArray(file)) {
      fail('registry file entry is not usable')
    }
    checkFilePath(file.path)
    if (typeof file.sha256 !== 'string' || !HASH.test(file.sha256)) {
      fail(`registry sha256 is not usable: ${file.path}`)
    }
    if (!Number.isInteger(file.size) || file.size < 0 || file.size > MAX_BYTES) {
      fail(`registry size is not usable: ${file.path}`)
    }
    if (seen.has(file.path)) {
      fail(`registry lists ${file.path} twice`)
    }
    seen.add(file.path)
    total += file.size
    return { path: file.path, sha256: file.sha256, size: file.size }
  })
  if (total > MAX_BYTES) {
    fail('registry widget is larger than 32MB')
  }
  if (record.fileCount !== files.length || record.totalSize !== total) {
    fail('registry file count or total size does not match its file list')
  }
  if (computeDigest(files) !== record.digest) {
    fail('registry digest does not match its file list')
  }
  return {
    ...record,
    id,
    files,
    version: stringField({ ...record, version: record.version || '0.0.0' }, 'version', 64),
    name: stringField({ ...record, name: record.name || id }, 'name', 200),
    description: stringField({ ...record, description: record.description || '' }, 'description', 2000),
    author: stringField({ ...record, author: record.author || '' }, 'author', 200),
    license: stringField({ ...record, license: record.license || '' }, 'license', 100),
    homepage: stringField({ ...record, homepage: record.homepage || '' }, 'homepage', 500),
    sourceUrl: stringField({ ...record, sourceUrl: record.sourceUrl || '' }, 'sourceUrl', 500)
  }
}

/**
 * Walk a downloaded widget folder and hash every regular file. Symlinks and
 * anything that is not a plain file are refused: the custom widget protocol
 * resolves paths with path.resolve(), so a link pointing outside the folder
 * could otherwise be served as if it belonged to the widget.
 */
function collectTree (dir, base = dir, files = [], ctx = { bytes: 0 }) {
  let entries
  try {
    entries = fs.readdirSync(dir, { withFileTypes: true })
  } catch (e) {
    fail(`cannot read downloaded widget folder: ${e.message}`)
  }
  for (const entry of entries) {
    // .git and node_modules/.bin are skipped by every download path and by the
    // registry build, so they are not part of the manifest.
    if (entry.isDirectory() && (entry.name === '.git' || entry.name === '.bin')) {
      continue
    }
    const full = path.join(dir, entry.name)
    const rel = path.relative(base, full).split(path.sep).join('/')
    let stat
    try {
      stat = fs.lstatSync(full)
    } catch (e) {
      fail(`cannot inspect downloaded file: ${rel}`)
    }
    if (stat.isSymbolicLink() || (!stat.isFile() && !stat.isDirectory())) {
      fail(`downloaded widget contains a link or special file: ${rel}`)
    }
    if (stat.isDirectory()) {
      collectTree(full, base, files, ctx)
      continue
    }
    let data
    try {
      data = fs.readFileSync(full)
    } catch (e) {
      fail(`cannot read downloaded file: ${rel}`)
    }
    files.push({
      path: rel,
      size: data.length,
      sha256: crypto.createHash('sha256').update(data).digest('hex')
    })
    ctx.bytes += data.length
    if (files.length > MAX_FILES || ctx.bytes > MAX_BYTES) {
      fail('downloaded widget is too large')
    }
  }
  return files
}

/** Compare a downloaded tree with the pinned record. Throws on any mismatch. */
function verifyWidgetTree (dir, record) {
  const rec = validateRegistryRecord(record)
  const actual = collectTree(dir)
  const map = new Map(actual.map(file => [file.path, file]))
  for (const file of rec.files) {
    const got = map.get(file.path)
    if (!got) {
      fail(`widget is missing ${file.path} from the registry record`)
    }
    if (got.size !== file.size || got.sha256 !== file.sha256) {
      fail(`widget file does not match the registry record: ${file.path}`)
    }
    map.delete(file.path)
  }
  if (map.size) {
    fail(`widget has files not listed in the registry record: ${[...map.keys()][0]}`)
  }
  // The manifest id is what importWidget installs under; check it here too so
  // a record cannot be pointed at a folder with a different widget in it.
  let pkg
  try {
    pkg = JSON.parse(fs.readFileSync(path.join(dir, 'package.json'), 'utf8'))
  } catch (e) {
    fail('downloaded widget has no readable package.json')
  }
  const conf = pkg && pkg.electerm && typeof pkg.electerm === 'object' ? pkg.electerm : {}
  const pkgId = conf.id || pkg.name || path.basename(dir)
  if (normalizeWidgetId(pkgId) !== rec.id) {
    fail(`downloaded widget id "${pkgId}" does not match the registry record`)
  }
  return { fileCount: actual.length, totalSize: rec.totalSize }
}

/** A tree URL with a commit sha, never a branch or HEAD. */
function registrySource (record) {
  const rec = validateRegistryRecord(record)
  const base = `https://${rec.host}/${rec.owner}/${rec.repo}/tree/${rec.ref}`
  return rec.subdir ? `${base}/${rec.subdir}` : base
}

/**
 * Download the pinned tree, verify it, then install through the same
 * importWidget() a local folder uses. opts is only for unit tests.
 */
async function importWidgetFromRegistry (record, overwrite = false, opts = {}) {
  const rec = validateRegistryRecord(record)
  const fetchSource = opts.fetchSource || fetchWidgetSource
  const install = opts.install || importWidget
  const { dir, cleanup } = await fetchSource(registrySource(rec))
  try {
    verifyWidgetTree(dir, rec)
    return {
      ...install(dir, !!overwrite),
      source: `${rec.host}/${rec.owner}/${rec.repo}@${rec.ref.slice(0, 7)}`,
      registryId: rec.id
    }
  } finally {
    cleanup()
  }
}

module.exports = {
  computeDigest,
  validateRegistryRecord,
  collectTree,
  verifyWidgetTree,
  registrySource,
  importWidgetFromRegistry
}
