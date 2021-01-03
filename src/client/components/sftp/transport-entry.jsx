
import { PureComponent } from 'react'
import Confirms from './confirm-modal'
import ConflictHandler from './transfer-conflict'
import TransfersHandler from './transports-action'
import deepCopy from 'json-deep-copy'
import runIdle from '../../common/run-idle'
import _ from 'lodash'

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
    if (!e || !e.data || e.data.sessionId !== this.props.sessionId) {
      return false
    }
    this.addTransferList(e.data.list)
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
      ..._.pick(this.props, [
        'localList',
        'remoteList',
        'sftp',
        'sessionId',
        'store',
        'host'
      ])
    }
    const prps3 = {
      transferList: this.state.transferList,
      modifier: this.modifier,
      pauseAll: this.state.pauseAll,
      localList: this.props.localListDebounce,
      remoteList: this.props.remoteListDebounce,
      ..._.pick(this.props, [
        'sftp',
        'config',
        'store',
        'tab'
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
