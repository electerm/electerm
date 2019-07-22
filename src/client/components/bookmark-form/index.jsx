/**
 * bookmark form
 */
import React from 'react'
import {
  Form, Button, Input,
  InputNumber, message,
  Radio, Upload, Tabs,
  Select, Switch
} from 'antd'
import { validateFieldsAndScroll } from '../../common/dec-validate-and-scroll'
import _ from 'lodash'
import copy from 'json-deep-copy'
import { generate } from 'shortid'
import {
  authTypeMap,
  settingMap,
  statusMap,
  defaultUserName,
  defaultookmarkGroupId
} from '../../common/constants'
import { formItemLayout, tailFormItemLayout } from '../../common/form-layout'
import InputAutoFocus from '../common/input-auto-focus'
import isIp from '../../common/is-ip'
import encodes from './encodes'
import './bookmark-form.styl'

const { TabPane } = Tabs
const { TextArea } = Input
const authTypes = Object.keys(authTypeMap).map(k => {
  return k
})
const RadioButton = Radio.Button
const RadioGroup = Radio.Group
const FormItem = Form.Item
const { Option } = Select
const { prefix } = window
const e = prefix('form')
const c = prefix('common')
const m = prefix('menu')
const s = prefix('setting')

export class BookmarkForm extends React.PureComponent {
  state = {
    testing: false,
    dns: ''
  }

  useIp = () => {
    this.props.form.setFieldsValue({
      host: this.state.dns
    })
    this.setState({
      dns: ''
    })
  }

  onPaste = e => {
    const txt = e.clipboardData.getData('Text')
    // support name:passsword@host:23
    const arr = txt.match(/([^:@]+)(:[^:@]+)?@([^:@]+)(:\d+)?/)
    if (!arr) {
      return
    }
    const username = arr[1]
    const password = arr[2] ? arr[2].slice(1) : ''
    const host = arr[3]
    const port = arr[4] ? arr[4].slice(1) : ''
    const obj = {
      username,
      host
    }
    if (password) {
      obj.password = password
    }
    if (port) {
      obj.port = port
    }
    setTimeout(() => {
      this.props.form.setFieldsValue(obj)
    }, 20)
  }

  onBlur = async e => {
    const { value } = e.target
    const { type } = this.props
    if (
      type !== settingMap.bookmarks ||
      !value || /\s/.test(value) ||
      isIp(value)
    ) {
      return
    }
    const ip = await window.getGlobal('lookup')(value)
      .catch(err => {
        log.debug(err)
      })
    this.setState({
      dns: ip || ''
    })
  }

  getBookmarkGroupId = (props = this.props) => {
    const {
      id
    } = props.formData
    const {
      bookmarkGroups,
      currentBookmarkGroupId
    } = props
    return id
      ? this.findBookmarkGroupId(bookmarkGroups, id)
      : currentBookmarkGroupId
  }

  findBookmarkGroupId = (bookmarkGroups, id) => {
    const obj = _.find(bookmarkGroups, bg => {
      return bg.bookmarkIds.includes(id)
    })
    return obj ? obj.id : defaultookmarkGroupId
  }

  updateBookmarkGroups = (bookmarkGroups, bookmark, categoryId) => {
    let index = _.findIndex(
      bookmarkGroups,
      bg => bg.id === categoryId
    )
    if (index < 0) {
      index = _.findIndex(
        bookmarkGroups,
        bg => bg.id === defaultookmarkGroupId
      )
    }
    const bid = bookmark.id
    const bg = bookmarkGroups[index]
    if (!bg.bookmarkIds.includes(bid)) {
      bg.bookmarkIds.unshift(bid)
    }
    bg.bookmarkIds = _.uniq(bg.bookmarkIds)
    bookmarkGroups = bookmarkGroups.map((bg, i) => {
      if (i === index) {
        return bg
      }
      bg.bookmarkIds = bg.bookmarkIds.filter(
        g => g !== bid
      )
      return bg
    })
    this.props.store.modifier({
      bookmarkGroups
    })
  }

  submit = (evt, item, type = this.props.type) => {
    const obj = item
    const { addItem, editItem } = this.props.store
    const categoryId = obj.category
    delete obj.category
    const bookmarkGroups = copy(
      this.props.bookmarkGroups
    )
    if (type === settingMap.history) {
      obj.id = generate()
      delete obj.type
      addItem(obj, settingMap.bookmarks)
      this.updateBookmarkGroups(
        bookmarkGroups,
        obj,
        categoryId
      )
      message.success('OK', 3)
      return
    }
    if (obj.id) {
      const tar = copy(obj)
      delete tar.id
      editItem(obj.id, tar, settingMap.bookmarks)
      this.updateBookmarkGroups(
        bookmarkGroups,
        obj,
        categoryId
      )
    } else {
      obj.id = generate()
      if (evt !== 'save') {
        addItem(obj, settingMap.history)
      }
      addItem(obj, settingMap.bookmarks)
      this.updateBookmarkGroups(
        bookmarkGroups,
        obj,
        categoryId
      )
      this.props.store.modifier({
        item: obj
      })
    }
  }

