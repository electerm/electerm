/**
 * btns
 */

import { Component } from '../common/react-subx'
import { FullscreenExitOutlined } from '@ant-design/icons'
import './term-fullscreen.styl'

export default class TermFullscreenControl extends Component {
  handleExitFullscreen = () => {
    this.props.store.toggleTermFullscreen(false)
  }

  render () {
    return (
      <FullscreenExitOutlined
        className='mg1r icon-info font16 pointer spliter term-fullscreen-control'
        onClick={this.handleExitFullscreen}
      />
    )
  }
}
