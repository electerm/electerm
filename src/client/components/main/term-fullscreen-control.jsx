/**
 * btns
 */

import { FullscreenExitOutlined } from '@ant-design/icons'
import './term-fullscreen.styl'

export default function TermFullscreenControl (props) {
  const handleExitFullscreen = () => {
    window.store.toggleTermFullscreen(false)
  }
  if (!props.terminalFullScreen) {
    return null
  }
  return (
    <FullscreenExitOutlined
      className='mg1r icon-info font16 pointer spliter term-fullscreen-control'
      onClick={handleExitFullscreen}
    />
  )
}
