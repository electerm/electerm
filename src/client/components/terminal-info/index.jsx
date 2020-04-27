/**
 * show terminal info
 * inluding id log path, and system info for remote session
 */

import { Popover, Icon } from 'antd'
import TerminalInfoContent from './content'

export default function TerminalInfoIndex (props) {
  return (
    <Popover
      title='Terminal Info'
      content={<TerminalInfoContent {...props} />}
    >
      <Icon
        type='info-circle'
        className='pointer font18'
      />
    </Popover>
  )
}
