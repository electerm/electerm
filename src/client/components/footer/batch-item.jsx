import {
  Button
} from 'antd'
import { CheckCircle } from 'lucide-react'
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
    className: 'mg1r mg1b iblock',
    onClick: handleSelect,
    title,
    type: selected ? 'primary' : 'default'
  }
  const icon = selected ? <CheckCircle className='mg1r' /> : null
  const pre = isCurrent ? <b>*</b> : ''
  return (
    <Button
      {...btnProps}
    >
      {pre} {icon} {tab.tabCount}. {title}
    </Button>
  )
}
