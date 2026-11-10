/**
 * Read-only client for the widgets.electerm.org registry.
 *
 * The registry is fetched through the app's own ws fetch proxy (the same path
 * update checks use), so it honours the user's proxy setting and needs no CORS
 * opening in the renderer. Nothing here writes to the site: the site has no
 * login and no write API in P0.
 *
 * The site is treated as untrusted input: every field is type checked, and the
 * detail URL is built from the widget id rather than from a URL in the index,
 * so a tampered index cannot make the app fetch an arbitrary address.
 */

import fetchFromServer from './fetch-from-server'

const BASE = window.et.widgetRegistryUrl || 'https://widgets.electerm.org/api/v1'
const TIMEOUT = 15000
const ID = /^[a-z0-9-]+$/
const SHA = /^[a-f0-9]{40}$/
const DIGEST = /^sha256:[a-f0-9]{64}$/

function str (value, max = 500) {
  return typeof value === 'string' && value.length <= max ? value : ''
}

async function loadJson (path) {
  const data = await fetchFromServer({
    action: 'fetch',
    options: {
      method: 'GET',
      url: `${BASE}${path}`,
      timeout: TIMEOUT,
      headers: { Accept: 'application/json' }
    },
    proxy: window.store && window.store.getProxySetting
      ? window.store.getProxySetting()
      : undefined
  }, { silent: true })
  const payload = typeof data === 'string' ? JSON.parse(data) : data
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
    throw new Error('the widget registry returned an unusable response')
  }
  return payload
}

function isSummary (item) {
  return item && typeof item === 'object' && !Array.isArray(item) &&
    typeof item.id === 'string' && ID.test(item.id) &&
    typeof item.ref === 'string' && SHA.test(item.ref) &&
    typeof item.digest === 'string' && DIGEST.test(item.digest) &&
    item.status === 'public'
}

function sanitizeSummary (item) {
  return {
    id: item.id,
    ref: item.ref,
    digest: item.digest,
    host: str(item.host, 100),
    owner: str(item.owner, 100),
    repo: str(item.repo, 200),
    subdir: str(item.subdir, 200),
    version: str(item.version, 64),
    name: str(item.name, 200) || item.id,
    description: str(item.description, 2000),
    author: str(item.author, 200),
    license: str(item.license, 100),
    homepage: str(item.homepage, 500),
    sourceUrl: str(item.sourceUrl, 500),
    fileCount: Number.isInteger(item.fileCount) ? item.fileCount : 0,
    totalSize: Number.isInteger(item.totalSize) ? item.totalSize : 0
  }
}

/** Index + revocation list. A broken revocation list must not break browsing. */
export async function loadWidgetRegistry () {
  const [index, revoked] = await Promise.all([
    loadJson('/index.json'),
    loadJson('/revocations.json').catch(() => ({ revocations: [] }))
  ])
  const widgets = Array.isArray(index.widgets)
    ? index.widgets.filter(isSummary).map(sanitizeSummary)
    : []
  const revocations = Array.isArray(revoked.revocations)
    ? revoked.revocations
      .filter(item => item && typeof item.id === 'string' && ID.test(item.id))
      .map(item => ({ id: item.id, ref: str(item.ref, 64), reason: str(item.reason, 500) }))
    : []
  return { widgets, revocations }
}

/**
 * Fetch the full record (with the file list) and install it. The main process
 * validates the record again, downloads the pinned commit and hashes every
 * file before copying anything into the widgets folder.
 */
export async function installRegistryWidget (id, overwrite = false) {
  if (typeof id !== 'string' || !ID.test(id)) {
    throw new Error('invalid widget id')
  }
  const record = await loadJson(`/widgets/${encodeURIComponent(id)}.json`)
  if (!isSummary(record) || record.id !== id || !Array.isArray(record.files)) {
    throw new Error('the widget registry returned an unusable widget record')
  }
  return window.pre.runGlobalAsync('importWidgetFromRegistry', record, !!overwrite)
}

export const registrySourceUrl = (record) => {
  return record.sourceUrl || `https://${record.host}/${record.owner}/${record.repo}/tree/${record.ref}`
}
