import {
  SwapOutlined
} from '@ant-design/icons'
import {
  Badge,
  Popover
} from 'antd'
import TransferModal from './transfer-modal'
import { memo } from 'react'
import './transfer.styl'

const e = window.translate

export default memo(function TransferList (props) {
  const {
    fileTransfers,
    transferHistory
  } = props
  const len = fileTransfers.length
  if (!len && !transferHistory.length) {
    return null
  }
  const color = fileTransfers.some(item => item.error) ? 'red' : 'green'
  const bdProps = {
    className: len ? 'hvr-bob hvr-bob-fast' : '',
    count: len,
    size: 'small',
    offset: [-10, -5],
    color,
    overflowCount: 99
  }
  return (
    <div
      className='control-icon-wrap'
      title={e('fileTransfers')}
    >
      <Popover
        placement='right'
        destroyTooltipOnHide
        overlayClassName='transfer-list-card'
        content={<TransferModal store={window.store} />}
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
