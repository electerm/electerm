import { useEffect } from 'react'
import ConnectionHoppingWarningText from '../common/connection-hopping-warning-text'
import {
  notification
} from 'antd'
import * as ls from '../../common/safe-local-storage'
import {
  connectionHoppingWarnKey
} from '../../common/constants'

const e = window.translate

export default function ConnectionHoppingWarning (props) {
  const {
    hasOldConnectionHoppingBookmark,
    configLoaded
  } = props
  function closeWarn () {
    notification.destroy(connectionHoppingWarnKey)
  }
  function showWarning () {
    if (
      !hasOldConnectionHoppingBookmark ||
      !configLoaded ||
      ls.getItem(connectionHoppingWarnKey) === 'yes'
    ) {
      return
    }
    notification.info({
      message: e('connectionHopping'),
      duration: 0,
      placement: 'bottom',
      key: connectionHoppingWarnKey,
      description: (
        <ConnectionHoppingWarningText
          closeWarn={closeWarn}
        />
      )
    })
  }
  useEffect(() => {
    showWarning()
  }, [configLoaded, hasOldConnectionHoppingBookmark])
  return null
}
