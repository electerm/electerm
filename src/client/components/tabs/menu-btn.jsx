/**
 * btns
 */

import {memo} from 'react'

const {prefix} = window
const e = prefix('control')
const onOpenMenu = (e) => {
  let {right: x, bottom: y} = e.currentTarget.getBoundingClientRect()
  x = Math.ceil(x - 15)
  y = Math.ceil(x - 12)
  window.getGlobal('popup')({
    x,
    y
  })
}
const logo = require('node_modules/@electerm/electerm-resource/res/imgs/electerm.svg').replace(/^\//, '')

export default memo(() => {
  return (
    <span
      className="mg2r mg1l iblock menu-control"
      onMouseDown={evt => evt.preventDefault()}
      onClick={onOpenMenu}
      title={e('menu')}
    >
      <img src={logo} width={28} height={28} />
    </span>
  )
})
