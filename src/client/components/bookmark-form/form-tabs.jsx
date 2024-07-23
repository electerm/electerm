/**
 * bookmark form
 */
import {
  Tabs
} from 'antd'
import { sshTunnelHelpLink } from '../../common/constants'
import HelpIcon from '../common/help-icon'

const e = window.translate

export default function renderTabs (props) {
  const tunnelTag = (
    <span>
      {e('sshTunnel')}
      <HelpIcon
        link={sshTunnelHelpLink}
      />
    </span>
  )
  const items = [
    {
      key: 'auth',
      label: e('auth'),
      forceRender: true,
      children: props.renderCommon(props)
    },
    {
      key: 'settings',
      label: e('settings'),
      forceRender: true,
      children: (
        <div>
          {props.renderEnableSftp()}
          {props.uis}
          {props.renderProxy(props)}
          {props.renderX11()}
        </div>
      )
    },
    {
      key: 'quickCommands',
      label: e('quickCommands'),
      forceRender: true,
      children: props.qms
    },
    {
      key: 'tunnel',
      label: tunnelTag,
      forceRender: true,
      children: props.renderSshTunnel(props)
    },
    {
      key: 'connectionHopping',
      label: e('connectionHopping'),
      forceRender: true,
      children: props.renderConnectionHopping(props)
    }
  ]
  return (
    <Tabs
      items={items}
    />
  )
}
