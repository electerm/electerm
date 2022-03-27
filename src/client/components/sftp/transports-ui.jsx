/**
 * transporter UI component
 */
import { useRef, useEffect } from 'react'
import Transport from './transport-action'
import { transportTypes } from './transport-types'
import _ from 'lodash'

export default function TransportsUI (props) {
  const {
    transferList
  } = props
  const timer = useRef(null)
  function onDestroy () {
    clearTimeout(timer.current)
  }
  useEffect(() => {
    return onDestroy
  }, [])
  const pauseAll = () => {
    props.modifier({
      pauseAll: true
    })
    window.postMessage({
      action: transportTypes.pauseTransport,
      ids: []
    }, '*')
  }
  const resumeAll = () => {
    props.modifier({
      pauseAll: false
    })
    window.postMessage({
      action: transportTypes.resumeTransport,
      ids: []
    }, '*')
  }
  const pauseOrResumeAll = () => {
    if (props.pauseAll) {
      return resumeAll()
    }
    return pauseAll()
  }
  const cancelAll = () => {
    props.modifier({
      pauseAll: false
    })
    window.postMessage({
      action: transportTypes.cancelTransport,
      ids: []
    }, '*')
  }

  function onMessage (e) {
    const action = _.get(e, 'data.action')
    const id = _.get(e, 'data.id')
    if (id === props.sessionId || id === 'all') {
      switch (action) {
        case transportTypes.cancelAll:
          cancelAll()
          break
        case transportTypes.pauseOrResumeAll:
          pauseOrResumeAll()
          break
        default:
          break
      }
    }
  }
  function initEvent () {
    window.addEventListener('message', onMessage)
  }
  function destroyEvents () {
    window.removeEventListener('message', onMessage)
  }
  useEffect(() => {
    initEvent()
    return destroyEvents
  }, [])
  if (!transferList.length) {
    return null
  }
  return transferList.map((t, i) => {
    const { id } = t
    return (
      <Transport
        {...props}
        transfer={t}
        key={id + ':tr:' + i}
      />
    )
  })
}
