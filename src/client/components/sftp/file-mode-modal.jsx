/**
 * file props
 */

import React from 'react'
import {Icon, Modal, Button} from 'antd'
import resolve from '../../common/resolve'
import moment from 'moment'
import _ from 'lodash'
import {mode2permission, permission2mode} from '../../common/mode2permission'
import renderPermission from './permission-render'

const formatTime = time => {
  return moment(time).format()
}

export default class FileMode extends React.Component {

  state = {
    file: null
  }

  componentWillReceiveProps(nextProps) {
    if (
      nextProps.file &&
      !_.isEqual(nextProps.file, this.props.file)
    ) {
      this.setState({
        file: this.addPermission(nextProps.file)
      })
    }
  }

  addPermission = file => {
    let perms = mode2permission(file.mode)
    let permission = permission2mode(perms)
    let mode = new Number('0o' + '10' + permission)
    return {
      ...file,
      permission,
      mode
    }
  }

  onChangePermission = (name, permName) => {
    let {file} = this.state
    let perms = mode2permission(file.mode)
    let i = _.findIndex(perms, p => p.name === name)
    _.update(
      perms,
      `[${i}].permission.${permName}`,
      b => !b
    )
    let permission = permission2mode(perms)
    let mode = new Number('0o' + '10' + permission)
    this.setState({
      file: {
        ...file,
        permission,
        mode
      }
    })
  }

  onSubmit = () => {
    this.props.changeFileMode(
      this.state.file
    )
  }

  renderFooter() {
    
    return (
      <Button
        type="primary"
        onClick={this.onSubmit}
      >
        submit
      </Button>
    )
  }

  render() {
    let {
      visible,
      tab,
      onClose
    } = this.props
    if (!visible) {
      return null
    }
    let {file} = this.state
    let {
      name,
      size,
      accessTime,
      modifyTime,
      isDirectory,
      path,
      mode,
      type
    } = file
    let {
      host,
      port,
      username
    } = tab
    let iconType = isDirectory ? 'folder' : 'file'
    let ps = {
      visible,
      width: 500,
      title: 'edit ' + iconType + ' permission',
      footer: this.renderFooter(),
      onCancel: onClose
    }
    let fp = resolve(path, name)
    let ffp = type === 'local'
      ? fp
      : `${username}@${host}:${port}:${fp}`

    let perms = mode2permission(mode)
    let permission = permission2mode(perms)

    return (
      <Modal
        {...ps}
      >
        <div className="file-props-wrap relative">
          <Icon type={iconType} className="file-icon" />
          <div className="file-props">
            <p className="bold">{iconType} name:</p>
            <p className="pd1b">{name}</p>
            <p className="bold">mode: ({permission})</p>
            <div className="pd1b">
              {
                perms.map((perm) => {
                  return renderPermission(
                    perm,
                    this.onChangePermission
                  )
                })
              }
            </div>
            <p className="bold">full path:</p>
            <p className="pd1b">{ffp}</p>
            <p className="bold">size:</p>
            <p className="pd1b">{size}</p>
            <p className="bold">access time:</p>
            <p className="pd1b">{formatTime(accessTime)}</p>
            <p className="bold">modify time:</p>
            <p className="pd1b">{formatTime(modifyTime)}</p>
          </div>
        </div>
      </Modal>
    )
  }

}
