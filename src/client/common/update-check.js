/**
 * check latest release for update warn
 */

import fetch from './fetch'

export async function getLatestReleaseInfo() {
  let url = 'https://api.github.com/repos/electerm/electerm/releases?page=1&limit=1'
  let res = await fetch.get(url)
  if (res && res[0]) {
    return res[0]
  }
}
