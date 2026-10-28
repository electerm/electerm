/**
 * Import a widget from a git host instead of a folder the user already has.
 *
 * What a user pastes:
 *   https://github.com/zxdong262/electerm-ai-auth-widget-example
 *   https://github.com/owner/repo/tree/main/widgets/foo
 *   https://atomgit.com/owner/repo
 *   owner/repo, owner/repo#dev, owner/repo/widgets/foo
 *   git@github.com:owner/repo.git
 *
 * Two download strategies, because the two hosts do not offer the same thing:
 *   - github.com serves an anonymous source archive from codeload, so the whole
 *     tree is one request.
 *   - atomgit.com has no anonymous archive endpoint (its repo metadata API
 *     answers 401 without a token), but its contents API does answer without
 *     one, so the tree is walked and every file fetched from raw.atomgit.com.
 *     Fine for a widget: they are a handful of files, and both a file count and
 *     a byte budget are enforced below so a pasted link to a huge repo stops
 *     with a readable message instead of filling the temp dir.
 *
 * Both strategies end in the same place: a folder on disk that `importWidget`
 * can install, so validation, overwrite handling and the id rules stay in one
 * place (./user-widget.js) and a local folder and a repo take the same path.
 */

const fs = require('fs')
const os = require('os')
const path = require('path')
const zlib = require('zlib')
const { pipeline } = require('stream/promises')
const { isInside } = require('./paths')

const MAX_FILES = 800
const MAX_BYTES = 32 * 1024 * 1024
// how deep to look for the widget folder inside a repo (a monorepo keeps them
// under packages/* or widgets/*; anything deeper is not worth scanning)
const MAX_DEPTH = 3
// files fetched in parallel per folder (contents API: one request per file).
// Kept low: atomgit throttles anonymous bursts with a 429.
const CONCURRENCY = 3
const TIMEOUT = 30000
const USER_AGENT = 'electerm'

// One segment of a repo path. `.` and `..` match this on their own, so they are
// rejected explicitly wherever a path comes from the user or from a server.
const SEGMENT = /^[A-Za-z0-9._-]+$/
const REF = /^[A-Za-z0-9._/-]+$/

const HOSTS = {
  'github.com': {
    kind: 'tarball',
    archiveUrl: (owner, repo, ref) =>
      `https://codeload.github.com/${owner}/${repo}/tar.gz/${ref || 'HEAD'}`
  },
  'atomgit.com': {
    kind: 'contents',
    api: 'https://atomgit.com/api/v5/repos',
    // the contents API hands out download URLs on this host; anything else in a
    // response is not followed
    rawHost: 'raw.atomgit.com'
  }
}

function fail (message) {
  throw new Error(message)
}

function checkRef (ref) {
  if (!ref) {
    return ''
  }
  if (!REF.test(ref) || ref.includes('..') || ref.startsWith('/') || ref.endsWith('/') || ref.startsWith('-')) {
    fail(`"${ref}" is not a usable branch or tag name`)
  }
  return ref
}

function checkSubdir (subdir) {
  const parts = String(subdir || '').split('/').filter(Boolean)
  for (const part of parts) {
    if (part === '.' || part === '..' || !SEGMENT.test(part)) {
      fail(`"${subdir}" is not a usable folder inside the repository`)
    }
  }
  return parts.join('/')
}

function checkRepoPart (value, what) {
  if (!value || value === '.' || value === '..' || !SEGMENT.test(value)) {
    fail(`"${value || ''}" is not a usable ${what}`)
  }
  return value
}

// /owner/repo, /owner/repo/tree/<ref>/<sub>, /owner/repo/blob/<ref>/<file>
function splitRepoPath (segments) {
  const owner = segments[0]
  const repo = (segments[1] || '').replace(/\.git$/i, '')
  let ref = ''
  let subdir = ''
  const rest = segments.slice(2)
  if (rest.length) {
    const kind = rest[0]
    if (kind === 'tree' || kind === 'blob') {
      ref = rest[1] || ''
      const tail = rest.slice(2)
      // a `blob` link points at a file: the widget is the folder holding it
      subdir = kind === 'blob' ? tail.slice(0, -1).join('/') : tail.join('/')
    } else {
      subdir = rest.join('/')
    }
  }
  return { owner, repo, ref, subdir }
}

