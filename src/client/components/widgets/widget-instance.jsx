import {
  Popconfirm,
  Popover,
  Tooltip,
  Tag
} from 'antd'
import { CloseOutlined, CopyOutlined, ThunderboltOutlined } from '@ant-design/icons'
import { copy } from '../../common/clipboard'
import classnames from 'classnames'
import { auto } from 'manate/react'

const e = window.translate

export default auto(function WidgetInstance ({ item, active, onClick }) {
  const { id, title, serverInfo, autoRun } = item
  const cls = classnames('item-list-unit', {
    'autorun-active': autoRun,
    active
  })
  const delProps = {
    title: e('del'),
    className: 'pointer list-item-remove'
  }
  const icon = (
    <CloseOutlined
      {...delProps}
    />
  )
  function onConfirm () {
    window.store.stopWidget(id)
  }
  // the row itself opens the instance detail, so the action icons must not
  // also trigger it
  function stopPropagation (evt) {
    evt.stopPropagation()
  }
  function handleClick () {
    if (onClick) {
      onClick(item)
    }
  }
  const popProps = {
    title: e('del') + '?',
    onConfirm,
    okText: e('del'),
    cancelText: e('cancel'),
    placement: 'top'
  }
  const handleCopy = () => {
    if (serverInfo && serverInfo.url) {
      copy(serverInfo.url)
    }
  }
  const handleToggleAutoRun = () => {
    window.store.toggleAutoRunWidget(item)
  }
  const popoverContent = serverInfo
    ? (
      <div className='wil-pop-info'>
        <div style={{ display: 'flex', alignItems: 'center' }}>
          <span>URL: {serverInfo.url}</span>
          <CopyOutlined
            className='pointer mg1l'
            onClick={handleCopy}
          />
        </div>
        <div>Path: {serverInfo.path}</div>
      </div>
      )
    : null
  const tag = autoRun ? <Tag color='green'>{e('autoRun')}</Tag> : null
  const titleDiv = (
    <div
      title={title}
      className='elli pd1y pd2x list-item-title'
    >
      {tag} {title}
    </div>
  )
  return (
    <div
      key={id}
      className={cls}
      onClick={handleClick}
    >
      {
        serverInfo
          ? (
            <Popover
              content={popoverContent}
              trigger='hover'
              placement='top'
            >
              {titleDiv}
            </Popover>
            )
          : titleDiv
      }
      <div
        className='wil-item-actions'
        onClick={stopPropagation}
      >
        <Tooltip title='Toggle auto-run'>
          <ThunderboltOutlined
            className='pointer list-item-autorun'
            onClick={handleToggleAutoRun}
          />
        </Tooltip>
        <Popconfirm
          {...popProps}
        >
          {icon}
        </Popconfirm>
      </div>
    </div>
  )
})
