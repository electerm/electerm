/**
 * external link, will be opened with default browser
 */

import React from 'react'

function onClick(e, href) {
  e.preventDefault()
  window.getGlobal('openExternal')(href)
}

export default class Transports extends React.PureComponent {
  render() {
    let {to, children, ...rest} = this.props
    return (
      <a
        href={to}
        onClick={e => onClick(e, to)}
        {...rest}
      >
        {children}
      </a>
    )
  }
}
