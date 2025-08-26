import { ReloadOutlined } from '@ant-design/icons'
import { AutoComplete, Spin, Form } from 'antd'
import { formItemLayout } from '../../../common/form-layout'

const FormItem = Form.Item
const e = window.translate

export default function SerialPathSelector ({
  serials = [],
  loaddingSerials,
  store = window.store,
  ...props
}) {
  return (
    <FormItem
      {...formItemLayout}
      label='path'
      rules={[{
        required: true, message: 'path required'
      }]}
      normalize={props.trim}
    >
      <FormItem noStyle name='path'>
        <AutoComplete
          options={serials.map(d => {
            return {
              value: d.path
            }
          })}
        />
      </FormItem>
      <Spin spinning={loaddingSerials}>
        <span onClick={store.handleGetSerials}>
          <ReloadOutlined /> {e('reload')} serials
        </span>
      </Spin>
    </FormItem>
  )
}