function buildSource (raw, host, parts) {
  const owner = checkRepoPart(parts.owner, 'owner')
  const repo = checkRepoPart(parts.repo, 'repository name')
  const ref = checkRef(parts.ref)
  const subdir = checkSubdir(parts.subdir)
  return {
    input: raw,
    host,
    owner,
    repo,
    ref,
    subdir,
    label: `${host}/${owner}/${repo}` +
      (ref ? `#${ref}` : '') +
      (subdir ? `/${subdir}` : '')
  }
}

function parseUrl (raw) {
  let url
  try {
    url = new URL(raw)
  } catch (e) {
    fail(`cannot read "${raw}" as a link`)
  }
  if (url.protocol !== 'https:' && url.protocol !== 'http:') {
    fail(`"${raw}" is not an http link`)
  }
  const host = url.hostname.replace(/^www\./i, '').toLowerCase()
  if (!HOSTS[host]) {
    fail(`cannot import from ${host}: only ${Object.keys(HOSTS).join(' and ')} are supported`)
  }
  let segments
  try {
    segments = url.pathname.split('/').filter(Boolean).map(decodeURIComponent)
  } catch (e) {
    fail(`cannot read the path of "${raw}"`)
  }
  if (segments.length < 2) {
    fail(`"${raw}" does not name a repository, it should look like ${host}/owner/repo`)
  }
  return buildSource(raw, host, splitRepoPath(segments))
}

// git@github.com:owner/repo.git -> https://github.com/owner/repo.git
function fromScpLike (raw) {
  const match = /^[a-z0-9._-]+@([^:/]+):(.+)$/i.exec(raw)
  if (!match) {
    fail(`cannot read "${raw}" as a git address`)
  }
  return `https://${match[1]}/${match[2]}`
}

/**
 * Turn what the user typed into { host, owner, repo, ref, subdir }.
 *
 * A short `owner/repo` is GitHub: it is the form people write by hand, and
 * AtomGit users tend to paste the page URL instead.
 */
function parseWidgetSource (input) {
  if (typeof input !== 'string' || !input.trim()) {
    fail('give a repository, e.g. owner/repo or https://github.com/owner/repo')
  }
  let raw = input.trim()
  if (/^[a-z0-9._-]+@[^:/]+:/.test(raw)) {
    raw = fromScpLike(raw)
  }
  // `github.com/owner/repo` is a link without the scheme; anything else with a
  // dot in the first segment is treated as one too
  if (!/^[a-z]+:\/\//i.test(raw) && /^(www\.)?(github|atomgit)\.com\//i.test(raw)) {
    raw = `https://${raw}`
  }
  if (/^[a-z]+:\/\//i.test(raw)) {
    return parseUrl(raw)
  }
  // short form: owner/repo, owner/repo#ref, owner/repo/sub/dir. The ref is only
  // ever after the `#` here — a path segment called "tree" is a folder.
  const hashAt = raw.indexOf('#')
  const ref = hashAt === -1 ? '' : raw.slice(hashAt + 1)
  const plain = hashAt === -1 ? raw : raw.slice(0, hashAt)
  const segments = plain.split('/').filter(Boolean)
  if (segments.length < 2) {
    fail(`"${input.trim()}" is not a repository, it should look like owner/repo`)
  }
  return buildSource(input.trim(), 'github.com', {
    owner: segments[0],
    repo: segments[1],
    ref,
    subdir: segments.slice(2).join('/')
  })
}

function createHttp () {
  const axios = require('axios')
  const base = {
    timeout: TIMEOUT,
    maxRedirects: 5,
    headers: { 'user-agent': USER_AGENT }
  }
  // atomgit answers 429 for a burst of anonymous requests, and its window is
  // short enough that waiting once is usually the whole fix
  const RETRY = [429, 502, 503, 504]
  const BACKOFF = [1500, 4000]
  const request = async (url, config) => {
    for (let attempt = 0; ; attempt++) {
      try {
        return await axios.get(url, { ...base, ...config })
      } catch (err) {
        const status = err && err.response && err.response.status
        if (attempt >= BACKOFF.length || !RETRY.includes(status)) {
          const host = (() => {
            try {
              return new URL(url).hostname
            } catch (e) {
              return url
            }
          })()
          const wrapped = new Error(status
            ? `HTTP ${status} from ${host}`
            : (err && err.message) || String(err))
          wrapped.status = status
          throw wrapped
        }
        await new Promise(resolve => setTimeout(resolve, BACKOFF[attempt]))
      }
    }
  }
  return {
    async getJSON (url) {
      const { data } = await request(url)
      return data
    },
    async getStream (url) {
      const { data } = await request(url, {
        responseType: 'stream',
        maxContentLength: MAX_BYTES * 4
      })
      return data
    },
    async getBuffer (url) {
      const { data } = await request(url, {
        responseType: 'arraybuffer',
        maxContentLength: MAX_BYTES
      })
      return Buffer.from(data)
    }
  }
}

