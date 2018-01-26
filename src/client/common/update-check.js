/**
 * check latest release for update warn
 */

import fetch from './fetch'

export async function getLatestReleaseInfo() {
  let url = 'http://electerm.html5beta.com/version'
  let tag_name = await fetch.get(url, null, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/59.0.3071.115 Safari/537.36'
    }
  })
  if (tag_name) {
    return {
      tag_name
    }
  }
}
