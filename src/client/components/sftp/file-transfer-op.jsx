/**
 * file transfer operation center
 * when doing d&d or transfer
 */

import { useEffect, useState } from 'react'

export default (props) => {
  const [list, setList] = useState([])
  function handleData (data) {
    const {
      filesFrom: [],
      toFile: {},
      localPath,
      remotePath
    } = data
  }
  function onEvent (e) {
    const {
      type,
      tabId,
      data
    } = e.data || {}
    if (type !== 'file-transfer-data-add' || tabId !== props.tabId) {
      return null
    }
    handleData(data)
  }
  function initEvents () {
    window.addEventListener('message', onEvent)
  }
  function destroyEvents () {
    window.removeEventListener('message', onEvent)
  }
  useEffect(() => {
    initEvents()
    return destroyEvents
  }, [])
  return null
}
