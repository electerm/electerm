import {
  Form,
  Input,
  InputNumber,
  Radio,
  Space,
  Button,
  Tooltip
} from 'antd'
import {
  PlusOutlined,
  QuestionCircleOutlined,
  SaveOutlined,
  UserOutlined
} from '@ant-design/icons'
import { formItemLayout, tailFormItemLayout } from '../../../common/form-layout'
import { useState } from 'react'

const FormItem = Form.Item
const {
  Button: RadioButton,
  Group: RadioGroup
} = Radio
const e = window.translate

export default function SshTunnelForm (props) {
  const {
    formChild,
    initialValues,
    onFinish,
    isEdit
  } = props

  const [isDynamic, setIsDynamic] = useState(
    (initialValues?.sshTunnel || 'forwardRemoteToLocal') === 'dynamicForward'
  )

  function onChange (ev) {
    setIsDynamic(ev.target.value === 'dynamicForward')
  }

  function onSubmit () {
    formChild.submit()
  }

  function renderSshTunnelFlow (direction) {
    const localToRemote = direction === 'localToRemote'
    const middle = localToRemote ? e('local') : e('remote')
    const last = localToRemote ? e('remote') : e('local')
    return (
      <div>
        <p>{e(direction)}</p>
        <p><UserOutlined /> → {middle} → {last}</p>
      </div>
    )
  }

  function renderDynamicForward () {
    return (
      <p><UserOutlined /> → socks proxy → url</p>
    )
  }

  function renderRemote () {
    if (isDynamic) {
      return null
    }
    return (
      <FormItem
        label={e('remote')}
        {...formItemLayout}
        required
        className='ssh-tunnels-host'
      >
        <Space.Compact>
          <FormItem
            name='sshTunnelRemoteHost'
            label=''
            required
          >
            <Input
              placeholder={e('host')}
            />
          </FormItem>
          <FormItem
            label=''
            name='sshTunnelRemotePort'
            required
          >
            <InputNumber
              min={1}
              max={65535}
              placeholder={e('port')}
            />
          </FormItem>
        </Space.Compact>
      </FormItem>
    )
  }

  return (
    <Form
      form={formChild}
      onFinish={onFinish}
      initialValues={initialValues}
      component='div'
    >
      <FormItem
        label={e('sshTunnel')}
        name='sshTunnel'
        {...formItemLayout}
        required
      >
        <RadioGroup onChange={onChange}>
          <RadioButton value='forwardRemoteToLocal'>
            <Tooltip title={renderSshTunnelFlow('remoteToLocal')}>
              <span>R→L <QuestionCircleOutlined /></span>
            </Tooltip>
          </RadioButton>
          <RadioButton value='forwardLocalToRemote'>
            <Tooltip title={renderSshTunnelFlow('localToRemote')}>
              <span>L→R <QuestionCircleOutlined /></span>
            </Tooltip>
          </RadioButton>
          <RadioButton value='dynamicForward'>
            <Tooltip title={renderDynamicForward()}>
              <span>{e('dynamicForward')}(socks proxy) <QuestionCircleOutlined /></span>
            </Tooltip>
          </RadioButton>
        </RadioGroup>
      </FormItem>
      {renderRemote()}
      <FormItem
        label={e('local')}
        {...formItemLayout}
        required
        className='ssh-tunnels-host'
      >
        <Space.Compact>
          <FormItem
            name='sshTunnelLocalHost'
            label=''
            required
          >
            <Input
              placeholder={e('host')}
            />
          </FormItem>
          <FormItem
            label=''
            name='sshTunnelLocalPort'
            required
          >
            <InputNumber
              min={1}
              max={65535}
              placeholder={e('port')}
            />
          </FormItem>
        </Space.Compact>
      </FormItem>
      <FormItem
        name='name'
        label={e('name')}
        {...formItemLayout}
      >
        <Input
          placeholder={e('name')}
        />
      </FormItem>
      <FormItem {...tailFormItemLayout} className='mg60b'>
        <Button
          type='default'
          htmlType='button'
          icon={isEdit ? <SaveOutlined /> : <PlusOutlined />}
          onClick={onSubmit}
        >
          {isEdit ? e('save') : e('sshTunnel')}
        </Button>
      </FormItem>
    </Form>
  )
}
