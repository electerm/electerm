/**
 * default text editor for remote file
 */

import { Component } from '../common/react-subx'
import fs from '../../common/fs'
import { Button, Spin, Modal } from 'antd'
import resolve from '../../common/resolve'
import { typeMap } from '../../common/constants'
import { nanoid } from 'nanoid/non-secure'
import { getFileExt } from '../sftp/file-read'

const { prefix } = window
const e = prefix('form')
const c = prefix('common')
const s = prefix('sftp')

export default class TextEditorFormSystem extends Component {
  state = {
    show: true,
    text: '',
    tempFilePath: '',
    loading: false,
    path: 'loading...'
  }

  componentDidUpdate () {
    if (this.props.store.textEditorSystemProps.visible) {
      this.fetchText()
    }
  }

  fetchText = async () => {
    this.setState({
      loading: true
    })
    const {
      sftpFunc,
      file: {
        path,
        name,
        type
      }
    } = this.props.store.textEditorSystemProps
    const p = resolve(path, name)
    this.setState({
      path: p
    })
    if (typeMap.remote === type) {
      const sftp = sftpFunc()
      const text = await sftp.readFile(p)
      const {
        ext
      } = getFileExt(name)
      const id = nanoid()
      const fileName = id + (ext ? '.' + ext : '')
      const p0 = window.pre.resolve(
        window.pre.tempDir,
        fileName
      )
      await fs.writeFile(p0, text)
      this.setState({
        tempFilePath: p0,
        loading: false
      })
      await fs.openFile(p0)
    } else {
      this.setState({
        tempFilePath: p,
        loading: false
      })
      await fs.openFile(p)
    }
  }

  handleSubmit = async (res) => {
    this.setState({
      loading: true
    })
    const {
      sftpFunc,
      file: {
        type,
        mode
      }
    } = this.props.store.textEditorSystemProps
    const {
      tempFilePath,
      path
    } = this.state
    if (typeMap.remote === type) {
      const sftp = sftpFunc()
      const txt = await fs.readFile(tempFilePath)
      await sftp.writeFile(
        path,
        txt,
        mode
      )
    }
    this.props.store.textEditorSystemProps.afterWrite()
    this.cancel()
  }

  cancel = () => {
    this.props.store.textEditorProps = {}
    this.setState({
      show: false
    })
  }

  renderForm () {
    const {
      tempFilePath
    } = this.state
    return (
      <div>
        local file: {tempFilePath}
      </div>
    )
  }

  renderFooter () {
    const { loading, tempFilePath } = this.state
    return (
      <div>
        <Button
          type='primary'
          className='mg1r mg1b'
          disabled={loading || !tempFilePath}
          onClick={this.handleSubmit}
        >{e('save')}</Button>
        <Button
          type='ghost'
          onClick={this.cancel}
          disabled={loading}
          className='mg2r mg1b'
        >{c('cancel')}</Button>
      </div>
    )
  }

  render () {
    const { visible, file } = this.props.store.textEditorSystemProps
    const {
      path, loading, show
    } = this.state
    if (!visible || !show) {
      return null
    }
    const title = `${s('edit')} ${s(file.type)} ${s('file')}: ${path}`
    const propsAll = {
      footer: this.renderFooter(),
      title,
      maskClosable: false,
      onCancel: this.cancel,
      width: '90%',
      visible
    }
    return (
      <Modal
        {...propsAll}
      >
        <Spin spinning={loading}>
          {this.renderForm()}
        </Spin>
      </Modal>
    )
  }
}
