/**
 * external link, will be opened with default browser
 */

import { memo } from 'react'
import { Icon } from 'antd'

window.open = (url) => {
  window.getGlobal('openExternal')(url)
}

function onClick (e, href) {
  e.preventDefault()
  window.getGlobal('openExternal')(href)
}

export default memo(props => {
  const { to, children, ...rest } = props
  return (
    <a
      href={to}
      onClick={e => onClick(e, to)}
      {...rest}
    >
      {children} <Icon type='link' />
    </a>
  )
})
