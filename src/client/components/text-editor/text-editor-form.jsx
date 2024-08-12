/**
 * default text editor for remote file
 */

import { useEffect } from 'react'
import { Input, Form, Button } from 'antd'

const FormItem = Form.Item
const e = window.translate

export default function TextEditorForm (props) {
  const [form] = Form.useForm()

  useEffect(() => {
    form.resetFields()
  }, [props.text])

  function submit () {
    form.submit()
  }

  async function handleSubmit (res) {
    props.submit(res)
  }

  function onPressEnter (e) {
    e.stopPropagation()
  }

  function reset () {
    form.resetFields()
  }

  const {
    text,
    loading
  } = props
  const popsEdit = {
    type: 'primary',
    className: 'mg3r mg1b',
    disabled: loading,
    onClick: props.editWith
  }
  const popsCancel = {
    type: 'dashed',
    onClick: props.cancel,
    disabled: loading,
    className: 'mg2r mg1b'
  }
  return (
    <Form
      onFinish={handleSubmit}
      form={form}
      name='text-edit-form'
      layout='vertical'
      initialValues={{ text }}
    >
      <FormItem
        name='text'
      >
        <Input.TextArea
          rows={20}
          onPressEnter={onPressEnter}
        >{text}
        </Input.TextArea>
      </FormItem>
      <div className='pd1t pd2b'>
        <Button
          {...popsEdit}
        >{e('editWithSystemEditor')}
        </Button>
        <Button
          type='primary'
          className='mg1r mg1b'
          disabled={loading}
          onClick={submit}
        >{e('save')}
        </Button>
        <Button
          type='dashed'
          className='mg1r mg1b'
          disabled={loading}
          onClick={reset}
        >{e('reset')}
        </Button>
        <Button
          {...popsCancel}
        >{e('cancel')}
        </Button>
      </div>
    </Form>
  )
}
