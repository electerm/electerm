/**
 * transporter UI component
 */
import React from 'react'
import Tag from '../sftp/transfer-tag'
import {
  CloseCircleOutlined,
  PlayCircleOutlined,
  PauseCircleOutlined
} from '@ant-design/icons'
import {
  transportTypes
} from '../sftp/transport-types'
import postMessage from '../../common/post-msg'
import './transfer.styl'

const { prefix } = window
const e = prefix('sftp')

export default function Transporter (props) {
  const {
    fromPath,
    toPath,
    fromPathReal,
    toPathReal,
    typeTo,
    typeFrom,
    percent,
    speed,
    pausing = false,
    leftTime,
    passedTime,
    error,
    inited,
    id
  } = props.transfer
  function cancel () {
    postMessage({
      action: transportTypes.cancelTransport,
      id
    })
  }
  function handlePauseOrResume () {
    postMessage({
      action: transportTypes.pauseOrResumeTransfer,
      id
    })
  }
  const isTransfer = typeTo !== typeFrom
  const Icon = !pausing ? PauseCircleOutlined : PlayCircleOutlined
  const pauseTitle = pausing ? e('resume') : e('pause')
  const cls = 'sftp-transport mg1b pd1x'
  const typeFromTitle = e(typeFrom)
  const typeToTitle = e(typeTo)
  const title = `${typeFromTitle}→${typeToTitle}: ${fromPath} -> ${toPath} ${speed || ''} ${percent || 0}%`
  const cancelIcon = (
    <CloseCircleOutlined
      className='transfer-control-icon pointer hover-black font14'
      onClick={cancel}
      title={e('cancel')}
    />
  )
  const controlIcon = isTransfer
    ? (
      <Icon
        className='flex-child transfer-control-icon pointer hover-black font14'
        onClick={handlePauseOrResume}
        title={pauseTitle}
      />
      )
    : null
  return (
    <div className={cls} title={title} id={`transfer-unit-${id}`}>
      <Tag
        transfer={{
          typeTo,
          typeFrom,
          error,
          inited
        }}
      />
      <span
        className='flex-child sftp-file sftp-local-file elli'
        title={fromPath}
      >{fromPathReal || fromPath}
      </span>
      <span className='flex-child sftp-transfer-arrow'>
        →
      </span>
      <span
        className='flex-child sftp-file sftp-remote-file elli'
      >{toPathReal || toPath}
      </span>
      <span
        className='flex-child sftp-file-percent'
      >
        {percent || 0}%
        {speed ? `(${speed})` : null}
      </span>
      <span
        className='flex-child sftp-file-percent'
      >
        {passedTime || '-'}|{leftTime || '-'}
      </span>
      {controlIcon}
      {cancelIcon}
    </div>
  )
}
