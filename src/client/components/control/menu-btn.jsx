/**
 * btns
 */

import React from 'react'
import {
  Icon
} from 'antd'
const {prefix} = window
const e = prefix('control')
const onOpenMenu = e => {
  let {right: x, bottom: y} = e.currentTarget.getBoundingClientRect()
  x = Math.ceil(x - 15)
  y = Math.ceil(x - 12)
  window.getGlobal('popup')({
    x,
    y
  })
}

export default class MenuBtns extends React.PureComponent {
  render() {
    return (
      <span
        className="mg2r mg1l iblock menu-control"
        onClick={onOpenMenu}
        title={e('menu')}
      >
        <Icon type="bars" />
      </span>
    )
  }
}
