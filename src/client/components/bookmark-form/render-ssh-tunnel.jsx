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
            label={e('destination')}
            name={[field.name, 'sshTunnelRemoteHost']}
            initialValue={'127.0.0.1'}
            required
          >
            <Input
              className='compact-input'
              placeholder={e('host')}
            />
          </FormItem>
          <FormItem
            label=''
            name={[field.name, 'sshTunnelRemotePort']}
            initialValue={22}
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
        <FormItem
          label={e('localPort')}
          name={[field.name, 'sshTunnelLocalPort']}
          initialValue={22}
          required
          className='mg2x'
        >
          <InputNumber
            min={1}
            max={65535}
            // addonBefore={e('localPort')}
            className='compact-input'
            placeholder={e('port')}
          />
        </FormItem>
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
