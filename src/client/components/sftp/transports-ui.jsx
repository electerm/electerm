/**
 * transporter UI component
 */
import { useRef, useEffect } from 'react'
import {
  PlayCircleOutlined,
  PauseCircleOutlined
} from '@ant-design/icons'
import Transport from './transport-action'
import { transportTypes } from './transport-types'
import _ from 'lodash'
import copy from 'json-deep-copy'

const { prefix } = window
const e = prefix('sftp')

export default function Transporter (props) {
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
  const currentTransports = transferList.filter(
    t => t.inited
  )
  const computePercent = () => {
    const { all, transfered } = transferList.reduce((prev, c) => {
      prev.all += _.get(c, 'fromFile.size') || 0
      prev.transfered += (c.transferred || 0)
      return prev
    }, {
      all: 0,
      transfered: 0
    })
    let percent = all === 0
      ? 0
      : Math.floor(100 * transfered / all)
    percent = percent >= 100 ? 99 : percent
    return percent
  }

  const computeLeftTime = () => {
    const sorted = copy(currentTransports).sort((b, a) => a.leftTimeInt - b.leftTimeInt)
    return _.get(sorted, '[0].leftTime') || '-'
  }

  const computePausing = () => {
    return currentTransports.reduce((prev, c) => {
      return prev && c.pausing
    }, true)
  }
  function renderTransportIcon () {
    const pausing = computePausing()
    const Icon = pausing ? PlayCircleOutlined : PauseCircleOutlined
    return <Icon className='font14' />
  }
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
  function renderTitle () {
    return (
      <div className='fix transports-title'>
        <div className='fleft'>
          {e('fileTransfers')}
        </div>
        <div className='fright'>
          <span
            className='color-red pointer'
            onClick={cancelAll}
          >
            {e('cancelAll')}
          </span>
        </div>
      </div>
    )
  }
  function renderContent () {
    return (
      <div className='transports-content overscroll-y'>
        {
          transferList.map((t, i) => {
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
      </div>
    )
  }
  if (!transferList.length) {
    return null
  }
  return (
    <div className='transports-wrap'>
      <div className='transports-circle-wrap'>
        <div
          className='opacity-loop pointer'
          onClick={pauseOrResumeAll}
        >
          {renderTransportIcon()} {computePercent()}%({computeLeftTime()})
          <span className='mg1l'>
            [{currentTransports.length} / {transferList.length}]
          </span>
        </div>
      </div>
      <div
        className='transports-dd'
      >
        {renderTitle()}
        {renderContent()}
      </div>
    </div>
  )
}
