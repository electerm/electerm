import { memo } from 'react'
import {
  SwapOutlined
} from '@ant-design/icons'
import {
  Badge,
  Popover
} from 'antd'
import TransferModal from './transfer-modal'
import './transfer.styl'

const e = window.translate

export default memo(function TransferList (props) {
  const {
    fileTransfers,
    transferTab,
    transferHistory
  } = props
  const len = fileTransfers.length
  if (!len && !transferHistory.length) {
    return null
  }
  const color = fileTransfers.some(item => item.error) ? 'red' : 'green'
  const bdProps = {
    count: len,
    size: 'small',
    offset: [-10, -5],
    color,
    overflowCount: 99
  }
  const transferModalProps = {
    fileTransfers,
    transferHistory,
    transferTab
  }
  const popProps = {
    placement: 'right',
    destroyOnHidden: true,
    overlayClassName: 'transfer-list-card',
    content: <TransferModal {...transferModalProps} />
  }
  return (
    <div
      className='control-icon-wrap'
      title={e('fileTransfers')}
    >
      <Popover
        {...popProps}
      >
        <Badge
          {...bdProps}
        >
          <SwapOutlined
            className='iblock font20 control-icon'
          />
        </Badge>
      </Popover>
    </div>
  )
})
