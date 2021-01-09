/**
 * bookmark form
 */
import { Component } from '../common/react-subx'
import {
  Radio
} from 'antd'
import {
  settingMap,
  connectionMap,
  terminalSerialType,
  terminalLocalType,
  newBookmarkIdPrefix,
  isWin
} from '../../common/constants'
import SshForm from './ssh-form'
// import SerialForm from './serial-form'
import LocalForm from './local-form'

const { prefix } = window
const c = prefix('common')
const m = prefix('menu')
const s = prefix('setting')
const p = prefix('sftp')

export default class BookmarkIndex extends Component {
  constructor (props) {
    super(props)
    let initType = props.formData.type
    if (initType === terminalSerialType) {
      initType = terminalSerialType
    } else if (initType === terminalLocalType) {
      initType = terminalLocalType
    } else {
      initType = connectionMap.ssh
    }
    this.state = {
      bookmarkType: initType
    }
  }

  static mapper = {
    [connectionMap.ssh]: SshForm,
    // [connectionMap.serial]: SerialForm,
    [connectionMap.local]: LocalForm
  }

  handleChange = (e) => {
    this.setState({
      bookmarkType: e.target.value
    })
  }

  render () {
    const {
      id = ''
    } = this.props.formData
    const {
      type
    } = this.props
    if (type !== settingMap.bookmarks && type !== settingMap.history) {
      return null
    }

    const {
      bookmarkType
    } = this.state
    const Form = BookmarkIndex.mapper[bookmarkType]
    const isNew = id.startsWith(newBookmarkIdPrefix)
    let keys = Object.keys(connectionMap)
    if (isWin) {
      keys = keys.filter(k => k !== connectionMap.serial)
    }
    return (
      <div className='form-wrap pd1x'>
        <div className='form-title pd1t pd1x pd2b'>
          {
            (!isNew
              ? m('edit')
              : s('new')
            ) + ' ' + c(settingMap.bookmarks)
          }
          <Radio.Group
            buttonStyle='solid'
            size='small'
            className='mg1l'
            value={bookmarkType}
            disabled={!isNew}
            onChange={this.handleChange}
          >
            {
              keys.map(k => {
                const v = connectionMap[k]
                return (
                  <Radio.Button key={v} value={v}>{p(v)}</Radio.Button>
                )
              })
            }
          </Radio.Group>
        </div>
        <Form {...this.props} />
      </div>
    )
  }
}
