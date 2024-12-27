/**
 * bookmark form
 */
import { PureComponent } from 'react'
import {
  message
} from 'antd'
import { uniq, isEqual, pick } from 'lodash-es'
import copy from 'json-deep-copy'
import generate from '../../common/uid'
import {
  settingMap,
  defaultBookmarkGroupId,
  newBookmarkIdPrefix
} from '../../common/constants'
import { isValidIP } from '../../common/is-ip'
import runIdle from '../../common/run-idle'
import getInitItem from '../../common/init-setting-item'
import testCon from '../../common/test-connection'
import FormUi from './ssh-form-ui'
import findBookmarkGroupId from '../../common/find-bookmark-group-id'
import newTerm from '../../common/new-terminal'

export default class BookmarkForm extends PureComponent {
  state = {
    testing: false,
    ips: []
  }

  trim = (v) => {
    return (v || '').replace(/^\s+|\s+$/g, '')
  }

  useIp = (form, ip) => {
    form.setFieldsValue({
      host: ip
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
    const value = e.target.value.trim()
    const { type } = this.props
    if (
      type !== settingMap.bookmarks ||
      !value ||
      isValidIP(value)
    ) {
      return
    }
    const ips = await window.pre.runGlobalAsync('lookup', value)
      .catch(err => {
        log.debug(err)
      })
    this.setState({
      ips: ips || []
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
    let index = bookmarkGroups.findIndex(
      bg => bg.id === categoryId
    )
    if (index < 0) {
      index = bookmarkGroups.findIndex(
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
    bg.bookmarkIds = uniq(bg.bookmarkIds)
    if (!isEqual(bg.bookmarkIds, old)) {
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
      if (!isEqual(bg.bookmarkIds, olde)) {
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
    runIdle(() => {
      this.props.store.setBookmarkGroups(
        bookmarkGroups
      )
    })
    runIdle(() => {
      this.props.store.batchDbUpdate(updates)
    })
    message.success('OK', 3)
  }

  submit = (evt, item, type = this.props.type) => {
    if (item.host) {
      item.host = item.host.trim()
    }
    const obj = item
    if (obj.connectionHoppings?.length) {
      obj.hasHopping = true
    }
    const { addItem, editItem } = this.props.store
    const categoryId = obj.category
    delete obj.category
    const bookmarkGroups = copy(
      this.props.bookmarkGroups
    )
    if (!obj.id.startsWith(newBookmarkIdPrefix)) {
      const tar = copy(obj)
      delete tar.id
      runIdle(() => {
        editItem(obj.id, tar, settingMap.bookmarks)
      })
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
      runIdle(() => {
        addItem(obj, settingMap.bookmarks)
      })
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
    settingItem = getInitItem([], settingMap.bookmarks)
  ) => {
    const { store } = this.props
    this.props.store.storeAssign({
      autofocustrigger: Date.now()
    })
    store.setSettingItem(settingItem)
  }

  test = async (update) => {
    let options = {
      ...this.props.formData,
      ...update
    }
    let msg = ''
    this.setState({
      testing: true
    })
    options = window.store.applyProfileToTabs(options)
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

  connect = (res) => {
    this.handleSubmit('connect', res, false)
  }

  handleSubmit = async (evt, res, isTest = false) => {
    const obj = {
      ...this.props.formData,
      ...res
    }
    if (isTest) {
      return this.test(obj)
    }
    if (evt && evt !== 'connect') {
      this.submit(evt, obj)
    }
    if (evt !== 'save' && evt !== 'saveAndCreateNew') {
      window.store.currentLayoutBatch = window.openTabBatch || 0
      this.props.store.addTab({
        ...copy(obj),
        ...newTerm(true, true),
        batch: window.openTabBatch ?? window.store.currentLayoutBatch
      })
      delete window.openTabBatch
      this.props.hide()
    }
  }

  getProps = () => {
    const funcs = pick(this, [
      'handleFinish',
      'testConnection',
      'connect',
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
