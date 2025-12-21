import { Popconfirm, Popover } from 'antd'
import { CloseOutlined, CopyOutlined } from '@ant-design/icons'
import { copy } from '../../common/clipboard'

const e = window.translate

export default function WidgetInstance ({ item }) {
  const { id, title, serverInfo } = item
  const cls = 'item-list-unit'
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
  const popoverContent = serverInfo
    ? (
      <div>
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
  const titleDiv = (
    <div
      title={title}
      className='elli pd1y pd2x list-item-title'
    >
      {title}
    </div>
  )
  return (
    <div
      key={id}
      className={cls}
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
      <Popconfirm
        {...popProps}
      >
        {icon}
      </Popconfirm>
    </div>
  )
}
