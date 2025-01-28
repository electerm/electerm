/**
 * confirm modal for transfer conflict
 *
 */

import { Modal, Button } from 'antd'
import { isString } from 'lodash-es'
import AnimateText from '../common/animate-text'
import formatTime from '../../common/time'
import { FolderOutlined, FileOutlined } from '@ant-design/icons'
import {
  fileActions
} from '../../common/constants'
import deepCopy from 'json-deep-copy'
import { refsStatic } from '../common/ref'

const e = window.translate

function formatTimeAuto (strOrDigit) {
  if (isString(strOrDigit)) {
    return formatTime(strOrDigit)
  }
  return formatTime(strOrDigit * 1000)
}

export default function ConfirmModalStore (props) {
  function act (action) {
    const { transferToConfirm } = props
    window.store.transferToConfirm = {}
    const {
      fromFile: {
        id: fileId
      },
      id,
      transferGroupId
    } = transferToConfirm
    refsStatic.get('transfer-conflict')?.onDecision({
      transferGroupId,
      fileId,
      id,
      transfer: deepCopy(transferToConfirm),
      action
    })
  }

  function renderContent () {
    const {
      transferToConfirm
    } = props
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

  function renderFooter () {
    const {
      transferToConfirm
    } = props
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
          onClick={() => act(fileActions.cancel)}
        >
          {e('cancel')}
        </Button>
        <Button
          type='dashed'
          className='mg1l'
          onClick={() => act(fileActions.skip)}
        >
          {e('skip')}
        </Button>
        <Button
          danger
          className='mg1l'
          onClick={
            () => act(fileActions.mergeOrOverwrite)
          }
        >
          {isDirectory ? e('merge') : e('overwrite')}
        </Button>
        <Button
          type='primary'
          className='mg1l'
          onClick={
            () => act(fileActions.rename)
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
              () => act(fileActions.mergeOrOverwriteAll)
            }
          >
            {isDirectory ? e('mergeAll') : e('overwriteAll')}
          </Button>
          <Button
            type='primary'
            className='mg1l'
            title={e('renameDesc')}
            onClick={
              () => act(fileActions.renameAll)
            }
          >
            {e('renameAll')}
          </Button>
        </div>
      </div>
    )
  }

  const {
    transferToConfirm
  } = props
  if (!transferToConfirm.id) {
    return null
  }
  const modalProps = {
    open: true,
    width: 500,
    title: e('fileConflict'),
    footer: renderFooter(),
    onCancel: () => act(fileActions.cancel)
  }
  return (
    <Modal
      {...modalProps}
    >
      {renderContent()}
    </Modal>
  )
}
