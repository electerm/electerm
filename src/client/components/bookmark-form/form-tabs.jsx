/**
 * bookmark form
 */
import {
  Tabs
} from 'antd'
import { sshTunnelHelpLink } from '../../common/constants'
import helpIcon from '../common/help-icon'

const { TabPane } = Tabs
const { prefix } = window
const e = prefix('form')
const s = prefix('setting')
const h = prefix('ssh')
const q = prefix('quickCommands')

export default function renderTabs (props) {
  const tunnelTag = (
    <span>
      {h('sshTunnel')}
      <helpIcon
        link={sshTunnelHelpLink}
      />
    </span>
  )
  return (
    <Tabs>
      <TabPane tab={e('auth')} key='auth' forceRender>
        {props.renderCommon(props)}
      </TabPane>
      <TabPane tab={s('settings')} key='settings' forceRender>
        {props.renderEnableSftp()}
        {props.uis}
        {props.renderProxy(props)}
        {props.renderX11()}
      </TabPane>
      <TabPane tab={q('quickCommands')} key='quickCommands' forceRender>
        {props.qms}
      </TabPane>
      <TabPane tab={tunnelTag} key='sshTunnel' forceRender>
        {props.renderSshTunnel()}
      </TabPane>
    </Tabs>
  )
}
