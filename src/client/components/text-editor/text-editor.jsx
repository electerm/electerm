/**
 * default text editor for remote file
 */

import { PureComponent } from 'react'
import TextEditorForm from './text-editor-form'
import {
  CUSTOM_EDITOR_AUTO_OPEN_LS_KEY,
  CUSTOM_EDITOR_COMMAND_LS_KEY
} from './edit-with-custom-editor'
import { Spin } from 'antd'
import Modal from '../common/modal'
import resolve from '../../common/resolve'
import { safeGetItem } from '../../common/safe-local-storage.js'
import { refsStatic, refs } from '../common/ref'
import { takePendingTextEditorData } from './open-text-editor'

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
    // editor may be mounted by an open request,
    // consume the pending data now
    const data = takePendingTextEditorData()
    if (data) {
      this.openEditor(data)
    }
  }

  componentWillUnmount () {
    // the entry can be unmounted (a failed chunk load releases the mount
    // latch); without this a later request would find this dead instance and
    // call openEditor on it, so the modal would never show up
    refsStatic.remove('text-editor')
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
    const editorCommand = this.getAutoOpenCustomEditorCommand()
    this.setStateProxy({
      text,
      loading: false
    }, () => {
      if (editorCommand) {
        this.editWithCustom(editorCommand)
      }
    })
  }

  getAutoOpenCustomEditorCommand = () => {
    if (window.et.isWebApp) {
      return ''
    }
    const autoOpen = safeGetItem(CUSTOM_EDITOR_AUTO_OPEN_LS_KEY) === 'true'
    if (!autoOpen) {
      return ''
    }
    return safeGetItem(CUSTOM_EDITOR_COMMAND_LS_KEY).trim()
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

  editWithCustom = async (editorCommand) => {
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
    await fileRef.editWithCustomEditor(text, editorCommand)
      .catch(err => {
        this.setStateProxy({ loading: false })
        window.store.onError(err)
      })
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
      editWith: this.editWith,
      editWithCustom: this.editWithCustom
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
