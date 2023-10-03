/**
 * show terminal info
 * inluding id log path, and system info for remote session
 */

import { InfoCircleOutlined } from '@ant-design/icons'

import { Tooltip } from 'antd'
import './terminal-info.styl'

export default function TerminalInfoIndex (props) {
  const pops = {
    onClick: props.showInfoPanel,
    className: 'pointer font18 terminal-info-icon'
  }
  return (
    <Tooltip
      title='Terminal Info'
    >
      <InfoCircleOutlined
        {...pops}
      />
    </Tooltip>
  )
}
