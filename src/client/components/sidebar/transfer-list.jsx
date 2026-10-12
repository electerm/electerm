import { memo, useState } from 'react'
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
  // click to toggle: the popover is controlled so the icon opens *and*
  // closes it, and so the modal's own close button can dismiss it. The old
  // hover trigger made the panel vanish the moment the pointer left it,
  // which is unusable now that it holds a table you want to read.
  const [open, setOpen] = useState(false)
  const len = fileTransfers.length
  if (!len && !transferHistory.length) {
    return null
  }
  const color = fileTransfers.some(item => item.error) ? 'red' : 'green'
  const bdProps = {
    count: len,
    size: 'small',
    offset: [0, 0],
    color,
    overflowCount: 99
  }
  const transferModalProps = {
    fileTransfers,
    transferHistory,
    transferTab,
    onClose: () => setOpen(false)
  }
  const popProps = {
    placement: 'right',
    destroyOnHidden: true,
    classNames: { root: 'transfer-list-card' },
    content: <TransferModal {...transferModalProps} />,
    trigger: 'click',
    open,
    onOpenChange: setOpen
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
