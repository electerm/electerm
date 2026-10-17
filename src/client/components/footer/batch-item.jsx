import {
  Button
} from 'antd'
import {
  CheckCircleOutlined
} from '@ant-design/icons'
import createName from '../../common/create-title'

export default function BatchInputTabItem (props) {
  function handleSelect (id) {
    props.onSelect(
      props.id
    )
  }

  const { tab, selected, isCurrent } = props
  const title = createName(tab)
  const btnProps = {
    className: 'mg1r mg1b batch-tab-item',
    onClick: handleSelect,
    title,
    type: selected ? 'primary' : 'default'
  }
  const icon = selected ? <CheckCircleOutlined className='mg1r' /> : null
  const pre = isCurrent ? <b>*</b> : ''
  return (
    <Button
      {...btnProps}
    >
      {pre} {icon} <span className='batch-tab-title'>{tab.tabCount}. {title}</span>
    </Button>
  )
}
