/**
 * default text editor for remote file
 */

import { useState, useEffect, useRef } from 'react'
import { Button, Input, Spin, Modal, Form } from 'antd'
import resolve from '../../common/resolve'
import { commonActions } from '../../common/constants'
import postMsg from '../../common/post-msg'

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
    file: null,
    id: '',
    loading: true
  })
  const ref = useRef({})
  const {
    loading,
    id
  } = state
  function setState (update) {
    setter(old => {
      return {
        ...old,
        ...update
      }
    })
  }
  function onEvent (e) {
    const {
      action,
      data,
      editorType
    } = e.data || {}
    if (editorType !== commonActions.textEditorType) {
      return
    }
    if (
      action === commonActions.openTextEditor && data
    ) {
      setState(data)
      ref.current = data
      if (data.id && data.file) {
        fetchText(data)
      } else if (data.id === '') {
        cancel()
      }
    } else if (action === commonActions.loadTextEditorText) {
      setState(data)
      form.resetFields()
    }
  }
  useEffect(() => {
    window.addEventListener('message', onEvent)
  }, [])

  async function fetchText ({
    id, file
  }) {
    setState({
      loading: true
    })
    const {
      path,
      name,
      type
    } = file
    const p = resolve(path, name)
    setState({
      path: p
    })
    ref.current.path = p
    postMsg({
      editorType: commonActions.textEditorType,
      action: commonActions.fetchTextEditorText,
      id,
      path: p,
      type
    })
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
      path,
      file
    } = ref.current
    const {
      type,
      mode
    } = file
    postMsg({
      id,
      path,
      editorType: commonActions.textEditorType,
      action: commonActions.submitTextEditorText,
      text: res.text,
      mode,
      type
    })
  }

  function cancel () {
    setState({
      id: '',
      file: null
    })
    postMsg({
      editorType: commonActions.textEditorType,
      action: commonActions.onCloseTextEditor
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
  if (!state.file) {
    return null
  }
  const { path } = state
  const title = `${s('edit')} ${s('remote')} ${s('file')}: ${path}`
  const propsAll = {
    footer: renderFooter(),
    title,
    maskClosable: false,
    onCancel: cancel,
    width: '90%',
    visible: true
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
