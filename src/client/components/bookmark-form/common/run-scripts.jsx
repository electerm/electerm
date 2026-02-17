import {
  Form,
  InputNumber,
  Space,
  Button,
  Input
} from 'antd'
import { MinusCircleOutlined, PlusOutlined } from '@ant-design/icons'
import { formItemLayout } from '../../../common/form-layout'

const FormItem = Form.Item
const FormList = Form.List
const e = window.translate

export default function renderRunScripts () {
  function renderItem (field, i, add, remove) {
    return (
      <>
        <Space
          align='baseline'
          className='width-100'
          key={field.key}
        >
          <FormItem
            label=''
            name={[field.name, 'delay']}
            required
            noStyle
          >
            <InputNumber
              min={1}
              step={1}
              prefix={e('loginScriptDelay')}
              suffix='ms'
              max={65535}
              className='number-input'
              rules={[{ required: true, message: e('loginScriptDelay') + ' required' }]}
            />
          </FormItem>
          <Space.Compact>
            <FormItem
              label=''
              name={[field.name, 'script']}
              required
              noStyle
            >
              <Input.TextArea
                autoSize={{ minRows: 1 }}
                placeholder={e('loginScript')}
              />
            </FormItem>
            <Button
              icon={<MinusCircleOutlined />}
              onClick={() => remove(field.name)}
              className='mg24b'
            />
          </Space.Compact>
        </Space>
      </>
    )
  }

  return [
    <FormItem {...formItemLayout} key='runScripts' label={e('loginScript')}>
      <FormList
        name='runScripts'
      >
        {
          (fields, { add, remove }, { errors }) => {
            return (
              <>
                {
                  fields.map((field, i) => {
                    return renderItem(field, i, add, remove)
                  })
                }
                <FormItem>
                  <Button
                    type='dashed'
                    onClick={() => add({
                      delay: 500,
                      script: ''
                    })}
                    block
                    icon={<PlusOutlined />}
                  >
                    {e('loginScript')}
                  </Button>
                </FormItem>
              </>
            )
          }
        }
      </FormList>
    </FormItem>
  ]
}
