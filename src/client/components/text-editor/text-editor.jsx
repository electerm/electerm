/**
 * default text editor for remote file
 */

import { PureComponent } from 'react'
import TextEditorForm from './text-editor-form'
import { Spin, Modal } from 'antd'
import resolve from '../../common/resolve'
import { refsStatic, refs } from '../common/ref'

const e = window.translate

export default class TextEditor extends PureComponent {
  state = {
    text: '',
    path: 'loading...',
    file: null,
    id: '',
    loading: true
  }

  componentDidMount () {
    refsStatic.add('text-editor', this)
  }

  setStateProxy = (state, cb) => {
    if (state && typeof state.file !== 'undefined') {
      window.store.showEditor = !!state.file
    }
    return this.setState(state, cb)
  }

  openEditor = (data) => {
    this.setStateProxy(data)
    if (data.id && data.file) {
      this.fetchText(data)
    } else if (data.id === '') {
      this.cancel()
    }
  }

  editWithSystemEditorDone = (data) => {
    let cb = this.doSubmit
    if (data.text === this.state.text) {
      delete data.text
      cb = undefined
    }
    this.setStateProxy(data, cb)
  }

  fetchText = async ({
    id, file
  }) => {
    this.setStateProxy({
      loading: true
    })
    const {
      path,
      name,
      type
    } = file
    const p = resolve(path, name)
    this.setStateProxy({
      path: p
    })
    const fileRef = refs.get(id)
    if (!fileRef) {
      return
    }
    const text = await fileRef.fetchEditorText(p, type)
    this.setStateProxy({
      text,
      loading: false
    })
  }

  doSubmit = () => {
    this.handleSubmit({
      text: this.state.text
    }, true)
  }

  handleSubmit = async (res, force = false) => {
    this.setStateProxy({
      loading: true
    })
    if (!force && res.text === this.state.text) {
      return this.cancel()
    }
    const {
      path,
      file,
      id
    } = this.state
    const {
      type,
      mode
    } = file
    const fileRef = refs.get(id)
    if (!fileRef) {
      return
    }
    await fileRef.onSubmitEditFile(mode, type, path, res.text, force)
  }

  editWith = () => {
    this.setStateProxy({
      loading: true
    })
    const {
      id, text
    } = this.state
    const fileRef = refs.get(id)
    if (!fileRef) {
      return
    }
    fileRef.editWithSystemEditor(text)
  }

  cancel = () => {
    this.setStateProxy({
      id: '',
      file: null
    })
    const fileRef = refs.get(this.state.id)
    fileRef?.removeFileEditEvent()
  }

  render () {
    const {
      file,
      path,
      loading,
      text
    } = this.state
    if (!file) {
      return null
    }
    const title = `${e('edit')} ${e('remote')} ${e('file')}: ${path}`
    const propsAll = {
      footer: null,
      title,
      maskClosable: false,
      onCancel: this.cancel,
      width: '90%',
      open: true
    }
    const pops = {
      submit: this.handleSubmit,
      text,
      cancel: this.cancel,
      editWith: this.editWith
    }
    return (
      <Modal
        {...propsAll}
      >
        <Spin spinning={loading}>
          <TextEditorForm
            {...pops}
          />
        </Spin>
      </Modal>
    )
  }
}
