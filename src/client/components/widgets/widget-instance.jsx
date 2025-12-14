import { Popconfirm } from 'antd'
import { CloseOutlined } from '@ant-design/icons'

const e = window.translate

export default function WidgetInstance ({ item }) {
  const { id, title } = item
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
  return (
    <div
      key={id}
      className={cls}
    >
      <div
        title={title}
        className='elli pd1y pd2x list-item-title'
      >
        {title}
      </div>
      <Popconfirm
        {...popProps}
      >
        {icon}
      </Popconfirm>
    </div>
  )
}
