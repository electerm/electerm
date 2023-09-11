// make old data imported compatible
import { buildProxyString } from '../../app/lib/build-proxy.js'

export function fixBookmarks (arr) {
  return arr.map(bookmark => {
    if (typeof bookmark.proxy !== 'string') {
      bookmark.proxy = buildProxyString(bookmark.proxy || {})
    }
    return bookmark
  })
}
