/**
 * Config-driven bookmark form (drop-in replacement)
 */
import { PureComponent } from 'react'
import { Radio } from 'antd'
import {
  settingMap,
  connectionMap,
  terminalSerialType,
  terminalWebType,
  terminalRdpType,
  terminalVncType,
  terminalLocalType,
  terminalTelnetType,
  terminalFtpType,
  newBookmarkIdPrefix
} from '../../common/constants'
import { createTitleWithTag } from '../../common/create-title'
import { LoadingOutlined, BookOutlined } from '@ant-design/icons'
import sessionConfig from './config/session-config'
import renderForm from './render-form'
import './bookmark-form.styl'

const e = window.translate

export default class BookmarkIndex2 extends PureComponent {
  constructor (props) {
    super(props)
    let initType = props.formData.type
    if (![
      terminalTelnetType,
      terminalWebType,
      terminalLocalType,
      terminalSerialType,
      terminalRdpType,
      terminalVncType,
      terminalFtpType
    ].includes(initType)) {
      initType = connectionMap.ssh
    }
    this.state = { ready: false, bookmarkType: initType }
  }

  componentDidMount () {
    this.timer = setTimeout(() => this.setState({ ready: true }), 100)
  }

  componentWillUnmount () {
    clearTimeout(this.timer)
  }

  handleChange = (e) => {
    this.setState({ bookmarkType: e.target.value })
  }

  renderTypes (bookmarkType, isNew, keys) {
    if (!isNew) return null
    return (
      <Radio.Group
        buttonStyle='solid'
        size='small'
        className='mg1l'
        value={bookmarkType}
        disabled={!isNew}
        onChange={this.handleChange}
      >
        {keys.map(v => {
          const txt = v === 'ssh' ? 'Ssh/Sftp' : e(v)
          return (<Radio.Button key={v} value={v}>{txt}</Radio.Button>)
        })}
      </Radio.Group>
    )
  }

  renderTitle (formData, isNew) {
    if (isNew) return null
    return (
      <b className='mg1x'>
        {createTitleWithTag(formData)}
      </b>
    )
  }

  render () {
    const { formData } = this.props
    const { id = '' } = formData
    const { type } = this.props
    if (type !== settingMap.bookmarks) return null
    const { ready, bookmarkType } = this.state
    if (!ready) {
      return (
        <div className='pd3 aligncenter'>
          <LoadingOutlined />
        </div>
      )
    }
    const isNew = id.startsWith(newBookmarkIdPrefix)
    const keys = Object.keys(sessionConfig)
    return (
      <div className='form-wrap pd1x'>
        <div className='form-title pd1t pd1x pd2b'>
          <BookOutlined className='mg1r' />
          <span>
            {((!isNew ? e('edit') : e('new')) + ' ' + e(settingMap.bookmarks))}
          </span>
          {this.renderTitle(formData, isNew)}
          {this.renderTypes(bookmarkType, isNew, keys)}
        </div>
        {renderForm(bookmarkType, this.props)}
      </div>
    )
  }
}
