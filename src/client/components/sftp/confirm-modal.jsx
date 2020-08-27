/**
 * confirm modal for transfer conflict
 *
 */

import { Modal, Button, Icon } from 'antd'
import { typeMap } from '../../common/constants'
import resolve from '../../common/resolve'
import AnimateText from '../common/animate-text'

const { prefix } = window
const e = prefix('sftp')

export default (props) => {
  function renderContent () {
    const {
      isDirectory,
      name
    } = currentFile
    const { targetTransferPath } = this.props
    const transport = this.findParentTransport(currentFile)
    let targetPath
    if (transport) {
      targetPath = resolve(targetTransferPath, name)
    } else {
      targetPath = this.getTargetPath(currentFile)
    }
    const {
      srcTransferType,
      targetTransferType,
      fromPath,
      toPath
    } = this.createTransfer(currentFile, targetPath)
    const action = isDirectory ? e('merge') : e('replace')
    const typeTxt = isDirectory ? e('folder') : e('file')
    const typeTitle = targetTransferType === typeMap.local
      ? e(typeMap.local)
      : e(typeMap.remote)
    const otherTypeTitle = srcTransferType === typeMap.remote
      ? e(typeMap.remote)
      : e(typeMap.local)
    return (
      <div className='confirms-content-wrap'>
        <AnimateText>
          <p className='pd1b color-red font13'>
            {action}
          </p>
          <p className='bold font14'>
            {typeTitle} {typeTxt}: <Icon type={typeTxt} className='mg1r' />{name}
          </p>
          <p className='pd1b'>
            ({toPath})
          </p>
          <p>
            with
          </p>
          <p className='bold font14'>
            {otherTypeTitle} {typeTxt}: <Icon type={typeTxt} className='mg1r' />{name}
          </p>
          <p className='pd1b'>
            ({fromPath})
          </p>
        </AnimateText>
      </div>
    )
  }
  function renderFooter () {
    const { currentFile, index, files } = this.state
    if (!currentFile) {
      return null
    }
    const { isDirectory } = currentFile
    const hasMoreFile = index < files.length - 1
    return (
      <div className='mgq1t pd1y alignright'>
        <Button
          type='ghost'
          className='mg1l'
          onClick={this.cancel}
        >
          {e('cancel')}
        </Button>
        <Button
          type='ghost'
          className='mg1l'
          onClick={this.skip}
        >
          {e('skip')}
        </Button>
        <Button
          type='primary'
          className='mg1l'
          onClick={
            this.mergeOrOverwrite
          }
        >
          {isDirectory ? e('merge') : e('overwrite')}
        </Button>
        <Button
          type='primary'
          className='mg1l'
          onClick={
            this.rename
          }
        >
          {e('rename')}
        </Button>
        <div className='pd1t' />
        {
          hasMoreFile
            ? (
              <Button
                type='ghost'
                className='mg1l'
                title={
                  isDirectory
                    ? e('mergeDesc')
                    : e('overwriteDesc')
                }
                onClick={
                  this.mergeOrOverwriteAll
                }
              >
                {isDirectory ? e('mergeAll') : e('overwriteAll')}
              </Button>
            )
            : null
        }
        {
          hasMoreFile
            ? (
              <Button
                type='primary'
                className='mg1l'
                title={e('renameDesc')}
                onClick={
                  this.renameAll
                }
              >
                {e('renameAll')}
              </Button>
            )
            : null
        }
      </div>
    )
  }
  const modalProps = {
    visible: true,
    width: 500,
    title: e('fileConflict'),
    footer: renderFooter(),
    onCancel: props.closeModal
  }
  return (
    <Modal
      {...modalProps}
    >
      {renderContent()}
    </Modal>
  )
}