async function fetchTarball (source, dir, http) {
  const tar = require('tar')
  const host = HOSTS[source.host]
  const stream = await http.getStream(host.archiveUrl(source.owner, source.repo, source.ref))
  await pipeline(
    stream,
    zlib.createGunzip(),
    // the archive holds a single `<owner>-<repo>-<sha>/` wrapper
    tar.extract({
      cwd: dir,
      strip: 1,
      filter: (file) => !file.split('/').includes('.git')
    })
  )
}

function contentsUrl (source, remotePath) {
  const host = HOSTS[source.host]
  const suffix = remotePath
    ? '/' + remotePath.split('/').map(encodeURIComponent).join('/')
    : ''
  const query = source.ref ? `?ref=${encodeURIComponent(source.ref)}` : ''
  return `${host.api}/${encodeURIComponent(source.owner)}/${encodeURIComponent(source.repo)}/contents${suffix}${query}`
}

function checkDownloadUrl (source, url) {
  let parsed
  try {
    parsed = new URL(url)
  } catch (e) {
    fail(`${source.label}: the host returned an unusable download link`)
  }
  const rawHost = HOSTS[source.host].rawHost
  if (parsed.protocol !== 'https:' || (parsed.hostname !== rawHost && !parsed.hostname.endsWith('.' + rawHost))) {
    fail(`${source.label}: refusing to download from ${parsed.hostname}`)
  }
  return url
}

function checkBudget (source, ctx) {
  if (ctx.files > MAX_FILES) {
    fail(`${source.label} has more than ${MAX_FILES} files, it does not look like a widget`)
  }
  if (ctx.bytes > MAX_BYTES) {
    fail(`${source.label} is larger than ${Math.round(MAX_BYTES / 1024 / 1024)}MB, it does not look like a widget`)
  }
}

// Fetch a list of files a few at a time. The contents API is one request per
// file, and serially that is about a second per file — slow enough to look
// broken on a widget with twenty of them.
async function runPool (items, limit, worker) {
  let index = 0
  let error = null
  const next = async () => {
    while (!error && index < items.length) {
      const item = items[index++]
      try {
        await worker(item)
      } catch (err) {
        // kept and rethrown below: a rejection here would leave the other
        // workers writing into a folder the caller is already deleting
        error = error || err
      }
    }
  }
  const workers = []
  for (let i = 0; i < Math.min(limit, items.length); i++) {
    workers.push(next())
  }
  await Promise.all(workers)
  if (error) {
    throw error
  }
}

/**
 * Walk one folder through the contents API and write it under `localDir`.
 *
 * Local paths are built from the names in the listing, never from the
 * repo-relative `path` the server sends: with a subfolder import the two are
 * not the same, and a name is also the only part that has to be a single
 * segment.
 */
async function walkContents (source, localDir, remotePath, http, ctx) {
  const list = await http.getJSON(contentsUrl(source, remotePath))
  if (!Array.isArray(list)) {
    fail(`${source.label}: the host did not return a folder listing for "${remotePath || '/'}"`)
  }
  const files = []
  for (const item of list) {
    const name = String((item && item.name) || '')
    if (!item || !name || name === '.' || name === '..' || /[/\\]/.test(name) || name.startsWith('.')) {
      continue
    }
    const target = path.resolve(localDir, name)
    // the name comes from the server, so the result is checked before it is used
    if (!isInside(localDir, target)) {
      fail(`${source.label}: the host returned an unusable path (${name})`)
    }
    if (item.type === 'dir') {
      fs.mkdirSync(target, { recursive: true })
      await walkContents(source, target, String(item.path || name), http, ctx)
    } else if (item.type === 'file') {
      files.push({ item, target })
    }
    // submodules and symlinks are skipped: a widget is plain files
  }
  await runPool(files, CONCURRENCY, async ({ item, target }) => {
    ctx.files++
    checkBudget(source, ctx)
    const buffer = await http.getBuffer(checkDownloadUrl(source, item.download_url))
    ctx.bytes += buffer.length
    checkBudget(source, ctx)
    fs.mkdirSync(path.dirname(target), { recursive: true })
    fs.writeFileSync(target, buffer)
  })
}

