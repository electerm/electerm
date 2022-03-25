import { Component } from '../common/react-subx'
import {
  SwapOutlined
} from '@ant-design/icons'

const { prefix } = window
const e = prefix('sftp')

export default class TransferList extends Component {
  render () {
    const {
      openTransferList
    } = this.props.store
    return (
      <div
        className='control-icon-wrap'
        title={e('fileTransfers')}
      >
        <SwapOutlined
          className='iblock font20 control-icon'
          onClick={openTransferList}
        />
      </div>
    )
  }
}
