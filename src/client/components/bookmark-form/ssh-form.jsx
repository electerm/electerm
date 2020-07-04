/**
 * bookmark form
 */
import React from 'react'
import {
  Form, Button, Input,
  InputNumber, message,
  Radio, Upload, Tabs,
  TreeSelect,
  Select, Switch, AutoComplete,
  Row, Col
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
  defaultBookmarkGroupId,
  defaultLoginScriptDelay,
  newBookmarkIdPrefix
} from '../../common/constants'
import { formItemLayout, tailFormItemLayout } from '../../common/form-layout'
import InputAutoFocus from '../common/input-auto-focus'
import isIp from '../../common/is-ip'
import encodes from './encodes'
import QmList from './quick-command-list'
import getInitItem from '../../common/init-setting-item'
import formatBookmarkGroups from './bookmark-group-tree-format'
import defaultSettings from '../../../app/common/default-setting'
import testConnection from '../../common/test-connection'
import findBookmarkGroupId from '../../common/find-bookmark-group-id'
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
const s = prefix('setting')
const sf = prefix('sftp')

export class BookmarkForm extends React.PureComponent {
  state = {
    testing: false,
    dns: ''
  }

  trim = (v) => {
    return (v || '').replace(/^\s+|\s+$/g, '')
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
      ? findBookmarkGroupId(bookmarkGroups, id)
      : currentBookmarkGroupId
  }

