/**
 * handle terminal interactive operation
 */

import { useEffect, useState } from 'react'
import { Modal, Form, Input } from 'antd'
import { formItemLayout } from '../../common/form-layout'

const { prefix } = window
const e = prefix('sftp')
const FormItem = Form.Item

export default function TermInteractive () {
  const [opts, setter] = useState(null)
  const [form] = Form.useForm()
  function onMsg (e) {
    if (e.data.includes('session-interactive')) {
      setter(JSON.parse(e.data))
    }
  }
  function clear () {
    setter(null)
    form.resetFields()
  }
  function onCancel () {
    window.et.commonWs.s({
      id: opts.id,
      results: []
    })
    clear()
  }
  function onOk () {
    form.submit()
  }
  function onFinish (res) {
    window.et.commonWs.s({
      id: opts.id,
      results: Object.values(res)
    })
    clear()
  }
  function renderFormItem (pro, i) {
    const {
      prompt
    } = pro
    const note = (opts.options.instructions || [])[i]
    const type = prompt.toLowerCase().includes('password')
      ? 'password'
      : 'text'
    return (
      <FormItem
        {...formItemLayout}
        key={prompt + i}
        label={prompt}
        rules={[{
          required: true, message: 'required'
        }]}
        name={'item' + i}
      >
        <Input
          type={type}
          placeholder={note}
        />
      </FormItem>
    )
  }
  function init () {
    setTimeout(() => {
      window.et.commonWs.addEventListener('message', onMsg)
    }, 500)
  }
  useEffect(() => {
    init()
  }, [])
  if (!opts) {
    return null
  }
  const props = {
    maskClosable: false,
    okText: e('submit'),
    onCancel,
    onOk,
    closable: false,
    visible: true
  }
  return (
    <Modal
      {...props}
    >
      <Form
        form={form}
        onFinish={onFinish}
      >
        {
          opts.options.prompts.map(renderFormItem)
        }
      </Form>
    </Modal>
  )
}
