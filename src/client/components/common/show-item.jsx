/**
 * show item in folder
 * // todo rerender check
 */

import { memo } from 'react'
import { FolderOpenOutlined } from '@ant-design/icons'
// import { isMac } from '../../common/constants'
// import fs from '../../common/fs'

function onClick (e, href) {
  e.preventDefault()
  window.pre.showItemInFolder(href)
}

export default memo(props => {
  const { to, children = '', ...rest } = props
  return (
    <a
      href={to}
      onClick={e => onClick(e, to)}
      {...rest}
    >
      {children} <FolderOpenOutlined />
    </a>
  )
})
