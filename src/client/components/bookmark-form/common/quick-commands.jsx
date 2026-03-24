/**
 * quick commands forms render
 * // todo rerender check
 */

/**
 * bookmark form
 */

import {
  Input,
  Form,
  Space,
  Button
} from 'antd'
import { formItemLayout } from '../../../common/form-layout'
import { MinusCircle, Plus } from 'lucide-react'

const FormItem = Form.Item
const FormList = Form.List
const e = window.translate

export default function useQuickCmds (form, formData) {
  function renderItem (field, i, add, remove) {
    return (
      <Space
        style={{ display: 'flex', marginBottom: '2px' }}
        align='baseline'
        key={field.key}
      >
        <FormItem
          {...field}
          name={[field.name, 'name']}
          fieldKey={[field.fieldKey, 'first']}
          rules={[{ required: true, max: 30 }]}
        >
          <Input placeholder={e('quickCommandName')} />
        </FormItem>
        <FormItem
          {...field}
          name={[field.name, 'command']}
          fieldKey={[field.fieldKey, 'first']}
          rules={[{ required: true, max: 300 }]}
        >
          <Input placeholder={e('quickCommand')} />
        </FormItem>
        <MinusCircle onClick={() => remove(field.name)} />
      </Space>
    )
  }
  return (
    <FormList
      {...formItemLayout}
      label={e('quickCommands')}
      name='quickCommands'
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
                  onClick={() => add()}
                  block
                  icon={<Plus />}
                >
                  {e('newQuickCommand')}
                </Button>
              </FormItem>
            </>
          )
        }
      }
    </FormList>
  )
}
