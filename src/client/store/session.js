/**
 * sessions not proper closed related functions
 */

import { debounce } from 'lodash-es'
import { refs } from '../components/common/ref'

export default Store => {
  Store.prototype.zoomTerminal = debounce(function (delta) {
    const term = refs.get('term-' + window.store.activeTabId)
    if (!term) {
      return
    }
    term.zoom(delta > 0 ? 1 : -1)
  }, 500)
}
