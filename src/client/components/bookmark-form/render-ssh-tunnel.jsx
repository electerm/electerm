
import {
  Form,
  InputNumber,
  Radio
} from 'antd'

import { formItemLayout } from '../../common/form-layout'

const FormItem = Form.Item
const {
  Button: RadioButton,
  Group: RadioGroup
} = Radio
const { prefix } = window
const e = prefix('ssh')
const c = prefix('common')

export default function renderSshTunnel () {
  return [
    <FormItem
      {...formItemLayout}
      label={e('sshTunnel')}
      name='sshTunnel'
      key='sshTunnel'
    >
      <RadioGroup>
        <RadioButton value=''>{c('turnOff')}</RadioButton>
        <RadioButton value='forwardRemoteToLocal'>{e('remoteToLocal')}</RadioButton>
        <RadioButton value='forwardLocalToRemote'>{e('localToRemote')}</RadioButton>
      </RadioGroup>
    </FormItem>,
    <FormItem
      {...formItemLayout}
      label={e('remotePort')}
      name='sshTunnelRemotePort'
      key='sshTunnelRemotePort'
    >
      <InputNumber />
    </FormItem>,
    <FormItem
      {...formItemLayout}
      label={e('localPort')}
      name='sshTunnelLocalPort'
      key='sshTunnelLocalPort'
    >
      <InputNumber />
    </FormItem>
  ]
}
