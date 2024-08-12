import {
  Input,
  Form,
  AutoComplete
} from 'antd'
import { formItemLayout } from '../../common/form-layout'

const FormItem = Form.Item
const e = window.translate

export default function renderProxy (props) {
  const proxyTree = props.bookmarks
    .reduce((prev, current) => {
      const { proxy } = current
      if (proxy && !prev[proxy]) {
        prev[proxy] = 1
      }
      return prev
    }, {})
  const opts = {
    options: Object.keys(proxyTree)
      .map(d => {
        return {
          label: d,
          value: d
        }
      }),
    placeholder: 'socks5://127.0.0.1:1080',
    allowClear: true
  }
  return (
    <FormItem
      {...formItemLayout}
      label={e('proxy')}
      hasFeedback
      name='proxy'
      rules={[{
        max: 1024, message: '1024 chars max'
      }]}
    >
      <AutoComplete
        {...opts}
      >
        <Input />
      </AutoComplete>
    </FormItem>
  )
}
