import { PureComponent } from 'react'
import Confirms from './confirm-modal'
import ConflictHandler from './transfer-conflict'
import TransfersHandler from './transports-action'
import deepCopy from 'json-deep-copy'
import runIdle from '../../common/run-idle'
import { commonActions } from '../../common/constants'
import { pick } from 'lodash-es'

export default class TransferEntry extends PureComponent {
  constructor (props) {
    super(props)
    this.state = {
      transferToConfirm: null,
      transferList: [],
      pauseAll: false
    }
  }

  componentDidMount () {
    window.addEventListener('message', this.onAdd)
  }

  componentWillUnmount () {
    window.removeEventListener('message', this.onAdd)
  }

  onAdd = e => {
    const {
      sessionId,
      list,
      action
    } = e?.data || {}
    if (
      action !== commonActions.addTransfer ||
      sessionId !== this.props.sessionId
    ) {
      return false
    }
    this.addTransferList(list)
  }

  modifier = (...args) => {
    runIdle(() => this.setState(...args))
  }

  addTransferList = list => {
    this.modifier((old) => {
      let transferList = deepCopy(old.transferList)
      transferList = [
        ...transferList,
        ...list
      ]
      window.store.setTransfers(transferList)
      return {
        transferList
      }
    })
  }

  render () {
    const prps1 = {
      transferToConfirm: this.state.transferToConfirm,
      modifier: this.modifier
    }
    const prps2 = {
      transferList: this.state.transferList,
      modifier: this.modifier,
      addTransferList: this.addTransferList,
      transferToConfirm: this.state.transferToConfirm,
      ...pick(this.props, [
        'localList',
        'remoteList',
        'sftp',
        'sessionId',
        'host',
        'tab'
      ])
    }
    const prps3 = {
      transferList: this.state.transferList,
      modifier: this.modifier,
      pauseAll: this.state.pauseAll,
      localList: this.props.localListDebounce,
      remoteList: this.props.remoteListDebounce,
      ...pick(this.props, [
        'sftp',
        'config',
        'tab',
        'sessionId',
        'pid'
      ])
    }
    return (
      <div>
        <ConflictHandler
          {...prps2}
        />
        <TransfersHandler
          {...prps3}
        />
        <Confirms
          {...prps1}
        />
      </div>
    )
  }
}
