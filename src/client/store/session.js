/**
 * sessions not proper closed related functions
 */

import { getData } from '../common/db'
import copy from 'json-deep-copy'

export default store => {
  Object.assign(store, {
    async checkLastSession () {
      const status = await window.pre.runGlobalAsync('getExitStatus')
      if (status === 'ok') {
        return
      }
      const sessionsGlob = await getData('sessions')
      store.showLastSessions(sessionsGlob)
    },

    showLastSessions (sessions) {
      if (!sessions) {
        return
      }
      store.storeAssign({
        selectedSessions: copy(sessions).map(s => ({
          id: s.id,
          tab: s,
          checked: true
        })),
        sessionModalVisible: true
      })
    }
  })
}
