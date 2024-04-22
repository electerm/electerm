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
import { PlusOutlined, QuestionCircleOutlined, MinusCircleFilled } from '@ant-design/icons'
import { formItemLayout, tailFormItemLayout } from '../../common/form-layout'
import uid from '../../common/uid'

const FormItem = Form.Item
const {
  Button: RadioButton,
  Group: RadioGroup
} = Radio
const { prefix } = window
const e = prefix('ssh')
const s = prefix('sftp')
const m = prefix('menu')

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
  const [list, setList] = useState(formData.sshTunnels || [])
  function onSubmit () {
    formChild.submit()
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
        // sshTunnel is forwardRemoteToLocal or forwardLocalToRemote
        const {
          sshTunnel,
          sshTunnelRemoteHost = '127.0.0.1',
          sshTunnelRemotePort,
          sshTunnelLocalHost = '127.0.0.1',
          sshTunnelLocalPort,
          name
        } = item
        const to = sshTunnel === 'forwardRemoteToLocal'
          ? `${s('local')}:${sshTunnelLocalHost}:${sshTunnelLocalPort}`
          : `${s('remote')}:${sshTunnelRemoteHost}:${sshTunnelRemotePort}`
        const from = sshTunnel === 'forwardRemoteToLocal'
          ? `${s('remote')}:${sshTunnelRemoteHost}:${sshTunnelRemotePort}`
          : `${s('local')}:${sshTunnelLocalHost}:${sshTunnelLocalPort}`
        return (
          <span>
            {name ? `[${name}] ` : ''}→ {from} → {to}
          </span>
        )
      }
    }, {
      title: m('del'),
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
          <RadioGroup>
            <RadioButton
              value='forwardRemoteToLocal'
            >
              <Tooltip title={e('remoteToLocal')}>
                <span>R→L <QuestionCircleOutlined /></span>
              </Tooltip>
            </RadioButton>
            <RadioButton
              value='forwardLocalToRemote'
            >
              <Tooltip title={e('localToRemote')}>
                <span>L→R <QuestionCircleOutlined /></span>
              </Tooltip>
            </RadioButton>
          </RadioGroup>
        </FormItem>
        <FormItem
          label={s('remote')}
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
        <FormItem
          label={s('local')}
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
          label={s('name')}
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
