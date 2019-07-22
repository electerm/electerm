/**
 * check latest release for update warn
 */

import fetch from './fetch'
import _ from 'lodash'

export async function getLatestReleaseVersion () {
  const url = 'https://electerm.html5beta.com/version.html?_=' + (+new Date())
  const tagName = await fetch.get(url, null, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/59.0.3071.115 Safari/537.36'
    },
    timeout: 1000 * 60 * 5
  })
  if (tagName) {
    return {
      tag_name: tagName
    }
  }
}

export async function getLatestReleaseInfo () {
  const url = 'https://electerm.html5beta.com/data/electerm-github-release.json?_=' + (+new Date())
  const res = await fetch.get(url, null, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/59.0.3071.115 Safari/537.36'
    },
    timeout: 1000 * 60 * 5
  })
  return _.get(res, 'release.body')
}
