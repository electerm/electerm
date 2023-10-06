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
      fileTransfers,
      transferHistory
    } = store
    if (!fileTransfers.length && !transferHistory.length) {
      return null
    }
    const color = fileTransfers.some(item => item.error) ? 'red' : 'green'
    const bdProps = {
      count: fileTransfers.length,
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
          content={<TransferModal store={store} />}
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
  }
}
