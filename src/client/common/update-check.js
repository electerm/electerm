/**
 * check latest release for update warn
 */

import fetch from './fetch-from-server'
import {
  baseUpdateCheckUrls, packInfo
} from './constants'
import dayjs from 'dayjs'

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
  const tail = url.includes('?') ? '' : '?_=' + n
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

  let url = `${baseUpdateCheckUrls[0]}/version.html${q}`
  let tagName = await getInfo(url)
  if (!tagName) {
    url = `${baseUpdateCheckUrls[1]}/version.html${q}`
    tagName = await getInfo(url)
  }
  if (tagName) {
    return {
      tag_name: tagName
    }
  }
}

export async function getLatestReleaseInfo () {
  let url = `${baseUpdateCheckUrls[0]}/data/electerm-github-release.json`
  let res = await getInfo(url)
  if (!res?.release?.body) {
    url = `${baseUpdateCheckUrls[1]}/data/electerm-github-release.json`
    res = await getInfo(url)
  }
  return res && res.release
    ? {
        body: res.release.body,
        date: dayjs(res.release.published_at).format('YYYY-MM-DD')
      }
    : undefined
}
