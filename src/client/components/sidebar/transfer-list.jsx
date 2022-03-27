import { Component } from '../common/react-subx'
import {
  SwapOutlined
} from '@ant-design/icons'
import {
  Badge,
  Popover
} from 'antd'
import TransferModal from './transfer-modal'
import './transfer.styl'

const { prefix } = window
const e = prefix('sftp')

export default class TransferList extends Component {
  render () {
    const { store } = this.props
    const {
      openTransferList,
      fileTransfers,
      transferHistory
    } = store
    if (!fileTransfers.length && !transferHistory.length) {
      return null
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
          content={<TransferModal store={store} />}
        >
          <Badge
            count={fileTransfers.length}
            size='small'
            offset={[-10, -5]}
            color='green'
            overflowCount={99}
          >
            <SwapOutlined
              className='iblock font20 control-icon'
              onClick={openTransferList}
            />
          </Badge>
        </Popover>
      </div>
    )
  }
}