  test = async (options) => {
    const testConnection = window.getGlobal('testConnection')
    let msg = ''
    this.setState({
      testing: true
    })
    const res = await testConnection(options)
      .then(() => true)
      .catch((e) => {
        msg = e.message
        return false
      })
    this.setState({
      testing: false
    })
    if (res) {
      message.success('connection ok')
    } else {
      const err = 'connection fails' +
        (msg ? `: ${msg}` : '')
      message.error(err)
    }
  }

  reset = () => {
    this.props.form.resetFields()
  }

  onSelectProxy = proxy => {
    const obj = Object.keys(proxy)
      .reduce((prev, c) => {
        return {
          ...prev,
          [`proxy.${c}`]: proxy[c]
        }
      }, {})
    this.props.form.setFieldsValue(obj)
  }

  handleSubmit = async (evt, isTest = false) => {
    evt && evt.preventDefault && evt.preventDefault()
    const res = await this.validateFieldsAndScroll()
    if (!res) return
    if (
      res.proxy && (
        (!res.proxy.proxyIp && res.proxy.proxyPort) ||
        (!res.proxy.proxyPort && res.proxy.proxyIp)
      )
    ) {
      return message.error(
        `${e('proxyIp')} and ${e('proxyPort')} ${e('required')}`
      )
    }
    const obj = {
      ...this.props.formData,
      ...res
    }
    if (isTest) {
      return this.test(obj)
    }
    evt && this.submit(evt, obj)
    if (evt !== 'save') {
      this.props.store.addTab({
        ...copy(obj),
        srcId: obj.id,
        status: statusMap.processing,
        id: generate()
      })
      this.props.hide()
    }
  }

  beforeUpload = (file) => {
    const privateKey = window.getGlobal('fs')
      .readFileSync(file.path).toString()
    this.props.form.setFieldsValue({
      privateKey
    })
    return false
  }

  renderAuth () {
    const authType = this.props.form.getFieldValue('authType') ||
      authTypeMap.password
    return this[authType + 'Render']()
  }

  passwordRender () {
    const { getFieldDecorator } = this.props.form
    const {
      password
    } = this.props.formData
    return (
      <FormItem
        {...formItemLayout}
        label={e('password')}
        hasFeedback
      >
        {getFieldDecorator('password', {
          rules: [{
            max: 40, message: '40 chars max'
          }],
          initialValue: password
        })(
          <Input
            type='password'
            placeholder={e('password')}
          />
        )}
      </FormItem>
    )
  }

  privateKeyRender () {
    const { getFieldDecorator } = this.props.form
    const {
      privateKey,
      passphrase
    } = this.props.formData
    return [
      <FormItem
        {...formItemLayout}
        label={e('privateKey')}
        hasFeedback
        key='privateKey'
        className='mg1b'
      >
        {getFieldDecorator('privateKey', {
          rules: [{
            max: 13000, message: '13000 chars max'
          }],
          initialValue: privateKey
        })(
          <TextArea
            placeholder={e('privateKeyDesc')}
            rows={2}
          />
        )}
        <Upload
          beforeUpload={this.beforeUpload}
          fileList={[]}
          className='mg1b'
        >
          <Button
            type='ghost'
          >
            {e('importFromFile')}
          </Button>
        </Upload>
      </FormItem>,
      <FormItem
        key='passphrase'
        {...formItemLayout}
        label={e('passphrase')}
        hasFeedback
      >
        {getFieldDecorator('passphrase', {
          rules: [{
            max: 100, message: '100 chars max'
          }],
          initialValue: passphrase
        })(
          <Input
            type='password'
            placeholder={e('passphraseDesc')}
          />
        )}
      </FormItem>
    ]
  }

  renderTitle (type, id) {
    if (type !== settingMap.bookmarks) {
      return null
    }
    return (
      <FormItem {...tailFormItemLayout} className='mg0 font14'>
        {
          (id
            ? m('edit')
            : s('new')
          ) + ' ' + c(settingMap.bookmarks)
        }
      </FormItem>
    )
  }

