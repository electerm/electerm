/**
 * default text editor for remote file
 */

import { useState, useEffect } from 'react'
import fs from '../../common/fs'
import { Button, Spin, Modal } from 'antd'
import resolve from '../../common/resolve'
import { typeMap } from '../../common/constants'
import { nanoid } from 'nanoid/non-secure'
import { getFileExt } from '../sftp/file-read'
import EditorForm from './editor-form'

const { prefix } = window
const e = prefix('form')
const c = prefix('common')
const s = prefix('sftp')

export default function TextEditorFormSystem (props) {
  const [state, setter] = useState({
    text: '',
    tempFilePath: '',
    loading: false,
    path: 'loading...'
  })
  function setState (update) {
    setter(old => {
      return {
        ...old,
        ...update
      }
    })
  }
  const {
    tempFilePath,
    loading,
    path
  } = state
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
      setState({
        tempFilePath: p0,
        loading: false
      })
    } else {
      setState({
        tempFilePath: p,
        loading: false
      })
    }
  }

  function open () {
    const cmd = `${props.config.defaultEditor} ${tempFilePath}`
    fs.run(cmd)
  }

  async function handleSubmit (res) {
    setState({
      loading: true
    })
    const {
      sftpFunc,
      file: {
        mode
      }
    } = props
    const sftp = sftpFunc()
    const txt = await fs.readFile(tempFilePath)
    await sftp.writeFile(
      path,
      txt,
      mode
    )
    props.afterWrite()
    cancel()
  }

  function cancel () {
    props.storeAssign({
      textEditorSystemProps: {}
    })
  }

  function handleEditorSubmit (res) {
    props.updateConfig(res)
  }

  function renderEditor () {
    const {
      defaultEditor
    } = props.config
    return (
      <div className='pd1b'>
        <EditorForm
          defaultEditor={defaultEditor}
          handleSubmit={handleEditorSubmit}
        />
      </div>
    )
  }

  function renderForm () {
    return (
      <div>
        {
          renderEditor()
        }
        <div className='pd1b'>
          {s('file')}: {tempFilePath || 'loading...'}
        </div>
      </div>
    )
  }

  function renderFooter () {
    const {
      defaultEditor
    } = props.config
    const {
      file: {
        type
      }
    } = props
    return (
      <div>
        <Button
          type='primary'
          className='mg1r mg1b'
          disabled={loading || !tempFilePath || !defaultEditor}
          onClick={open}
        >{e('open')}</Button>
        {
          type === typeMap.remote
            ? (
              <Button
                type='primary'
                className='mg1r mg1b'
                disabled={loading || !tempFilePath}
                onClick={handleSubmit}
              >{e('save')}</Button>
            )
            : null
        }
        <Button
          type='ghost'
          onClick={cancel}
          disabled={loading}
          className='mg2r mg1b'
        >{c('cancel')}</Button>
      </div>
    )
  }

  const { visible, file } = props
  if (!visible) {
    return null
  }
  const title = `${s('edit')} ${s(file.type)} ${s('file')}: ${path}`
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
