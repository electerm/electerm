/**
 * open item in folder
 */

import { memo } from 'react'
import { Icon } from 'antd'
import fs from '../../common/fs'

function onClick (e, href) {
  e.preventDefault()
  fs.openFile(href).catch(e => {
    log.error(e)
    window.getGlabal('showItemInFolder')(href)
  })
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
