import {
  Input,
  Form,
  AutoComplete
} from 'antd'
import { formItemLayout } from '../../../common/form-layout'

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
  const options = Object.keys(proxyTree)
    .map(d => {
      return {
        label: d,
        value: d
      }
    })
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
      <AutoComplete options={options}>
        <Input allowClear placeholder='socks5://127.0.0.1:1080' />
      </AutoComplete>
    </FormItem>
  )
}
