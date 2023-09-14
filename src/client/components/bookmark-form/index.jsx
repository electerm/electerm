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
  terminalTelnetType,
  newBookmarkIdPrefix
} from '../../common/constants'
import SshForm from './ssh-form'
import SerialForm from './serial-form'
import LocalForm from './local-form'
import TelnetForm from './telnet-form'
import {
  LoadingOutlined,
  BookOutlined
} from '@ant-design/icons'

const { prefix } = window
const c = prefix('common')
const m = prefix('menu')
const s = prefix('setting')
const p = prefix('sftp')

export default class BookmarkIndex extends Component {
  constructor (props) {
    super(props)
    let initType = props.formData.type
    if (initType === terminalTelnetType) {
      initType = terminalTelnetType
    } else if (initType === terminalSerialType) {
      initType = terminalSerialType
    } else if (initType === terminalLocalType) {
      initType = terminalLocalType
    } else {
      initType = connectionMap.ssh
    }
    this.state = {
      ready: false,
      bookmarkType: initType
    }
  }

  componentDidMount () {
    this.timer = setTimeout(() => {
      this.setState({
        ready: true
      })
    }, 200)
  }

  componentWillUnmount () {
    clearTimeout(this.timer)
  }

  static mapper = {
    [connectionMap.ssh]: SshForm,
    [connectionMap.telnet]: TelnetForm,
    [connectionMap.serial]: SerialForm,
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
    const { ready } = this.state
    if (!ready) {
      return (
        <div className='pd3 aligncenter'>
          <LoadingOutlined />
        </div>
      )
    }
    const {
      bookmarkType
    } = this.state
    const Form = BookmarkIndex.mapper[bookmarkType]
    const isNew = id.startsWith(newBookmarkIdPrefix)
    const keys = Object.keys(connectionMap)
    // if (isWin) {
    //   keys = keys.filter(k => k !== connectionMap.serial)
    // }
    return (
      <div className='form-wrap pd1x'>
        <div className='form-title pd1t pd1x pd2b'>
          <BookOutlined className='mg1r' />
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