  renderProxySelect = () => {
    const proxyList = this.props.bookmarks
      .reduce((prev, current) => {
        const { proxy } = current
        const {
          proxyIp,
          proxyPort,
          proxyType
        } = proxy || {}
        if (!proxy || !proxyIp || !proxyPort) {
          return prev
        }
        const id = proxyType === '0'
          ? `http://${proxyIp}:${proxyPort}`
          : `socks${proxyType}://${proxyIp}:${proxyPort}`
        return {
          ...prev,
          [id]: proxy
        }
      }, {})
    const keys = Object.keys(proxyList)
    if (!keys.length) {
      return null
    }
    return (
      <FormItem
        {...tailFormItemLayout}
        className='mg0'
        key='proxy-select'
      >
        <Select
          placeholder={e('selectProxy')}
          value={undefined}
          onSelect={
            v => this.onSelectProxy(proxyList[v])
          }
        >
          {
            keys.map(k => {
              return (
                <Option
                  value={k}
                  key={k}
                >
                  {k}
                </Option>
              )
            })
          }
        </Select>
      </FormItem>
    )
  }

  renderProxy () {
    const { getFieldDecorator } = this.props.form
    const {
      proxy = {}
    } = this.props.formData
    const { proxyIp, proxyPort, proxyType = '5' } = proxy
    return [
      this.renderProxySelect(),
      <FormItem
        {...formItemLayout}
        label={e('proxyIp')}
        key='proxyIp'
      >
        {getFieldDecorator('proxy.proxyIp', {
          rules: [{
            max: 130, message: '130 chars max'
          }],
          initialValue: proxyIp
        })(
          <Input
            placeholder={e('proxyIpPlaceholder')}
          />
        )}
      </FormItem>,
      <FormItem
        {...formItemLayout}
        label={e('proxyPort')}
        key='proxyPort'
      >
        {getFieldDecorator('proxy.proxyPort', {
          initialValue: proxyPort
        })(
          <InputNumber
            placeholder={e('proxyPort')}
            min={1}
            max={65535}
            step={1}
          />
        )}
      </FormItem>,
      <FormItem
        {...formItemLayout}
        label={e('proxyType')}
        key='proxyType'
      >
        {getFieldDecorator('proxy.proxyType', {
          initialValue: proxyType
        })(
          <Select>
            <Option value='5'>SOCKS5</Option>
            <Option value='4'>SOCKS4</Option>
            <Option value='0'>HTTP</Option>
          </Select>
        )}
      </FormItem>
    ]
  }

  renderCommon () {
    const { getFieldDecorator } = this.props.form
    const {
      host,
      port = 22,
      title,
      loginScript,
      authType = authTypeMap.password,
      username,
      id,
      encode = encodes[0]
    } = this.props.formData
    const {
      autofocustrigger,
      bookmarkGroups,
      currentBookmarkGroupId
    } = this.props
    const { dns } = this.state
    const initBookmarkGroupId = id
      ? this.findBookmarkGroupId(bookmarkGroups, id)
      : currentBookmarkGroupId

    return (
      <div>
        <FormItem
          {...formItemLayout}
          label={e('host')}
          hasFeedback
        >
          {
            dns
              ? (
                <div className='dns-section'>
                  ip: {dns}
                  <span
                    className='color-blue pointer mg1l'
                    onClick={this.useIp}
                  >
                    {e('use')}
                  </span>
                </div>
              )
              : (
                <div className='dns-section'>
                  hostname or ip
                </div>
              )
          }
          {getFieldDecorator('host', {
            rules: [{
              max: 130, message: '130 chars max'
            }, {
              required: true, message: 'host required'
            }],
            initialValue: host
          })(
            <InputAutoFocus
              autofocustrigger={autofocustrigger}
              selectall='true'
              onBlur={this.onBlur}
              onPaste={this.onPaste}
            />
          )}
        </FormItem>
        <FormItem
          {...formItemLayout}
          label={e('username')}
          hasFeedback
        >
          {getFieldDecorator('username', {
            rules: [{
              max: 30, message: '30 chars max'
            }, {
              required: true, message: 'username required'
            }],
            initialValue: username
          })(
            <Input placeholder={defaultUserName} />
          )}
        </FormItem>
        <FormItem {...tailFormItemLayout} className='mg1b'>
          {getFieldDecorator('authType', {
            initialValue: authType
          })(
            <RadioGroup size='small'>
              {
                authTypes.map(t => {
                  return (
                    <RadioButton value={t} key={t}>
                      {e(t)}
                    </RadioButton>
                  )
                })
              }
            </RadioGroup>
          )}
        </FormItem>
        {this.renderAuth()}
        <FormItem
          {...formItemLayout}
          label={e('port')}
          hasFeedback
        >
          {getFieldDecorator('port', {
            rules: [{
              required: true, message: 'port required'
            }],
            initialValue: port
          })(
            <InputNumber
              placeholder={e('port')}
              min={1}
              max={65535}
              step={1}
            />
          )}
        </FormItem>
        <FormItem
          {...formItemLayout}
          label={c('bookmarkCategory')}
        >
          {getFieldDecorator('category', {
            initialValue: initBookmarkGroupId
          })(
            <Select showSearch>
              {
                bookmarkGroups.map(bg => {
                  return (
                    <Option
                      value={bg.id}
                      key={bg.id}
                    >
                      {bg.title}
                    </Option>
                  )
                })
              }
            </Select>
          )}
        </FormItem>
        <FormItem
          {...formItemLayout}
          label={e('title')}
          hasFeedback
        >
          {getFieldDecorator('title', {
            initialValue: title
          })(
            <Input />
          )}
        </FormItem>
        <FormItem
          {...formItemLayout}
          label={e('loginScript')}
        >
          {getFieldDecorator('loginScript', {
            initialValue: loginScript
          })(
            <div>
              <Input.TextArea rows={1}>{loginScript}</Input.TextArea>
              <div>* {e('loginScriptTip')}</div>
            </div>
          )}
        </FormItem>
        <FormItem
          {...formItemLayout}
          key='encode-select'
          label={e('encode')}
        >
          {getFieldDecorator('encode', {
            initialValue: encode
          })(
            <Select
              showSearch
            >
              {
                encodes.map(k => {
                  return (
                    <Option
                      value={k}
                      key={k}
                    >
                      {k}
                    </Option>
                  )
                })
              }
            </Select>
          )}
        </FormItem>
      </div>
    )
  }

