import {
  Form,
  Input,
  InputNumber,
  Radio,
  Space,
  Button,
  Tooltip,
  Table
} from 'antd'
import { useState } from 'react'
import { PlusOutlined, QuestionCircleOutlined, MinusCircleFilled, UserOutlined } from '@ant-design/icons'
import { formItemLayout, tailFormItemLayout } from '../../common/form-layout'
import uid from '../../common/uid'

const FormItem = Form.Item
const {
  Button: RadioButton,
  Group: RadioGroup
} = Radio
const e = window.translate

export default function renderSshTunnels (props) {
  const {
    form,
    formData
  } = props
  const [formChild] = Form.useForm()
  const [initialValues] = useState({
    sshTunnelLocalPort: 12200,
    sshTunnelLocalHost: '127.0.0.1',
    sshTunnelRemotePort: 12300,
    sshTunnelRemoteHost: '127.0.0.1'
  })
  const [isDynamic, setter] = useState(formData.sshTunnel === 'dynamicForward')
  const [list, setList] = useState(formData.sshTunnels || [])
  function onSubmit () {
    formChild.submit()
  }
  function onChange (e) {
    setter(e.target.value === 'dynamicForward')
  }
  function handleFinish (data) {
    const nd = {
      ...data,
      id: uid()
    }
    const v = [
      ...form.getFieldValue('sshTunnels'),
      nd
    ]
    form.setFieldsValue({
      sshTunnels: v
    })
    setList(old => {
      return [
        ...old,
        data
      ]
    })
    formChild.resetFields()
  }

  function remove (id) {
    setList(old => {
      return old.filter(i => i.id !== id)
    })
    const v = form.getFieldValue('sshTunnels').filter(i => i.id !== id)
    form.setFieldsValue({
      sshTunnels: v
    })
    formChild.resetFields()
  }
  const cols = [
    {
      title: 'NO.',
      dataIndex: 'index',
      key: 'index',
      render: (k) => k
    }, {
      title: e('sshTunnel'),
      key: 'sshTunnel',
      render: (k, item) => {
        // sshTunnel is forwardRemoteToLocal or forwardLocalToRemote or dynamicForward
        const {
          sshTunnel,
          sshTunnelRemoteHost = '127.0.0.1',
          sshTunnelRemotePort = '',
          sshTunnelLocalHost = '127.0.0.1',
          sshTunnelLocalPort = '',
          name
        } = item
        if (sshTunnel === 'dynamicForward') {
          const n = name ? `[${name}] ` : ''
          return `${n}socks5://${sshTunnelLocalHost}:${sshTunnelLocalPort}`
        }
        const to = sshTunnel === 'forwardRemoteToLocal'
          ? `${e('local')}:${sshTunnelLocalHost}:${sshTunnelLocalPort}`
          : `${e('remote')}:${sshTunnelRemoteHost}:${sshTunnelRemotePort}`
        const from = sshTunnel === 'forwardRemoteToLocal'
          ? `${e('remote')}:${sshTunnelRemoteHost}:${sshTunnelRemotePort}`
          : `${e('local')}:${sshTunnelLocalHost}:${sshTunnelLocalPort}`
        return (
          <span>
            {name ? `[${name}] ` : ''}→ {from} → {to}
          </span>
        )
      }
    }, {
      title: e('del'),
      key: 'op',
      dataIndex: 'id',
      render: (id) => {
        return (
          <MinusCircleFilled
            className='pointer'
            onClick={() => remove(id)}
          />
        )
      }
    }
  ]

  function renderList () {
    return (
      <FormItem {...tailFormItemLayout}>
        <Table
          columns={cols}
          className='mg3b'
          pagination={false}
          size='small'
          dataSource={list.map((d, i) => {
            return {
              ...d,
              index: i + 1
            }
          })}
        />
      </FormItem>
    )
  }

  // direction = localToRemote or remoteToLocal, should render user, remote port, local port visit directions connected with arrows accordingly
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
    <div>
      <FormItem
        name='sshTunnels'
        className='hide'
      >
        <Input />
      </FormItem>
      <Form
        form={formChild}
        onFinish={handleFinish}
        initialValues={initialValues}
      >
        {renderList()}
        <FormItem
          label={e('sshTunnel')}
          name='sshTunnel'
          {...formItemLayout}
          required
        >
          <RadioGroup onChange={onChange}>
            <RadioButton
              value='forwardRemoteToLocal'
            >
              <Tooltip title={renderSshTunnelFlow('remoteToLocal')}>
                <span>R→L <QuestionCircleOutlined /></span>
              </Tooltip>
            </RadioButton>
            <RadioButton
              value='forwardLocalToRemote'
            >
              <Tooltip title={renderSshTunnelFlow('localToRemote')}>
                <span>L→R <QuestionCircleOutlined /></span>
              </Tooltip>
            </RadioButton>
            <RadioButton
              value='dynamicForward'
            >
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
                // addonBefore={e('localPort')}
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
            icon={<PlusOutlined />}
            onClick={onSubmit}
          >
            {e('sshTunnel')}
          </Button>
        </FormItem>
      </Form>
    </div>
  )
}
