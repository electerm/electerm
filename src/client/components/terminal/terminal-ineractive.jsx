/**
 * handle terminal interactive operation
 */

import { useEffect, useState } from 'react'
import { Modal, Form, Input } from 'antd'
import { formItemLayout } from '../../common/form-layout'
import wait from '../../common/wait'

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
      >
        <div>
          <pre>{note}</pre>
        </div>
        <FormItem noStyle name={'item' + i}>
          <Input
            type={type}
            placeholder={note}
          />
        </FormItem>
      </FormItem>
    )
  }
  async function initWatch () {
    let done = false
    while (!done) {
      if (window.et.commonWs) {
        window.et.commonWs.addEventListener('message', onMsg)
        done = true
      } else {
        await wait(400)
      }
    }
  }
  function init () {
    initWatch()
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
    visible: true,
    title: '?'
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