  renderUI = () => {
    const { getFieldDecorator } = this.props.form
    const {
      fontFamily: defaultFontFamily,
      fontSize: defaultFontSize
    } = this.props.config.defaultSettings || {}
    const {
      fontFamily,
      fontSize
    } = this.props.formData
    return [
      <FormItem
        {...formItemLayout}
        label={s('fontFamily')}
        key='fontFamily'
      >
        {getFieldDecorator('fontFamily', {
          rules: [{
            max: 130, message: '130 chars max'
          }],
          initialValue: fontFamily
        })(
          <Input placeholder={defaultFontFamily + ''} />
        )}
      </FormItem>,
      <FormItem
        key='fontSize'
        {...formItemLayout}
        label={s('fontSize')}
      >
        {getFieldDecorator('fontSize', {
          initialValue: fontSize
        })(
          <InputNumber
            min={9}
            max={65535}
            step={1}
            placeholder={defaultFontSize}
          />
        )}
      </FormItem>
    ]
  }

  renderX11 = () => {
    const { x11 = false } = this.props.formData
    const { getFieldDecorator } = this.props.form
    return (
      <FormItem
        {...formItemLayout}
        label='x11'
      >
        {getFieldDecorator('x11', {
          initialValue: x11,
          valuePropName: 'checked'
        })(
          <Switch />
        )}
      </FormItem>
    )
  }

  renderTabs () {
    return (
      <Tabs type='card'>
        <TabPane tab={e('auth')} key='auth' forceRender>
          {this.renderCommon()}
        </TabPane>
        <TabPane tab='x11' key='x11' forceRender>
          {this.renderX11()}
        </TabPane>
        <TabPane tab={e('proxy')} key='proxy' forceRender>
          {this.renderProxy()}
        </TabPane>
        <TabPane tab={e('UI')} key='UI' forceRender>
          {this.renderUI()}
        </TabPane>
      </Tabs>
    )
  }

  render () {
    const {
      id
    } = this.props.formData
    const {
      type
    } = this.props
    return (
      <Form onSubmit={this.handleSubmit} className='form-wrap pd1x'>
        {this.renderTitle(type, id)}
        {this.renderTabs()}
        <FormItem {...tailFormItemLayout}>
          <p>
            <Button
              type='primary'
              htmlType='submit'
              className='mg1r'
            >{e('saveAndConnect')}</Button>
            <Button
              type='ghost'
              className='mg1r'
              onClick={() => this.handleSubmit('save')}
            >{e('save')}</Button>
            <Button
              type='ghost'
              onClick={this.handleSubmit}
              className='mg2r'
            >{e('connect')}</Button>
          </p>
          <p>
            <Button
              type='ghost'
              loading={this.state.testing}
              onClick={e => this.handleSubmit(e, true)}
            >{e('testConnection')}</Button>
          </p>
        </FormItem>
      </Form>
    )
  }
}

@Form.create()
@validateFieldsAndScroll
class BookmarkFormExport extends BookmarkForm {}

export default BookmarkFormExport