// Download the tree of `source` into `dir`, whatever the host needs for it.
async function downloadSource (source, dir, http = createHttp()) {
  fs.mkdirSync(dir, { recursive: true })
  const host = HOSTS[source.host]
  if (host.kind === 'tarball') {
    await fetchTarball(source, dir, http)
    return dir
  }
  const ctx = { files: 0, bytes: 0 }
  await walkContents(source, dir, source.subdir, http, ctx)
  return dir
}

function readPkg (dir) {
  try {
    return JSON.parse(fs.readFileSync(path.join(dir, 'package.json'), 'utf8'))
  } catch (e) {
    return null
  }
}

function isWidgetDir (dir) {
  const pkg = readPkg(dir)
  return !!(pkg && pkg.electerm && typeof pkg.electerm === 'object')
}

/**
 * Find the widget folder inside a downloaded repo.
 *
 * The manifest decides, not the folder name: a repo can be called anything and
 * still hold a widget. Widest first, so the shallowest match wins and a nested
 * `node_modules` copy of some package is never picked over the real thing.
 */
function findWidgetRoot (dir, label = 'the repository') {
  if (isWidgetDir(dir)) {
    return dir
  }
  let level = [dir]
  for (let depth = 0; depth < MAX_DEPTH && level.length; depth++) {
    const next = []
    const found = []
    for (const parent of level) {
      let names = []
      try {
        names = fs.readdirSync(parent)
      } catch (e) {
        continue
      }
      for (const name of names) {
        if (name.startsWith('.') || name === 'node_modules') {
          continue
        }
        const child = path.join(parent, name)
        let stat
        try {
          stat = fs.statSync(child)
        } catch (e) {
          continue
        }
        if (!stat.isDirectory()) {
          continue
        }
        if (isWidgetDir(child)) {
          found.push(child)
        } else {
          next.push(child)
        }
      }
    }
    if (found.length === 1) {
      return found[0]
    }
    if (found.length > 1) {
      const names = found.map(item => path.relative(dir, item) || '.').join(', ')
      fail(`${label} holds ${found.length} widgets (${names}); import the one you want by its folder`)
    }
    level = next
  }
  // no `electerm` manifest anywhere: keep a root package.json so the install
  // fails in the loader with its own message ("widget entry not found: ...")
  // instead of a misleading "there is no package.json"
  if (readPkg(dir)) {
    return dir
  }
  fail(`${label} has no package.json, so it is not an electerm widget`)
}

/**
 * Download `input` into a temp folder and resolve the widget folder in it.
 *
 * The caller must `cleanup()`; the folder is only a staging area and the widget
 * itself is copied out of it by `importWidget`.
 */
async function fetchWidgetSource (input, opts = {}) {
  const source = parseWidgetSource(input)
  const http = opts.http || createHttp()
  const root = opts.tmpDir || fs.mkdtempSync(path.join(os.tmpdir(), 'electerm-widget-'))
  const cleanup = () => {
    try {
      fs.rmSync(root, { recursive: true, force: true })
    } catch (e) {
      // a leftover temp folder is not worth failing an import over
    }
  }
  try {
    try {
      await downloadSource(source, root, http)
    } catch (err) {
      if (err && err.status === 429) {
        fail(`${source.label}: the host is rate limiting anonymous downloads, wait a minute and try again`)
      }
      if (err && err.message && err.message.startsWith(source.label)) {
        throw err
      }
      fail(`cannot download ${source.label}: ${(err && err.message) || err}`)
    }
    const base = source.subdir ? path.resolve(root, source.subdir) : root
    if (base !== root && !isInside(root, base)) {
      fail(`${source.label}: "${source.subdir}" is outside the repository`)
    }
    if (!fs.existsSync(base) || !fs.statSync(base).isDirectory()) {
      fail(`${source.label}: there is no folder "${source.subdir}" in the repository`)
    }
    return {
      dir: findWidgetRoot(base, source.label),
      source,
      root,
      cleanup
    }
  } catch (err) {
    cleanup()
    throw err
  }
}

module.exports = {
  parseWidgetSource,
  downloadSource,
  findWidgetRoot,
  fetchWidgetSource,
  createHttp,
  HOSTS
}
