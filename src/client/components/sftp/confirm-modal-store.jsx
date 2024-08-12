/**
 * confirm modal for transfer conflict
 *
 */

import { Component } from '../common/react-subx'
import { Modal, Button } from 'antd'
import { isString } from 'lodash-es'
import AnimateText from '../common/animate-text'
import formatTime from '../../common/time'
import { FolderOutlined, FileOutlined } from '@ant-design/icons'
import {
  fileActions
} from '../../common/constants'
import postMessage from '../../common/post-msg'

const e = window.translate

function formatTimeAuto (strOrDigit) {
  if (isString(strOrDigit)) {
    return formatTime(strOrDigit)
  }
  return formatTime(strOrDigit * 1000)
}

export default class ConfirmModalStore extends Component {
  act (action) {
    const { store } = this.props
    const {
      transferToConfirm
    } = store
    store.setState(
      'transferToConfirm', {}
    )
    const {
      fromFile: {
        id: fileId
      },
      id,
      transferGroupId
    } = transferToConfirm
    postMessage({
      transferGroupId,
      fileId,
      id,
      transfer: transferToConfirm,
      action
    })
  }

  renderContent () {
    const {
      transferToConfirm
    } = this.props.store
    const {
      fromPath,
      toPath,
      fromFile: {
        isDirectory,
        name,
        modifyTime: modifyTimeFrom,
        size: sizeFrom,
        type: typeFrom
      },
      toFile: {
        modifyTime: modifyTimeTo,
        size: sizeTo,
        type: typeTo
      }
    } = transferToConfirm
    const action = isDirectory ? e('merge') : e('replace')
    const typeTxt = isDirectory ? e('folder') : e('file')
    const Icon = isDirectory ? FolderOutlined : FileOutlined
    const typeTitle = e(typeTo)
    const otherTypeTitle = e(typeFrom)
    return (
      <div className='confirms-content-wrap'>
        <AnimateText>
          <p className='pd1b color-red font13'>
            {action}
          </p>
          <p className='bold font14'>
            {typeTitle} {typeTxt}: <Icon className='mg1r' />{name}
          </p>
          <p className='font13'>
            {e('size')}: {sizeTo}, {e('modifyTime')}: {formatTimeAuto(modifyTimeTo)}
          </p>
          <p className='pd1b'>
            ({toPath})
          </p>
          <p>
            with
          </p>
          <p className='bold font14'>
            {otherTypeTitle} {typeTxt}: <Icon className='mg1r' />{name}
          </p>
          <p className='font13'>
            {e('size')}: {sizeFrom}, {e('modifyTime')}: {formatTimeAuto(modifyTimeFrom)}
          </p>
          <p className='pd1b'>
            ({fromPath})
          </p>
        </AnimateText>
      </div>
    )
  }

  renderFooter () {
    const {
      transferToConfirm
    } = this.props.store
    if (!transferToConfirm) {
      return null
    }
    const {
      fromFile: {
        isDirectory
      }
    } = transferToConfirm
    return (
      <div className='mgq1t pd1y alignright'>
        <Button
          type='dashed'
          className='mg1l'
          onClick={() => this.act(fileActions.cancel)}
        >
          {e('cancel')}
        </Button>
        <Button
          type='dashed'
          className='mg1l'
          onClick={() => this.act(fileActions.skip)}
        >
          {e('skip')}
        </Button>
        <Button
          type='dashed'
          className='mg1l'
          onClick={() => this.act(fileActions.skipAll)}
        >
          {e('skipAll')}
        </Button>
        <Button
          danger
          className='mg1l'
          onClick={
            () => this.act(fileActions.mergeOrOverwrite)
          }
        >
          {isDirectory ? e('merge') : e('overwrite')}
        </Button>
        <Button
          type='primary'
          className='mg1l'
          onClick={
            () => this.act(fileActions.rename)
          }
        >
          {e('rename')}
        </Button>
        <div className='pd1t'>
          <Button
            type='dashed'
            danger
            className='mg1l'
            title={
              isDirectory
                ? e('mergeDesc')
                : e('overwriteDesc')
            }
            onClick={
              () => this.act(fileActions.mergeOrOverwriteAll)
            }
          >
            {isDirectory ? e('mergeAll') : e('overwriteAll')}
          </Button>
          <Button
            type='primary'
            className='mg1l'
            title={e('renameDesc')}
            onClick={
              () => this.act(fileActions.renameAll)
            }
          >
            {e('renameAll')}
          </Button>
        </div>
      </div>
    )
  }

  render () {
    const {
      transferToConfirm
    } = this.props.store
    if (!transferToConfirm.id) {
      return null
    }
    const modalProps = {
      open: true,
      width: 500,
      title: e('fileConflict'),
      footer: this.renderFooter(),
      onCancel: () => this.act(fileActions.cancel)
    }
    return (
      <Modal
        {...modalProps}
      >
        {this.renderContent()}
      </Modal>
    )
  }
}
