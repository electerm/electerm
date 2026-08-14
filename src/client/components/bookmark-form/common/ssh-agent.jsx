import React from 'react'
import { Form, Input, Space } from 'antd'
import SwitchLabel from '../../common/switch'
import HelpIcon from '../../common/help-icon'
import { verticalFormItemLayout } from '../../../common/form-layout'

const FormItem = Form.Item
const e = window.translate

export default function SshAgent () {
  return (
    <FormItem
      {...verticalFormItemLayout}
      label={e('useSshAgent')}
    >
      <Space align='center'>
        <FormItem
          name='useSshAgent'
          valuePropName='checked'
          noStyle
        >
          <SwitchLabel />
        </FormItem>
        <FormItem
          name='sshAgent'
          noStyle
        >
          <Input placeholder={e('SSH Agent Path')} />
        </FormItem>
        <HelpIcon link='https://github.com/electerm/electerm/wiki/ssh-agent' />
      </Space>
    </FormItem>
  )
}
