/**
 * handle terminal interactive operation
 */

import { useEffect, useState } from 'react'
import { Modal, Form, Button } from 'antd'
import InputAutoFocus from '../common/input-auto-focus'
import wait from '../../common/wait'

const e = window.translate
const FormItem = Form.Item

export default function TermInteractive () {
  const [opts, setter] = useState(null)
  const [form] = Form.useForm()
  function updateTab (data) {
    window.store.updateTab(data.tabId, data.update)
  }
  function onMsg (e) {
    if (
      e &&
      e.data &&
      typeof e.data === 'string' &&
      e.data.includes('session-interactive')
    ) {
      setter(JSON.parse(e.data))
    } else if (
      e &&
      e.data &&
      e.data.includes('ssh-tunnel-result')
    ) {
      updateTab(JSON.parse(e.data))
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
    const type = echo
      ? 'input'
      : 'password'
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
          <InputAutoFocus
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
    open: true,
    title: opts.options?.name || '?',
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
            {e('ignore')}
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
