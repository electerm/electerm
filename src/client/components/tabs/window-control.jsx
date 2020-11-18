/**
 * btns
 */

import { memo } from 'react'
import { CloseOutlined, MinusOutlined } from '@ant-design/icons'

const { prefix } = window
const m = prefix('menu')

export default memo(props => {
  const {
    isMaximized,
    closeApp
  } = props
  const minimize = () => {
    window.pre.runGlobalAsync('minimize')
  }
  const maximize = () => {
    window.pre.runGlobalAsync('maximize')
  }
  const unmaximize = () => {
    window.pre.runGlobalAsync('unmaximize')
  }
  return (
    <div className='window-controls'>
      <div className='window-control-box window-control-minimize' onClick={minimize}>
        <MinusOutlined title={m('minimize')} className='iblock font12 widnow-control-icon' />
      </div>
      <div className='window-control-box window-control-maximize'
        onClick={
          isMaximized ? unmaximize : maximize
        }>
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
})
