/**
 * default text editor for remote file
 */

import { useState, useEffect } from 'react'
import fs from '../../common/fs'
import { Button, Input, Spin, Modal, Form } from 'antd'
import resolve from '../../common/resolve'
import { typeMap } from '../../common/constants'

const FormItem = Form.Item
const { prefix } = window
const e = prefix('form')
const c = prefix('common')
const s = prefix('sftp')

export default function TextEditorForm (props) {
  const [form] = Form.useForm()
  const [state, setter] = useState({
    text: '',
    path: 'loading...',
    loading: true
  })
  function setState (update) {
    setter(old => {
      return {
        ...old,
        ...update
      }
    })
  }
  useEffect(() => {
    if (props.visible) {
      fetchText()
    }
  }, [])

  async function fetchText () {
    setState({
      loading: true
    })
    const {
      sftpFunc,
      file: {
        path,
        name,
        type
      }
    } = props
    const p = resolve(path, name)
    setState({
      path: p
    })
    const sftp = sftpFunc()
    const text = typeMap.remote === type
      ? await sftp.readFile(p)
      : await fs.readFile(p)
    setState({
      text: text || '',
      loading: false
    })
    form.resetFields()
  }

  function submit () {
    form.submit()
  }

  async function handleSubmit (res) {
    setState({
      loading: true
    })
    if (res.text === state.text) {
      return cancel()
    }
    const {
      sftpFunc,
      file: {
        type,
        mode
      }
    } = props
    const sftp = sftpFunc()
    const r = typeMap.remote === type
      ? await sftp.writeFile(
        state.path,
        res.text,
        mode
      )
      : await fs.writeFile(
        state.path,
        res.text,
        mode
      )
    r && props.afterWrite()
    cancel()
  }

  function cancel () {
    props.storeAssign({
      textEditorProps: {}
    })
  }

  function onPressEnter (e) {
    e.stopPropagation()
  }

  function renderForm () {
    const {
      text
    } = state
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
          >{text}</Input.TextArea>
        </FormItem>
      </Form>
    )
  }

  function renderFooter () {
    const { loading } = state
    return (
      <div>
        <Button
          type='primary'
          className='mg1r mg1b'
          disabled={loading}
          onClick={submit}
        >{e('save')}</Button>
        <Button
          type='ghost'
          className='mg1r mg1b'
          disabled={loading}
          onClick={() => form.resetFields()}
        >{s('reset')}</Button>
        <Button
          type='ghost'
          onClick={cancel}
          disabled={loading}
          className='mg2r mg1b'
        >{c('cancel')}</Button>
      </div>
    )
  }

  const { visible } = props
  if (!visible) {
    return null
  }
  const { path, loading } = state
  const title = `${s('edit')} ${s('remote')} ${s('file')}: ${path}`
  const propsAll = {
    footer: renderFooter(),
    title,
    maskClosable: false,
    onCancel: cancel,
    width: '90%',
    visible
  }
  return (
    <Modal
      {...propsAll}
    >
      <Spin spinning={loading}>
        {renderForm()}
      </Spin>
    </Modal>
  )
}
