/**
 * show item in folder
 */

import { memo } from 'react'
import { Icon } from 'antd'

function onClick (e, href) {
  e.preventDefault()
  window.getGlobal('showItemInFolder')(href)
}

export default memo(props => {
  const { to, children = '', ...rest } = props
  return (
    <a
      href={to}
      onClick={e => onClick(e, to)}
      {...rest}
    >
      {children} <Icon type='folder-open' />
    </a>
  )
})
