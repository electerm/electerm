/**
 * bookmark form
 */
import { PureComponent } from 'react'
import {
  Radio
} from 'antd'
import {
  settingMap,
  connectionMap,
  terminalSerialType,
  terminalWebType,
  terminalRdpType,
  terminalVncType,
  terminalLocalType,
  terminalTelnetType,
  newBookmarkIdPrefix
} from '../../common/constants'
import SshForm from './ssh-form'
import SerialForm from './serial-form'
import LocalForm from './local-form'
import TelnetForm from './telnet-form'
import WebForm from './web-form'
import RdpForm from './rdp-form'
import VncForm from './vnc-form'
import { createTitleWithTag } from '../../common/create-title'
import {
  LoadingOutlined,
  BookOutlined
} from '@ant-design/icons'

const e = window.translate

export default class BookmarkIndex extends PureComponent {
  constructor (props) {
    super(props)
    let initType = props.formData.type
    if (
      ![
        terminalTelnetType,
        terminalWebType,
        terminalLocalType,
        terminalSerialType,
        terminalRdpType,
        terminalVncType
      ].includes(initType)
    ) {
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
    [connectionMap.local]: LocalForm,
    [connectionMap.web]: WebForm,
    [connectionMap.rdp]: RdpForm,
    [connectionMap.vnc]: VncForm
  }

  handleChange = (e) => {
    this.setState({
      bookmarkType: e.target.value
    })
  }

  renderTypes (bookmarkType, isNew, keys) {
    if (!isNew) {
      return null
    }
    return (
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
              <Radio.Button key={v} value={v}>{e(v)}</Radio.Button>
            )
          })
        }
      </Radio.Group>
    )
  }

  renderTitle (formData, isNew) {
    if (isNew) {
      return null
    }
    return (
      <b className='mg1x'>
        {createTitleWithTag(formData)}
      </b>
    )
  }

  render () {
    const { formData } = this.props
    const {
      id = ''
    } = formData
    const {
      type
    } = this.props
    if (type !== settingMap.bookmarks) {
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
          <span>
            {
              (!isNew
                ? e('edit')
                : e('new')
              ) + ' ' + e(settingMap.bookmarks)
            }
          </span>
          {this.renderTitle(formData, isNew)}
          {this.renderTypes(bookmarkType, isNew, keys)}
        </div>
        <Form {...this.props} />
      </div>
    )
  }
}
