/**
 * check latest release for update warn
 */

import fetch from './fetch-from-server'
import _ from 'lodash'
import {
  baseUrls
} from './constants'

function getInfo (url) {
  const n = +new Date()
  return fetch(url + '?_=' + n, {
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
  let url = `${baseUrls[0]}/version.html`
  let tagName = await getInfo(url)
  if (!tagName) {
    url = `${baseUrls[1]}/version.html`
    tagName = await getInfo(url)
  }
  if (tagName) {
    return {
      tag_name: tagName
    }
  }
}

export async function getLatestReleaseInfo () {
  let url = `${baseUrls[0]}/data/electerm-github-release.json`
  let res = await getInfo(url).then(JSON.parse)
  if (!_.get(res, 'release.body')) {
    url = `${baseUrls[1]}/data/electerm-github-release.json`
    res = await getInfo(url).then(JSON.parse)
  }
  return _.get(res, 'release.body')
}
