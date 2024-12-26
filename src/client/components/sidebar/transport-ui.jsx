/**
 * transporter UI component
 */
import { useRef } from 'react'
import Tag from '../sftp/transfer-tag'
import { Flex } from 'antd'
import {
  CloseCircleOutlined,
  PlayCircleOutlined,
  PauseCircleOutlined,
  VerticalAlignTopOutlined
} from '@ant-design/icons'
import { action } from 'manate'
import { addClass, removeClass } from '../../common/class'
import './transfer.styl'

const e = window.translate

export default function Transporter (props) {
  const dom = useRef()
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
  const { index } = props
  const onDragCls = 'ondrag-tr'
  const onDragOverCls = 'dragover-tr'
  function moveToTop () {
    action(function () {
      const arr = window.store.fileTransfers
      if (index > 0) {
        const [item] = arr.splice(index, 1)
        arr.unshift(item)
      }
    })()
  }
  function cancel () {
    window.store.cancelTransfer(id)
  }
  function handlePauseOrResume () {
    window.store.toggleTransfer(id)
  }

  function clearCls () {
    document.querySelectorAll('.' + onDragOverCls).forEach((d) => {
      removeClass(d, onDragOverCls)
    })
  }

  function onDrag () {
    addClass(dom.current, onDragCls)
  }

  function onDragEnter () {
    clearCls()
    addClass(dom.current, onDragOverCls)
  }

  function onDragExit () {
    // debug('ondragexit')
    // let {target} = e
    // removeClass(target, 'sftp-dragover')
  }

  function onDragLeave (e) {
    // debug('ondragleave')
    const { target } = e
    removeClass(target, onDragOverCls)
  }

  function onDragOver (e) {
    // debug('ondragover')
    // debug(e.target)
    // removeClass(dom.current, 'sftp-dragover')
    e.preventDefault()
  }

  function onDragStart (e) {
    // debug('ondragstart')
    // debug(e.target)
    e.dataTransfer.setData('id', JSON.stringify(dom.current.getAttribute('data-id')))
    // e.effectAllowed = 'copyMove'
  }

  function onDrop (e) {
    e.preventDefault()
    const { target } = e
    if (!target) {
      return
    }
    let onDropTab = target
    while (onDropTab) {
      if (onDropTab.classList && onDropTab.classList.contains('sftp-transport')) {
        break
      }
      onDropTab = onDropTab.parentElement
    }
    const fromId = JSON.parse(e.dataTransfer.getData('id'))
    if (!onDropTab || !fromId) {
      return
    }

    const dropId = onDropTab.getAttribute('data-id')
    if (!dropId || dropId === fromId) {
      return
    }

    const arr = window.store.fileTransfers
    const indexFrom = arr.findIndex(t => t.id === fromId)
    let indexDrop = arr.findIndex(t => t.id === dropId)
    if (indexFrom >= 0 && indexDrop >= 0) {
      // Reorder tabs and update batch
      action(function () {
        const [tr] = arr.splice(indexFrom, 1)
        if (indexFrom < indexDrop) {
          indexDrop = indexDrop - 1
        }
        arr.splice(indexDrop, 0, tr)
      })()
    }
  }

  function onDragEnd (e) {
    removeClass(dom.current, onDragCls)
    clearCls()
    e && e.dataTransfer && e.dataTransfer.clearData()
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
      className='transfer-control-icon transfer-control-cancel pointer hover-black font14'
      onClick={cancel}
      title={e('cancel')}
    />
  )
  const toTopIcon = index === 0
    ? null
    : (
      <VerticalAlignTopOutlined
        className='transfer-control-icon pointer hover-black font14'
        onClick={moveToTop}
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
  const flexProps = {
    className: cls,
    gap: 3,
    title,
    ref: dom,
    id: `transfer-unit-${id}`,
    draggable: true,
    'data-id': id,
    onDrag,
    onDragEnter,
    onDragExit,
    onDragLeave,
    onDragOver,
    onDragStart,
    onDrop,
    onDragEnd
  }
  return (
    <Flex
      {...flexProps}
    >
      <Flex>
        <Tag
          transfer={{
            typeTo,
            typeFrom,
            error,
            inited
          }}
        />
      </Flex>
      <Flex>
        <span
          className='sftp-file sftp-local-file elli'
          title={fromPath}
        >{fromPathReal || fromPath}
        </span>
      </Flex>
      <Flex>
        <span className='sftp-transfer-arrow'>
          →
        </span>
      </Flex>
      <Flex>
        <span
          className='sftp-file sftp-remote-file elli'
        >{toPathReal || toPath}
        </span>
      </Flex>
      <Flex>
        <span
          className='sftp-file-percent'
        >
          {percent || 0}%
          {speed ? `(${speed})` : null}
        </span>
      </Flex>
      <Flex>
        <span
          className='sftp-file-percent'
        >
          {passedTime || '-'}|{leftTime || '-'}
        </span>
      </Flex>
      <Flex>{controlIcon}</Flex>
      <Flex>{cancelIcon}</Flex>
      <Flex>{toTopIcon}</Flex>
    </Flex>
  )
}
