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

// a local forward and a remote forward need an address on both sides: where the
// tunnel listens and where it points at. The two socks variants are the ones
// that only have a listening side - dynamicForward on our machine,
// remoteDynamicForward on the server.
const needsRemoteRow = (sshTunnel) => sshTunnel !== 'dynamicForward'
const needsLocalRow = (sshTunnel) => sshTunnel !== 'remoteDynamicForward'

export default function SshTunnelForm (props) {
  const {
    formChild,
    initialValues,
    onFinish,
    isEdit
  } = props

  const [dirty, setDirty] = useState(false)

  // watch host/port fields so the tooltip examples reflect what the user typed
  const sshTunnel = Form.useWatch('sshTunnel', formChild) ||
    initialValues?.sshTunnel ||
    'forwardLocalToRemote'
  const localHost = Form.useWatch('sshTunnelLocalHost', formChild) || '127.0.0.1'
  const localPort = Form.useWatch('sshTunnelLocalPort', formChild) || '12200'
  const remoteHost = Form.useWatch('sshTunnelRemoteHost', formChild) || '127.0.0.1'
  const remotePort = Form.useWatch('sshTunnelRemotePort', formChild) || '12300'
  const localAddr = `${localHost}:${localPort}`
  const remoteAddr = `${remoteHost}:${remotePort}`
  const needsRemote = needsRemoteRow(sshTunnel)
  const needsLocal = needsLocalRow(sshTunnel)

  function onSubmit () {
    formChild.submit()
  }

  // mark the form as edited so the add/save button can flash as a reminder
  function handleValuesChange () {
    setDirty(true)
  }

  // called on a successful (validated) submit; clears the flash
  function onFinishLocal (data) {
    setDirty(false)
    onFinish(data)
  }

  function renderSshTunnelFlow (direction) {
    const localToRemote = direction === 'localToRemote'
    const middle = localToRemote ? e('local') : e('remote')
    const last = localToRemote ? e('remote') : e('local')
    return (
      <div>
        <p>{e(direction)}</p>
        <p><UserOutlined /> → {middle} → {last}</p>
        {localToRemote
          ? (
            <p>Connect to <b>{localAddr}</b> on your machine to reach <b>{remoteAddr}</b> on the remote server (e.g. open <b>http://{localAddr}</b> in a browser).</p>
            )
          : (
            <p>Connect to <b>{remoteAddr}</b> on the remote server to reach <b>{localAddr}</b> on your machine.</p>
            )}
      </div>
    )
  }

  function renderDynamicForward () {
    return (
      <div>
        <p><UserOutlined /> → socks proxy → url</p>
        <p>Point your app's SOCKS5 proxy at <b>{localAddr}</b> to reach any host through the remote server.</p>
      </div>
    )
  }

  function renderRemoteDynamicForward () {
    return (
      <div>
        <p><UserOutlined /> → {e('remote')} → socks proxy → url</p>
        <p>Point your app's SOCKS5 proxy at <b>{remoteAddr}</b> on the remote server to reach any host through your own network.</p>
        <p>The remote sshd has to allow remote forwarding.</p>
      </div>
    )
  }

  function renderRemote () {
    if (!needsRemote) {
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

  function renderLocal () {
    if (!needsLocal) {
      return null
    }
    return (
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
    )
  }

  return (
    <Form
      form={formChild}
      onFinish={onFinishLocal}
      onValuesChange={handleValuesChange}
      initialValues={initialValues}
      component='div'
    >
      <FormItem
        label={e('sshTunnel')}
        name='sshTunnel'
        {...formItemLayout}
        required
      >
        <RadioGroup>
          <RadioButton value='forwardLocalToRemote'>
            <Tooltip title={renderSshTunnelFlow('localToRemote')}>
              <span>L→R <QuestionCircleOutlined /></span>
            </Tooltip>
          </RadioButton>
          <RadioButton value='forwardRemoteToLocal'>
            <Tooltip title={renderSshTunnelFlow('remoteToLocal')}>
              <span>R→L <QuestionCircleOutlined /></span>
            </Tooltip>
          </RadioButton>
          <RadioButton value='dynamicForward'>
            <Tooltip title={renderDynamicForward()}>
              <span>-D socks <QuestionCircleOutlined /></span>
            </Tooltip>
          </RadioButton>
          <RadioButton value='remoteDynamicForward'>
            <Tooltip title={renderRemoteDynamicForward()}>
              <span>-R socks <QuestionCircleOutlined /></span>
            </Tooltip>
          </RadioButton>
        </RadioGroup>
      </FormItem>
      {renderRemote()}
      {renderLocal()}
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
          className={dirty ? 'btn-flash' : ''}
        >
          {isEdit ? e('save') : e('sshTunnel')}
        </Button>
      </FormItem>
    </Form>
  )
}
