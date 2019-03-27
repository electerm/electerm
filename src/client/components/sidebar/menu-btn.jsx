/**
 * btns
 */

import './menu.styl'

const {prefix} = window
const e = prefix('control')

const logo = require('node_modules/@electerm/electerm-resource/res/imgs/electerm.svg').replace(/^\//, '')

export default (props) => {
  return (
    <div
      className="menu-control"
      key="menu-control"
      onMouseDown={evt => evt.preventDefault()}
      onClick={() => {
        props.menuOpened
          ? props.closeMenu()
          : props.openMenu()
      }}
      title={e('menu')}
    >
      <img src={logo} width={28} height={28} />
    </div>
  )
}
