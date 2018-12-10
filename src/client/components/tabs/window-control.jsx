/**
 * btns
 */

import {memo} from 'react'
import {
  Icon
} from 'antd'

const {prefix} = window
const m = prefix('menu')

export default memo(props => {
  let {
    isMaximized
  } = props
  let minimize = () => {
    window.getGlobal('minimize')()
  }
  let maximize = () => {
    window.getGlobal('maximize')()
  }
  let unmaximize = () => {
    window.getGlobal('unmaximize')()
  }
  let closeApp = () => {
    window.getGlobal('closeApp')()
  }
  return (
    <div className="window-controls">
      <Icon
        type="minus"
        title={m('minimize')}
        className="mg1r iblock pointer font12 widnow-control-icon"
        onClick={minimize}
      />
      <span
        title={
          isMaximized ? m('unmaximize') : m('maximize')
        }
        className={
          'mg1r iblock pointer font12 icon-maximize widnow-control-icon ' +
            (isMaximized ? 'is-max' : 'not-max')
        }
        onClick={
          isMaximized ? unmaximize : maximize
        }
      />
      <Icon
        type="close"
        title={m('close')}
        className="iblock pointer font10 widnow-control-icon"
        onClick={closeApp}
      />
    </div>
  )
})
