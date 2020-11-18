/**
 * bookmark form
 */
import { PureComponent } from 'react'
import {
  message
} from 'antd'
import _ from 'lodash'
import copy from 'json-deep-copy'
import { nanoid as generate } from 'nanoid/non-secure'
import {
  settingMap,
  statusMap,
  defaultBookmarkGroupId,
  newBookmarkIdPrefix
} from '../../common/constants'
import isIp from '../../common/is-ip'
import getInitItem from '../../common/init-setting-item'
import testCon from '../../common/test-connection'
import FormUi from './ssh-form-ui'
import findBookmarkGroupId from '../../common/find-bookmark-group-id'

const { prefix } = window
const e = prefix('form')

export default class BookmarkForm extends PureComponent {
  state = {
    testing: false,
    dns: ''
  }

  trim = (v) => {
    return (v || '').replace(/^\s+|\s+$/g, '')
  }

  useIp = (form) => {
    form.setFieldsValue({
      host: this.state.dns
    })
    this.setState({
      dns: ''
    })
  }

  onPaste = (e, form) => {
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
      form.setFieldsValue(obj)
    }, 20)
  }

  onBlur = async (e) => {
    const { value } = e.target
    const { type } = this.props
    if (
      type !== settingMap.bookmarks ||
      !value || /\s/.test(value) ||
      isIp(value)
    ) {
      return
    }
    const ip = await window.pre.lookup(value)
      .catch(err => {
        log.debug(err)
      })
    this.setState({
      dns: ip || ''
    })
  }

  getBookmarkGroupId = () => {
    const {
      id
    } = this.props.formData
    const {
      bookmarkGroups,
      currentBookmarkGroupId
    } = this.props
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

  test = async (update) => {
    const options = {
      ...this.props.formData,
      ...update
    }
    let msg = ''
    this.setState({
      testing: true
    })
    const res = await testCon(options)
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

  // reset (form) {
  //   form.resetFields()
  // }

  onSelectProxy = (proxy, form) => {
    const obj = Object.keys(proxy)
      .reduce((prev, c) => {
        return {
          ...prev,
          [`proxy.${c}`]: proxy[c]
        }
      }, {})
    form.setFieldsValue(obj)
  }

  handleFinish = (res) => {
    this.handleSubmit('submit', res, false)
  }

  saveAndCreateNew = (res) => {
    this.handleSubmit('saveAndCreateNew', res, false)
  }

  save = (res) => {
    this.handleSubmit('save', res, false)
  }

  testConnection = (res) => {
    this.handleSubmit('test', res, true)
  }

  handleSubmit = async (evt, res, isTest = false) => {
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

  beforeUpload = (file, form) => {
    const privateKey = window.pre
      .readFileSync(file.path).toString()
    form.setFieldsValue({
      privateKey
    })
    return false
  }

  getProps = () => {
    const funcs = _.pick(this, [
      'beforeUpload',
      'handleFinish',
      'testConnection',
      'save',
      'saveAndCreateNew',
      'onSelectProxy',
      'onBlur',
      'onPaste',
      'useIp',
      'trim'
    ])
    return {
      ...this.state,
      ...funcs
    }
  }

  render () {
    return (
      <FormUi
        {...this.props}
        {...this.getProps()}
      />
    )
  }
}
