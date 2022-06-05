/**
 * default text editor for remote file
 */

import { PureComponent } from 'react'
import TextEditorForm from './text-editor-form'
import { Spin, Modal } from 'antd'
import resolve from '../../common/resolve'
import { commonActions } from '../../common/constants'
import postMsg from '../../common/post-msg'

const { prefix } = window
const s = prefix('sftp')

export default class TextEditor extends PureComponent {
  state = {
    text: '',
    path: 'loading...',
    file: null,
    id: '',
    loading: true
  }

  componentDidMount () {
    window.addEventListener('message', this.onEvent)
  }

  onEvent = (e) => {
    const {
      action,
      data
    } = e.data || {}
    if (
      action === commonActions.openTextEditor && data
    ) {
      this.setState(data)
      if (data.id && data.file) {
        this.fetchText(data)
      } else if (data.id === '') {
        this.cancel()
      }
    } else if (action === commonActions.loadTextEditorText) {
      this.setState(data)
    } else if (action === commonActions.editWithSystemEditorDone) {
      let cb = this.doSubmit
      if (data.text === this.state.text) {
        delete data.text
        cb = undefined
      }
      this.setState(data, cb)
    }
  }

  fetchText = async ({
    id, file
  }) => {
    this.setState({
      loading: true
    })
    const {
      path,
      name,
      type
    } = file
    const p = resolve(path, name)
    this.setState({
      path: p
    })
    postMsg({
      action: commonActions.fetchTextEditorText,
      id,
      path: p,
      type
    })
  }

  doSubmit = () => {
    this.handleSubmit({
      text: this.state.text
    }, true)
  }

  handleSubmit = async (res, force = false) => {
    this.setState({
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
    postMsg({
      id,
      path,
      action: commonActions.submitTextEditorText,
      text: res.text,
      mode,
      type,
      noClose: force
    })
  }

  editWith = () => {
    this.setState({
      loading: true
    })
    const {
      id, text
    } = this.state
    postMsg({
      action: commonActions.editWithSystemEditor,
      id,
      text
    })
  }

  cancel = () => {
    this.setState({
      id: '',
      file: null
    })
    postMsg({
      action: commonActions.onCloseTextEditor
    })
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
    const title = `${s('edit')} ${s('remote')} ${s('file')}: ${path}`
    const propsAll = {
      footer: null,
      title,
      maskClosable: false,
      onCancel: this.cancel,
      width: '90%',
      visible: true
    }
    return (
      <Modal
        {...propsAll}
      >
        <Spin spinning={loading}>
          <TextEditorForm
            submit={this.handleSubmit}
            text={text}
            cancel={this.cancel}
            editWith={this.editWith}
          />
        </Spin>
      </Modal>
    )
  }
}
