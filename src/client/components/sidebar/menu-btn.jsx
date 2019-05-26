/**
 * btns
 */

import { Component } from '../common/react-subx'

const { prefix } = window
const e = prefix('control')

const logo = require('node_modules/@electerm/electerm-resource/res/imgs/electerm.svg').replace(/^\//, '')

export default class MenuBtn extends Component {
  render () {
    const { store } = this.props
    return (
      <div
        className='menu-control'
        key='menu-control'
        onMouseDown={evt => evt.preventDefault()}
        onClick={() => {
          store.menuOpened
            ? store.closeMenu()
            : store.openMenu()
        }}
        title={e('menu')}
      >
        <img src={logo} width={28} height={28} />
      </div>
    )
  }
}
