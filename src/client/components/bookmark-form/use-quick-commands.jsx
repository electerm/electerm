/**
 * quick commands forms render
 */

/**
 * bookmark form
 */

import {
  Input,
  Form
} from 'antd'
import { formItemLayout } from '../../common/form-layout'
import QmList from './quick-command-list'

const FormItem = Form.Item

export default function useQuickCmds (form, formData) {
  const qms = form.getFieldValue('quickCommands') || []
  return (
    <div>
      <div className='hide'>
        <FormItem
          {...formItemLayout}
          label='quick commands'
          name='quickCommands'
        >
          <Input />
        </FormItem>
      </div>
      <QmList
        quickCommands={qms}
        form={form}
      />
    </div>
  )
}
