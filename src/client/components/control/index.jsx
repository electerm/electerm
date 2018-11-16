
import React from 'react'
import Tabs from '../tabs'
import Btns from './btns'
import {buildNewTheme} from '../../common/terminal-theme'
import {generate} from 'shortid'
import _ from 'lodash'
import copy from 'json-deep-copy'
import {statusMap, settingMap} from '../../common/constants'
import './control.styl'
import newTerm from '../../common/new-terminal'
import SettingModal from '../setting-panel/setting-modal'
import TransferHistoryModal from './transfer-history-modal'

const {prefix, getGlobal} = window
const e = prefix('control')
const sshConfigItems = copy(getGlobal('sshConfigItems'))
const defaultStatus = statusMap.processing
const getInitItem = (arr, tab) => {
  if (tab === settingMap.history) {
    return arr[0] || {}
  } else if (tab === settingMap.bookmarks) {
    return {id: '', title: ''}
  } else if (tab === settingMap.setting) {
    return {id: '', title: e('common')}
  } else if (tab === settingMap.terminalThemes) {
    return buildNewTheme()
  }
}

export default class IndexControl extends React.Component {

  state = {
    item: getInitItem([], settingMap.bookmarks),
    tab: settingMap.bookmarks,
    autofocustrigger: + new Date(),
    bookmarkId: undefined,
    showModal: false
  }

  componentDidMount() {
    window._require('electron')
      .ipcRenderer
      .on('new-ssh', this.onNewSsh)
      .on('openSettings', this.openSetting)
  }

  modifier = (...args) => {
    this.setState(...args)
  }

  onDelItem = (item, type) => {
    if (item.id === this.state.item.id) {
      this.setState((old, props) => {
        old.item = getInitItem(
          props[type],
          type
        )
        return old
      })
    }
  }

  onDup = tab => {
    let index = _.findIndex(
      this.props.tabs,
      d => d.id === tab.id
    )
    this.props.addTab({
      ...tab,
      status: defaultStatus,
      id: generate()
    }, index + 1)
  }

  onAdd = () => {
    this.props.addTab(newTerm())
  }

  onChange = currentTabId => {
    this.props.modifier({currentTabId})
  }

  onClose = id => {
    this.props.delTab({id})
  }

  onNewSsh = () => {
    this.setState({
      tab: settingMap.bookmarks,
      item: getInitItem([], settingMap.bookmarks),
      autofocustrigger: + new Date()
    }, this.openModal)
  }

  onSelectHistory = id => {
    let item = _.find(this.props.history, it => it.id === id)
    this.props.addTab({
      ...item,
      from: 'history',
      srcId: item.id,
      status: defaultStatus,
      id: generate()
    })
  }

  onSelectBookmark = id => {
    let {history, bookmarks} = this.props
    let item = copy(
      _.find(bookmarks, it => it.id === id) ||
      _.find(sshConfigItems, it => it.id === id)
    )
    if (!item) {
      return
    }
    this.props.addTab({
      ...item,
      from: 'bookmarks',
      srcId: item.id,
      status: defaultStatus,
      id: generate()
    })
    item.id = generate()

    let existItem = _.find(history, j => {
      let keysj = Object.keys(j)
      let keysi = Object.keys(item)
      return _.isEqual(
        _.pick(item, _.without(keysi, 'id')),
        _.pick(j, _.without(keysj, 'id'))
      )
    })
    if (!existItem) {
      this.props.addItem(item, settingMap.history)
    } else {
      let historyNew = copy(history)
      let index = _.findIndex(historyNew, f => f.id === existItem.id)
      historyNew.splice(index, 1)
      historyNew.unshift(existItem)
      this.props.modifier({history: historyNew})
    }
  }

  openSetting = () => {
    this.setState({
      tab: settingMap.setting,
      item: getInitItem([], settingMap.setting)
    }, this.openModal)
  }

  openTerminalThemes = () => {
    this.setState({
      tab: settingMap.terminalThemes,
      item: buildNewTheme()
    }, this.openModal)
  }

  openModal = () => {
    this.setState({
      showModal: true
    })
  }

  hideModal = () => {
    this.setState({
      showModal: false
    })
  }

  getItems = (tab, props = this.props) => {
    return tab === settingMap.terminalThemes
      ? copy(props.themes)
      : copy(props[tab]) || []
  }

  onChangeTab = tab => {
    let arr = this.getItems(tab)
    let item = getInitItem(arr, tab)
    this.setState({
      item,
      autofocustrigger: + new Date(),
      tab
    })
  }

  render() {
    let {
      item,
      tab,
      autofocustrigger,
      showModal,
      bookmarkId
    } = this.state
    let arr = this.getItems(tab)
    let initItem = getInitItem(arr, tab)
    let list = tab === settingMap.history
      ? arr
      : [
        copy(initItem),
        ...arr
      ]
    let props = {
      ...this.props,
      item,
      autofocustrigger,
      list,
      tab,
      ..._.pick(this, [
        'onAdd', 'onChange', 'onClose',
        'hideModal', 'onDelItem',
        'onDup', 'onNewSsh', 'openSetting',
        'onChangeTab', 'openTerminalThemes',
        'onEditBookmark', 'onSelectHistory', 'onSelectBookmark', 'onChangeTab'
      ]),
      showModal,
      bookmarkId,
      onEditBookmark: this.onNewSsh,
      modifier2: this.modifier
    }
    let {transferHistory} = this.props
    return (
      <div>
        {
          showModal
            ? (
              <SettingModal
                {...this.props}
                {...props}
              />
            )
            : null
        }
        {
          transferHistory.length
            ? (
              <TransferHistoryModal
                {...this.props}
              />
            )
            : null
        }
        <Btns
          {...props}
        />
        <Tabs
          {...props}
        />
      </div>
    )
  }

}
