/**
 * file compare modal - shows side by side comparison of two files' attributes
 */

import React from 'react'
import Modal from '../common/modal'
import resolve from '../../common/resolve'
import time from '../../common/time'
import { mode2permission, permission2mode } from '../../common/mode2permission'
import FileIcon from './file-icon'
import { filesize } from 'filesize'
import { refsStatic } from '../common/ref'
import './file-compare-modal.styl'

const e = window.translate
const formatTime = time

export default class FileCompareModal extends React.PureComponent {
  state = {
    visible: false,
    file1: {},
    file2: {},
    tab: null,
    uidTree: {},
    gidTree: {}
  }

  componentDidMount () {
    refsStatic.add('file-compare-modal', this)
  }

  showFileCompareModal (data) {
    this.setState({
      ...data,
      visible: true
    })
  }

  onClose = () => {
    this.setState({
      file1: {},
      file2: {},
      visible: false
    })
  }

  render () {
    const {
      visible,
      file1,
      file2,
      tab = {},
      uidTree = {},
      gidTree = {}
    } = this.state
    if (!visible) {
      return null
    }
    const {
      host,
      port,
      username
    } = tab
    const title = e('compare')
    const ps = {
      open: visible,
      width: 800,
      title,
      footer: null,
      onCancel: this.onClose
    }

    const fp1 = resolve(file1.path, file1.name)
    const fp2 = resolve(file2.path, file2.name)
    const ffp1 = file1.type === 'local'
      ? fp1
      : `${username}@${host}:${port}:${fp1}`
    const ffp2 = file2.type === 'local'
      ? fp2
      : `${username}@${host}:${port}:${fp2}`

    const perms1 = mode2permission(file1.mode)
    const perms2 = mode2permission(file2.mode)
    const permission1 = permission2mode(perms1)
    const permission2 = permission2mode(perms2)

    const rows = [
      [
        e('name'),
        (
          <React.Fragment key='name1'>
            <FileIcon file={file1} height={20} />
            {' '}
            {file1.isSymbolicLink ? <sup className='color-blue symbolic-link-icon'>*</sup> : null}
            {file1.name}
          </React.Fragment>
        ),
        (
          <React.Fragment key='name2'>
            <FileIcon file={file2} height={20} />
            {' '}
            {file2.isSymbolicLink ? <sup className='color-blue symbolic-link-icon'>*</sup> : null}
            {file2.name}
          </React.Fragment>
        )
      ],
      [
        e('type'),
        file1.isDirectory ? e('folder') : e('file'),
        file2.isDirectory ? e('folder') : e('file')
      ],
      [
        e('size'),
        file1.isDirectory ? '-' : filesize(file1.size || 0),
        file2.isDirectory ? '-' : filesize(file2.size || 0)
      ],
      [e('mode'), permission1, permission2],
      [e('fullPath'), ffp1, ffp2],
      [e('owner'), uidTree['' + file1.owner] || file1.owner, uidTree['' + file2.owner] || file2.owner],
      [e('group'), gidTree['' + file1.group] || file1.group, gidTree['' + file2.group] || file2.group],
      [e('accessTime'), formatTime(file1.accessTime), formatTime(file2.accessTime)],
      [e('modifyTime'), formatTime(file1.modifyTime), formatTime(file2.modifyTime)]
    ]

    return (
      <Modal {...ps}>
        <table className='file-compare-table'>
          <tbody>
            {rows.map(([label, v1, v2], i) => {
              const same = String(v1 ?? '') === String(v2 ?? '')
              const cls = same ? '' : 'file-compare-diff'
              return (
                <tr key={i}>
                  <td className='bold file-compare-label'>{label}</td>
                  <td className={cls}>{v1}</td>
                  <td className={cls}>{v2}</td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </Modal>
    )
  }
}
