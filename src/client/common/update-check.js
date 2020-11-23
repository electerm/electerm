/**
 * check latest release for update warn
 */

import fetch from './fetch-from-server'
import _ from 'lodash'
import {
  baseUpdateCheckUrls
} from './constants'

async function fetchData (url, options) {
  const data = {
    action: 'fetch',
    options: {
      ...options,
      url,
      timeout: 15000
    }
  }
  return fetch(data)
}

function getInfo (url) {
  const n = +new Date()
  return fetchData(url + '?_=' + n, {
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

export async function getLatestReleaseVersion () {
  let url = `${baseUpdateCheckUrls[0]}/version.html`
  let tagName = await getInfo(url)
  if (!tagName) {
    url = `${baseUpdateCheckUrls[1]}/version.html`
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
  if (!_.get(res, 'release.body')) {
    url = `${baseUpdateCheckUrls[1]}/data/electerm-github-release.json`
    res = await getInfo(url)
  }
  return _.get(res, 'release.body')
}