  updateBookmarkGroups = (bookmarkGroups, bookmark, categoryId) => {
    let index = _.findIndex(
      bookmarkGroups,
      bg => bg.id === categoryId
    )
    if (index < 0) {
      index = _.findIndex(
        bookmarkGroups,
        bg => bg.id === defaultBookmarkGroupId
      )
    }
    const bid = bookmark.id
    const bg = bookmarkGroups[index]
    const updates = []
    const old = copy(bg.bookmarkIds)
    if (!bg.bookmarkIds.includes(bid)) {
      bg.bookmarkIds.unshift(bid)
    }
    bg.bookmarkIds = _.uniq(bg.bookmarkIds)
    if (!_.isEqual(bg.bookmarkIds, old)) {
      updates.push({
        id: bg.id,
        db: 'bookmarkGroups',
        update: {
          bookmarkIds: bg.bookmarkIds
        }
      })
    }
    bookmarkGroups = bookmarkGroups.map((bg, i) => {
      if (i === index) {
        return bg
      }
      const olde = copy(bg.bookmarkIds)
      bg.bookmarkIds = bg.bookmarkIds.filter(
        g => g !== bid
      )
      if (!_.isEqual(bg.bookmarkIds, olde)) {
        updates.push({
          id: bg.id,
          db: 'bookmarkGroups',
          update: {
            bookmarkIds: bg.bookmarkIds
          }
        })
      }
      return bg
    })
    this.props.store.storeAssign({
      bookmarkGroups
    })
    this.props.store.batchDbUpdate(updates)
    message.success('OK', 3)
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
      addItem(obj, settingMap.bookmarks)
      this.updateBookmarkGroups(
        bookmarkGroups,
        obj,
        categoryId
      )
      message.success('OK', 3)
      return
    }
    if (!obj.id.startsWith(newBookmarkIdPrefix)) {
      const tar = copy(obj)
      delete tar.id
      editItem(obj.id, tar, settingMap.bookmarks)
      this.updateBookmarkGroups(
        bookmarkGroups,
        obj,
        categoryId
      )
      if (evt === 'saveAndCreateNew') {
        this.setNewItem()
      }
    } else {
      obj.id = generate()
      if (evt !== 'save' && evt !== 'saveAndCreateNew') {
        addItem(obj, settingMap.history)
      }
      addItem(obj, settingMap.bookmarks)
      this.updateBookmarkGroups(
        bookmarkGroups,
        obj,
        categoryId
      )
      this.setNewItem(evt === 'saveAndCreateNew'
        ? getInitItem([], settingMap.bookmarks)
        : obj
      )
    }
  }

  setNewItem = (
    settingItem = getInitItem([],
      settingMap.bookmarks)
  ) => {
    this.props.store.storeAssign({
      autofocustrigger: +new Date(),
      settingItem
    })
  }

  test = async (options) => {
    let msg = ''
    this.setState({
      testing: true
    })
    const res = await testConnection(options)
      .then(r => r)
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
    if (evt !== 'save' && evt !== 'saveAndCreateNew') {
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
            max: 128, message: '128 chars max'
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
            max: 128, message: '128 chars max'
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
    const { proxyIp, proxyPort, proxyType = '5', proxyUsername, proxyPassword } = proxy
    return [
      this.renderProxySelect(),
      <FormItem
        {...formItemLayout}
        label={e('proxyIp')}
        key='proxyIp'
      >
        {getFieldDecorator('proxy.proxyIp', {
          rules: [{
            max: 530, message: '530 chars max'
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
      </FormItem>,
      <FormItem
        {...formItemLayout}
        label='Auth'
        key='proxyAuth'
      >
        <Row>
          <Col span={12}>
            <FormItem>
              {getFieldDecorator('proxy.proxyUsername', {
                rules: [{
                  max: 128, message: '128 chars max'
                }],
                initialValue: proxyUsername
              })(
                <Input
                  placeholder={e('username')}
                />
              )}
            </FormItem>
          </Col>
          <Col span={12}>
            <FormItem>
              {getFieldDecorator('proxy.proxyPassword', {
                rules: [{
                  max: 128, message: '128 chars max'
                }],
                initialValue: proxyPassword
              })(
                <Input
                  placeholder={e('password')}
                />
              )}
            </FormItem>
          </Col>
        </Row>
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
      loginScriptDelay = defaultLoginScriptDelay,
      authType = authTypeMap.password,
      username,
      id = '',
      encode = encodes[0],
      startDirectory,
      startDirectoryLocal
    } = this.props.formData
    const {
      autofocustrigger,
      bookmarkGroups = [],
      currentBookmarkGroupId
    } = this.props
    const { dns } = this.state
    const initBookmarkGroupId = !id.startsWith(newBookmarkIdPrefix)
      ? findBookmarkGroupId(bookmarkGroups, id)
      : currentBookmarkGroupId
    const tree = formatBookmarkGroups(bookmarkGroups)
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
              max: 520, message: '520 chars max'
            }, {
              required: true, message: 'host required'
            }],
            normalize: this.trim,
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
              max: 128, message: '128 chars max'
            }, {
              required: true, message: 'username required'
            }],
            initialValue: username,
            normalize: this.trim
          })(
            <Input placeholder={defaultUserName} />
          )}
        </FormItem>
        <FormItem {...tailFormItemLayout} className='mg1b'>
          {getFieldDecorator('authType', {
            initialValue: authType
          })(
            <RadioGroup size='small' buttonStyle='solid'>
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
            <TreeSelect
              treeData={tree}
              treeDefaultExpandAll
              showSearch
            />
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
          label={`${e('startDirectory')}:${sf('local')}`}
        >
          {getFieldDecorator('startDirectoryLocal', {
            initialValue: startDirectoryLocal
          })(
            <Input />
          )}
        </FormItem>
        <FormItem
          {...formItemLayout}
          label={`${e('startDirectory')}:${sf('remote')}`}
        >
          {getFieldDecorator('startDirectory', {
            initialValue: startDirectory
          })(
            <Input />
          )}
        </FormItem>
        <FormItem
          {...formItemLayout}
          label={e('loginScript')}
          help={`* ${e('loginScriptTip')}`}
        >
          {getFieldDecorator('loginScript', {
            initialValue: loginScript
          })(
            <Input.TextArea row={1} />
          )}
        </FormItem>
        <FormItem
          {...formItemLayout}
          label={e('loginScriptDelay')}
        >
          {getFieldDecorator('loginScriptDelay', {
            initialValue: loginScriptDelay
          })(
            <InputNumber
              placeholder='loginScriptDelay'
              min={1}
              max={65535}
              step={1}
              formatter={value => `${value} ms`}
            />
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
      fontSize: defaultFontSize,
      terminalType: defaultTerminalType
    } = defaultSettings
    const {
      fontFamily,
      fontSize,
      term = defaultTerminalType,
      envLang
    } = this.props.formData
    const { terminalTypes } = this.props.store.config
    return [
      <FormItem
        {...formItemLayout}
        label='ENV:LANG'
        key='envLang'
      >
        {getFieldDecorator('envLang', {
          rules: [{
            max: 130, message: '130 chars max'
          }],
          initialValue: envLang
        })(
          <Input placeholder='en_US.UTF-8' />
        )}
      </FormItem>,
      <FormItem
        {...formItemLayout}
        key='terminalType'
        label={e('terminalType')}
      >
        {getFieldDecorator('term', {
          rules: [{
            required: true, message: 'terminal type required'
          }],
          normalize: this.trim,
          initialValue: term
        })(
          <AutoComplete
            dataSource={terminalTypes}
          />
        )}
      </FormItem>,
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

  renderEnableSftp = () => {
    const { enableSftp = true } = this.props.formData
    const { getFieldDecorator } = this.props.form
    return (
      <FormItem
        {...formItemLayout}
        label='Sftp'
      >
        {getFieldDecorator('enableSftp', {
          initialValue: enableSftp,
          valuePropName: 'checked'
        })(
          <Switch />
        )}
      </FormItem>
    )
  }

  renderQuickCommands = () => {
    const { quickCommands = [] } = this.props.formData
    const { form } = this.props
    const { getFieldDecorator } = form
    const qms = this.props.form.getFieldValue('quickCommands') || []
    return (
      <div>
        <div className='hide'>
          <FormItem
            {...formItemLayout}
            label='quick commands'
          >
            {getFieldDecorator('quickCommands', {
              initialValue: quickCommands
            })(
              <Input />
            )}
          </FormItem>
        </div>
        <QmList
          quickCommands={qms}
          form={form}
        />
      </div>
    )
  }

  renderTabs () {
    return (
      <Tabs type='card'>
        <TabPane tab={e('auth')} key='auth' forceRender>
          {this.renderCommon()}
        </TabPane>
        <TabPane tab={s('settings')} key='settings' forceRender>
          {this.renderEnableSftp()}
          {this.renderUI()}
          {this.renderProxy()}
          {this.renderX11()}
        </TabPane>
        <TabPane tab={e('quickCommands')} key='quickCommands' forceRender>
          {this.renderQuickCommands()}
        </TabPane>
      </Tabs>
    )
  }

  render () {
    return (
      <Form onSubmit={this.handleSubmit}>
        {this.renderTabs()}
        <FormItem {...tailFormItemLayout}>
          <p>
            <Button
              type='primary'
              htmlType='submit'
              className='mg1r'
            >{e('saveAndConnect')}</Button>
            {
              settingMap.history === this.props.type
                ? null
                : (
                  <Button
                    type='primary'
                    className='mg1r'
                    onClick={() => this.handleSubmit('saveAndCreateNew')}
                  >{e('saveAndCreateNew')}</Button>
                )
            }
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
