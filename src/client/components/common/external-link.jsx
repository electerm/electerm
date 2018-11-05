/**
 * external link, will be opened with default browser
 */

import {memo} from 'react'

function onClick(e, href) {
  e.preventDefault()
  window.getGlobal('openExternal')(href)
}

export default memo(props => {
  let {to, children, ...rest} = props
  return (
    <a
      href={to}
      onClick={e => onClick(e, to)}
      {...rest}
    >
      {children}
    </a>
  )
})
