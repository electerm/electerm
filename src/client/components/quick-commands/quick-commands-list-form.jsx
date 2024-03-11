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
const { prefix } = window
const t = prefix('quickCommands')

export default function renderQm () {
  function renderItem (field, i, add, remove) {
    return (
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
            addonBefore={t('delay')}
            placeholder={100}
            className='compact-input'
          />
        </FormItem>
        <FormItem
          label=''
          name={[field.name, 'command']}
          required
          className='mg2x'
        >
          <Input.TextArea
            rows={1}
            placeholder={t('quickCommand')}
            className='compact-input'
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

  return (
    <FormItem {...formItemLayout} label={t('quickCommands')}>
      <FormList
        name='commands'
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
                    {t('quickCommand')}
                  </Button>
                </FormItem>
              </div>
            )
          }
        }
      </FormList>
    </FormItem>
  )
}
