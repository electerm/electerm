/**
 * bookmark form
 */
import {
  Tabs
} from 'antd'
import { sshTunnelHelpLink } from '../../common/constants'
import HelpIcon from '../common/help-icon'

const { prefix } = window
const e = prefix('form')
const s = prefix('setting')
const h = prefix('ssh')
const q = prefix('quickCommands')

export default function renderTabs (props) {
  const tunnelTag = (
    <span>
      {h('sshTunnel')}
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
      label: s('settings'),
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
      label: q('quickCommands'),
      forceRender: true,
      children: props.qms
    },
    {
      key: 'tunnel',
      label: tunnelTag,
      forceRender: true,
      children: props.renderSshTunnel(props)
    }
  ]
  return (
    <Tabs
      items={items}
    />
  )
}
