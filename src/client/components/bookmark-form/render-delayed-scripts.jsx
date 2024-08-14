import {
  Form,
  InputNumber,
  Space,
  Button,
  Input
} from 'antd'
import { MinusCircleOutlined, PlusOutlined } from '@ant-design/icons'
import { formItemLayout } from '../../common/form-layout'

const FormItem = Form.Item
const FormList = Form.List
const e = window.translate

export default function renderRunScripts () {
  function renderItem (field, i, add, remove) {
    return (
      <div>
        <Space
          align='center'
          key={field.key}
        >
          <FormItem
            label=''
            name={[field.name, 'delay']}
            required
          >
            <InputNumber
              min={1}
              step={1}
              max={65535}
              addonBefore={e('loginScriptDelay')}
              className='compact-input'
            />
          </FormItem>
          <FormItem
            label=''
            name={[field.name, 'script']}
            required
            className='mg2x'
          >
            <Input.TextArea
              autoSize={{ minRows: 1 }}
              placeholder={e('loginScript')}
              className='compact-input'
            />
          </FormItem>
          <Button
            icon={<MinusCircleOutlined />}
            onClick={() => remove(field.name)}
            className='mg24b'
          />
        </Space>
      </div>
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
                    {e('loginScript')}
                  </Button>
                </FormItem>
              </div>
            )
          }
        }
      </FormList>
    </FormItem>
  ]
}
