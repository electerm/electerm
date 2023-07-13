import { memo } from 'react'
import Link from './external-link'
import {
  Tooltip
} from 'antd'
import { QuestionCircleOutlined } from '@ant-design/icons'

export default memo(props => {
  const { link, title, ...rest } = props
  const cont = title || (
    <span>
      <Link to={link}>{link}</Link>
    </span>
  )
  return (
    <Tooltip
      title={cont}
      {...rest}
    >
      <span className='mg1l'>
        <QuestionCircleOutlined />
      </span>
    </Tooltip>
  )
})
