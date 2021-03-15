/**
 * confirm modal for transfer conflict
 *
 */

import { Modal, Button } from 'antd'
import AnimateText from '../common/animate-text'
import formatTime from '../../../app/common/time'
import { FolderOutlined, FileOutlined } from '@ant-design/icons'

const { prefix } = window
const e = prefix('sftp')

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
    window.postMessage({
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
    const typeTitle = e(typeFrom)
    const otherTypeTitle = e(typeTo)
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
            {e('size')}: {sizeTo}, {e('modifyTime')}: {formatTime(modifyTimeTo)}
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
            {e('size')}: {sizeFrom}, {e('modifyTime')}: {formatTime(modifyTimeFrom)}
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
          type='ghost'
          className='mg1l'
          onClick={() => act('cancel')}
        >
          {e('cancel')}
        </Button>
        <Button
          type='ghost'
          className='mg1l'
          onClick={() => act('skip')}
        >
          {e('skip')}
        </Button>
        <Button
          type='primary'
          className='mg1l'
          onClick={
            () => act('mergeOrOverwrite')
          }
        >
          {isDirectory ? e('merge') : e('overwrite')}
        </Button>
        <Button
          type='primary'
          className='mg1l'
          onClick={
            () => act('rename')
          }
        >
          {e('rename')}
        </Button>
        <div className='pd1t'>
          <Button
            type='ghost'
            className='mg1l'
            title={
              isDirectory
                ? e('mergeDesc')
                : e('overwriteDesc')
            }
            onClick={
              () => act('mergeOrOverwriteAll')
            }
          >
            {isDirectory ? e('mergeAll') : e('overwriteAll')}
          </Button>
          <Button
            type='primary'
            className='mg1l'
            title={e('renameDesc')}
            onClick={
              () => act('renameAll')
            }
          >
            {e('renameAll')}
          </Button>
        </div>
      </div>
    )
  }
  const modalProps = {
    visible: true,
    width: 500,
    title: e('fileConflict'),
    footer: renderFooter(),
    onCancel: () => act('cancel')
  }
  return (
    <Modal
      {...modalProps}
    >
      {renderContent()}
    </Modal>
  )
}
