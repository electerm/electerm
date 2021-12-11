/**
 * default text editor for remote file
 */

import { Input, Form } from 'antd'

const FormItem = Form.Item
const { prefix } = window
const e = prefix('sftp')
const s = prefix('setting')

export default function TextEditorForm (props) {
  const {
    defaultEditor
  } = props
  const [form] = Form.useForm()
  function submit () {
    form.submit()
  }
  function renderButton () {
    return (
      <span
        onClick={submit}
        className='pointer'
      >{e('save')}</span>
    )
  }
  function onKeyDown (e) {
    e.stopPropagation()
  }
  return (
    <Form
      onFinish={props.handleSubmit}
      form={form}
      name='text-edit-form'
      layout='vertical'
      initialValues={{ defaultEditor }}
    >
      <FormItem
        name='defaultEditor'
        rules={[
          {
            required: false
          },
          {
            max: 500
          }
        ]}
      >
        <Input
          placeholder={s('editorTip')}
          addonBefore={e('editWith')}
          addonAfter={renderButton()}
          onKeyDown={onKeyDown}
        />
      </FormItem>
    </Form>
  )
}
