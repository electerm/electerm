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
import postMessage from '../../common/post-msg'

const { prefix } = window
const e = prefix('sftp')

function formatTimeAuto (strOrDigit) {
  if (isString(strOrDigit)) {
    return formatTime(strOrDigit)
  }
  return formatTime(strOrDigit * 1000)
}

export default (props) => {
  if (!props.transferToConfirm) {
    return null
  }
  const {
    fromPath,
    toPath,
    fromFile: {
      isDirectory,
      name,
      id: fileId,
      modifyTime: modifyTimeFrom,
      size: sizeFrom,
      type: typeFrom
    },
    toFile: {
      modifyTime: modifyTimeTo,
      size: sizeTo,
      type: typeTo
    },
    id,
    transferGroupId
  } = props.transferToConfirm
  function act (action) {
    props.modifier({
      transferToConfirm: null
    })
    postMessage({
      transferGroupId,
      fileId,
      id,
      transfer: props.transferToConfirm,
      action
    })
  }
  function renderContent () {
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
          type='dashed'
          className='mg1l'
          onClick={() => act(fileActions.skipAll)}
        >
          {e('skipAll')}
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
