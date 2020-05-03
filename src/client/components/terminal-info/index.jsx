/**
 * show terminal info
 * inluding id log path, and system info for remote session
 */

import { Tooltip, Icon } from 'antd'
import './terminal-info.styl'

export default function TerminalInfoIndex (props) {
  return (
    <Tooltip
      title='Terminal Info'
    >
      <Icon
        type='info-circle'
        onClick={props.showInfoPanel}
        className='pointer font18 terminal-info-icon'
      />
    </Tooltip>
  )
}
