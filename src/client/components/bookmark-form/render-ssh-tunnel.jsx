import {
  Form,
  Input,
  InputNumber,
  Radio,
  Space,
  Button,
  Tooltip
} from 'antd'
import { MinusCircleOutlined, PlusOutlined, QuestionCircleOutlined } from '@ant-design/icons'
import { formItemLayout } from '../../common/form-layout'

const FormItem = Form.Item
const FormList = Form.List
const {
  Button: RadioButton,
  Group: RadioGroup
} = Radio
const { prefix } = window
const e = prefix('ssh')
const s = prefix('sftp')

export default function renderSshTunnel () {
  function renderItem (field, i, add, remove) {
    return (
      <Space
        align='center'
        key={field.key}
      >
        <FormItem
          label={e('sshTunnel')}
          name={[field.name, 'sshTunnel']}
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
        <Space.Compact className='mg2x'>
          <FormItem
            label={s('remote')}
            name={[field.name, 'sshTunnelRemoteHost']}
            required
          >
            <Input
              className='compact-input ssh-tunnels-host'
              placeholder={e('host')}
            />
          </FormItem>
          <FormItem
            label=''
            name={[field.name, 'sshTunnelRemotePort']}
            required
          >
            <InputNumber
              min={1}
              max={65535}
              // addonBefore={e('remotePort')}
              className='compact-input'
              placeholder={e('port')}
            />
          </FormItem>
        </Space.Compact>
        <Space.Compact className='mg2x'>
          <FormItem
            label={s('local')}
            name={[field.name, 'sshTunnelLocalHost']}
            required
          >
            <Input
              className='compact-input ssh-tunnels-host'
              placeholder={e('host')}
            />
          </FormItem>
          <FormItem
            label=''
            name={[field.name, 'sshTunnelLocalPort']}
            required
          >
            <InputNumber
              min={1}
              max={65535}
              // addonBefore={e('localPort')}
              className='compact-input'
              placeholder={e('port')}
            />
          </FormItem>
        </Space.Compact>
        <Button
          icon={<MinusCircleOutlined />}
          onClick={() => remove(field.name)}
          className='mg24b'
        />
      </Space>
    )
  }

  return [
    <FormList
      {...formItemLayout}
      label={e('sshTunnel')}
      name='sshTunnels'
      key='sshTunnels'
    >
      {
        (fields, { add, remove }, { errors }) => {
          return (
            <div>
              {
                fields.map((field, i) => {
                  return renderItem(field, i, add, remove)
                })
              }
              <FormItem>
                <Button
                  type='dashed'
                  onClick={() => add()}
                  block
                  icon={<PlusOutlined />}
                >
                  {e('sshTunnel')}
                </Button>
              </FormItem>
            </div>
          )
        }
      }
    </FormList>
  ]
}
