/**
 * handle terminal interactive operation
 */

import { useEffect, useState } from 'react'
import { Modal, Form, Input, Button } from 'antd'
import wait from '../../common/wait'

const { prefix } = window
const e = prefix('sftp')
const c = prefix('common')
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
  function onIgnore () {
    window.et.commonWs.s({
      id: opts.id,
      results: Object.keys(opts.options.prompts).map(() => '')
    })
    clear()
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
      prompt,
      echo
    } = pro
    const note = (opts.options.instructions || [])[i]
    const InputDom = echo
      ? Input
      : Input.Password
    return (
      <FormItem
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
          <InputDom
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
    title: '?',
    footer: null
  }
  return (
    <Modal
      {...props}
    >
      <Form
        form={form}
        layout='vertical'
        onFinish={onFinish}
      >
        {
          opts.options.prompts.map(renderFormItem)
        }
        <FormItem>
          <Button
            type='primary'
            htmlType='submit'
          >
            {e('submit')}
          </Button>
          <Button
            type='dashed'
            className='mg1l'
            onClick={onIgnore}
          >
            {c('ignore')}
          </Button>
          <Button
            className='mg1l'
            onClick={onCancel}
          >
            {e('cancel')}
          </Button>
        </FormItem>
      </Form>
    </Modal>
  )
}
