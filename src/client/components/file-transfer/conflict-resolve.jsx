/**
 * confirm modal for transfer conflict
 *
 */

import { Component } from 'react'
import { Button } from 'antd'
import Modal from '../common/modal'
import { isString } from 'lodash-es'
import AnimateText from '../common/animate-text'
import formatTime from '../../common/time'
import { FolderOutlined, FileOutlined } from '@ant-design/icons'
import {
  fileActions
} from '../../common/constants'
import { refsStatic, refsTransfers } from '../common/ref'

const e = window.translate

function formatTimeAuto (strOrDigit) {
  if (isString(strOrDigit)) {
    return formatTime(strOrDigit)
  }
  return formatTime(strOrDigit * 1000)
}

export default class ConfirmModalStore extends Component {
  constructor (props) {
    super(props)
    this.state = {
      transferToConfirm: null
    }
    this.queue = []
    this.id = 'transfer-conflict'
    refsStatic.add(this.id, this)
  }

  addConflict = (transfer) => {
    this.queue.push(transfer)
    if (!this.state.transferToConfirm) {
      this.showNext()
    }
  }

  showNext = () => {
    const next = this.queue.shift()
    this.setState({
      transferToConfirm: next
    })
  }

  act = (action) => {
    const { id, transferBatch } = this.state.transferToConfirm
    const toAll = action.includes('All')
    const policy = toAll ? action.replace('All', '') : action
    const trid = `tr-${transferBatch}-${id}`
    const doFilter = toAll && transferBatch

    // For "All" actions, update all existing transfers in the same batch
    if (doFilter) {
      // Update all existing transfers with same batch ID in DOM
      const prefix = `tr-${transferBatch}-`
      for (const [key, r] of window.refsTransfers.entries()) {
        if (key.startsWith(prefix)) {
          if (key !== trid) {
            r.resolvePolicy = policy
            r.onDecision(policy)
          }
        }
      }
      this.queue = this.queue.filter(d => d.transferBatch !== transferBatch)
    }

    // Resolve current conflict
    refsTransfers.get(trid)?.onDecision(policy)

    // Move to the next item
    this.setState({
      transferToConfirm: null
    }, this.showNext)
  }

  renderContent () {
    const {
      transferToConfirm
    } = this.state
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
    } = this.state
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
          onClick={() => this.act(fileActions.skipAll)}
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
          <Button
            type='primary'
            className='mg1l'
            title={e('skipAll')}
            onClick={
              () => this.act(fileActions.skipAll)
            }
          >
            {e('skipAll')}
          </Button>
        </div>
      </div>
    )
  }

  render () {
    const {
      transferToConfirm
    } = this.state
    if (!transferToConfirm?.id) {
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
