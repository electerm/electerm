/**
 * check latest release for update warn
 */

import fetch from './fetch-from-server'
import {
  baseUpdateCheckUrls, packInfo
} from './constants'
import dayjs from 'dayjs'
import updateMirrors from '../../app/common/update-mirrors.json'
import normalizeReleaseTag from '../../app/common/normalize-release-tag.cjs'

async function fetchData (url, options) {
  const data = {
    action: 'fetch',
    options: {
      ...options,
      url,
      timeout: 15000
    },
    proxy: window.store.getProxySetting()
  }
  return fetch(data)
}

function getInfo (url) {
  const n = Date.now()
  const tail = url.includes('?') ? '&_=' + n : '?_=' + n
  return fetchData(url + tail, {
    action: 'get-update-info',
    headers: {
      'User-Agent': 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/59.0.3071.115 Safari/537.36'
    },
    timeout: 1000 * 60 * 5
  })
    .catch(() => {
      return null
    })
}

export async function getLatestReleaseVersion (n) {
  let q = ''
  if (n) {
    const { store } = window
    const info = {
      load_time: store.loadTime,
      bookmark_count: store.bookmarks.length,
      lang: store.config.language,
      sync_with_github: !!store.config.syncSetting?.githubGistId,
      sync_with_gitee: !!store.config.syncSetting?.giteeGistId,
      version: packInfo.version,
      installSrc: store.installSrc,
      n: Date.now()
    }
    q = Object.keys(info).reduce((p, k, i) => {
      const pre = i ? '&' : '?'
      return p + pre + k + '=' + encodeURIComponent(info[k])
    }, '')
  }
  const versionFile = window.et.versionFile || 'version.html'
  for (const base of baseUpdateCheckUrls) {
    const tag = normalizeReleaseTag(await getInfo(`${base}/${versionFile}${q}`))
    if (tag) return { tag_name: tag }
  }
}

export function getDownloadUrl (browserDownloadUrl, mirror) {
  if (!browserDownloadUrl || mirror === 'github' || !Object.prototype.hasOwnProperty.call(updateMirrors, mirror)) return browserDownloadUrl || ''
  const [tag, file] = browserDownloadUrl.split('/').slice(-2)
  return updateMirrors[mirror].replace('{tag}', tag).replace('{file}', file)
}

export async function getLatestReleaseInfo () {
  const { installSrc } = window.store
  const src = installSrc ? '?src=' + encodeURIComponent(installSrc) : ''
  let url = `${baseUpdateCheckUrls[0]}/data/electerm-github-release.json${src}`
  let res = await getInfo(url)
  if (!res?.release?.body) {
    url = `${baseUpdateCheckUrls[1]}/data/electerm-github-release.json${src}`
    res = await getInfo(url)
  }
  if (!res || !res.release) {
    return undefined
  }
  const asset = (res.release.assets || []).find(r => installSrc && r.name.endsWith('-' + installSrc))
  return {
    body: res.release.body,
    date: dayjs(res.release.published_at).format('YYYY-MM-DD'),
    browserDownloadUrl: asset ? asset.browser_download_url : ''
  }
}
