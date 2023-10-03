/**
 * btns
 */

import { CloseOutlined, MinusOutlined } from '@ant-design/icons'
import { Component } from '../common/react-subx'

const { prefix } = window
const m = prefix('menu')

export default class WindowControl extends Component {
  render () {
    const {
      isMaximized
    } = this.props.store
    const minimize = () => {
      window.pre.runGlobalAsync('minimize')
    }
    const maximize = () => {
      window.pre.runGlobalAsync('maximize')
    }
    const unmaximize = () => {
      window.pre.runGlobalAsync('unmaximize')
    }
    const closeApp = () => {
      window.store.exit()
    }
    return (
      <div className='window-controls'>
        <div className='window-control-box window-control-minimize' onClick={minimize}>
          <MinusOutlined title={m('minimize')} className='iblock font12 widnow-control-icon' />
        </div>
        <div
          className='window-control-box window-control-maximize'
          onClick={
            isMaximized ? unmaximize : maximize
          }
        >
          <span
            title={
              isMaximized ? m('unmaximize') : m('maximize')
            }
            className={
              'iblock font12 icon-maximize widnow-control-icon ' +
                (isMaximized ? 'is-max' : 'not-max')
            }
          />
        </div>
        <div className='window-control-box window-control-close' onClick={closeApp}>
          <CloseOutlined title={m('close')} className='iblock font12 widnow-control-icon' />
        </div>
      </div>
    )
  }
}
