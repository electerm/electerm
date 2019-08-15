/**
 * app footer for terminal and others
 */

import { Component } from '../common/react-subx'

export default class Footer extends Component {
  render () {
    const { theme, themes } = this.props.store
    return (
      <div className='footer'>
        <div className='footer-content'>
          <div className='footer-left'>
            {theme}
          </div>
          <div className='footer-right'>
            {themes}
          </div>
        </div>
      </div>
    )
  }
}
