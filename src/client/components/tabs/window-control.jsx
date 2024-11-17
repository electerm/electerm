/**
 * btns
 */

import { CloseOutlined, MinusOutlined } from '@ant-design/icons'
import { auto } from 'manate/react'
import {
  isMacJs
} from '../../common/constants'

const e = window.translate

export default auto(function WindowControl (props) {
  const {
    isMaximized,
    config
  } = props.store
  if (config.useSystemTitleBar || isMacJs) {
    return null
  }
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
        <MinusOutlined title={e('minimize')} className='iblock font12 widnow-control-icon' />
      </div>
      <div
        className='window-control-box window-control-maximize'
        onClick={
          isMaximized ? unmaximize : maximize
        }
      >
        <span
          title={
            isMaximized ? e('unmaximize') : e('maximize')
          }
          className={
            'iblock font12 icon-maximize widnow-control-icon ' +
              (isMaximized ? 'is-max' : 'not-max')
          }
        />
      </div>
      <div className='window-control-box window-control-close' onClick={closeApp}>
        <CloseOutlined title={e('close')} className='iblock font12 widnow-control-icon' />
      </div>
    </div>
  )
})
