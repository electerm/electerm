
import {
  Input,
  InputNumber,
  Select,
  Form
} from 'antd'
import { formItemLayout, tailFormItemLayout } from '../../common/form-layout'

const FormItem = Form.Item
const { Option } = Select
const { prefix } = window
const e = prefix('form')
const sh = prefix('ssh')

function renderProxySelect (props) {
  const { form } = props
  const proxyList = props.bookmarks
    .reduce((prev, current) => {
      const { proxy } = current
      const {
        proxyIp,
        proxyPort,
        proxyType
      } = proxy || {}
      if (!proxy || !proxyIp || !proxyPort) {
        return prev
      }
      let pre = `socks${proxyType}`
      if (proxyType === '0') {
        pre = 'http'
      } else if (proxyType === '1') {
        pre = 'https'
      }
      const id = `${pre}://${proxyIp}:${proxyPort}`
      return {
        ...prev,
        [id]: proxy
      }
    }, {})
  const keys = Object.keys(proxyList)
  if (!keys.length) {
    return null
  }
  const cl = sh('clear')
  proxyList[cl] = {
    proxyIp: '',
    proxyPort: '',
    proxyType: '5'
  }
  keys.unshift(cl)
  return (
    <FormItem
      {...tailFormItemLayout}
      className='mg0'
      key='proxy-select'
    >
      <Select
        placeholder={e('selectProxy')}
        value={undefined}
        onSelect={
          v => {
            if (v === cl) {
              return props.onSelectProxy(proxyList[v], form)
            }
            return props.onSelectProxy(proxyList[v], form)
          }
        }
      >
        {
          keys.map(k => {
            return (
              <Option
                value={k}
                key={k}
              >
                {k}
              </Option>
            )
          })
        }
      </Select>
    </FormItem>
  )
}
export default function renderProxy (props) {
  return [
    renderProxySelect(props),
    <FormItem
      {...formItemLayout}
      label={e('proxyIp')}
      key='proxyIp'
      name={['proxy', 'proxyIp']}
      rules={[{
        max: 530, message: '530 chars max'
      }]}
    >
      <Input
        placeholder={e('proxyIpPlaceholder')}
      />
    </FormItem>,
    <FormItem
      {...formItemLayout}
      label={e('proxyPort')}
      key='proxyPort'
      name={['proxy', 'proxyPort']}
    >
      <InputNumber
        placeholder={e('proxyPort')}
        min={1}
        max={65535}
        step={1}
      />
    </FormItem>,
    <FormItem
      {...formItemLayout}
      label={e('proxyType')}
      key='proxyType'
      name={['proxy', 'proxyType']}
    >
      <Select>
        <Option value='5'>SOCKS5</Option>
        <Option value='4'>SOCKS4</Option>
        <Option value='0'>HTTP</Option>
        <Option value='1'>HTTPS</Option>
      </Select>
    </FormItem>,
    <FormItem
      {...formItemLayout}
      label='Auth'
      key='proxyAuth'
    >
      <Input.Group compact>
        <FormItem
          noStyle
          name={['proxy', 'proxyUsername']}
          rules={[{
            max: 128, message: '128 chars max'
          }]}
        >
          <Input
            placeholder={e('username')}
          />
        </FormItem>
        <FormItem
          name={['proxy', 'proxyPassword']}
          rules={[{
            max: 1024, message: '1024 chars max'
          }]}
        >
          <Input
            placeholder={e('password')}
          />
        </FormItem>
      </Input.Group>
    </FormItem>
  ]
}
