
import {Component} from '../common/react-subx'
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
import store from '../../store'

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

export default class IndexControl extends Component {

  state = {
    item: getInitItem([], settingMap.bookmarks),
    tab: settingMap.bookmarks,
    autoFocusTrigger: + new Date(),
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
    window.start = + new Date()
    console.log('start double click', window.start)
    let index = _.findIndex(
      this.props.store.tabs,
      d => d.id === tab.id
    )
    this.props.store.addTab({
      ...tab,
      status: defaultStatus,
      id: generate()
    }, index + 1)
  }

  onAdd = () => {
    this.props.store.addTab(newTerm())
  }

  onChange = currentTabId => {
    window.start1 = + new Date()
    console.log('start click', window.start1)
    this.props.store.modifier({currentTabId})
  }

  onClose = id => {
    this.props.store.delTab({id})
  }

  onNewSsh = () => {
    this.setState({
      tab: settingMap.bookmarks,
      item: getInitItem([], settingMap.bookmarks),
      autoFocusTrigger: + new Date()
    }, this.openModal)
  }

  onSelectHistory = id => {
    let item = _.find(this.props.store.history, it => it.id === id)
    this.props.store.addTab({
      ...item,
      from: 'history',
      srcId: item.id,
      status: defaultStatus,
      id: generate()
    })
  }

  onSelectBookmark = id => {
    let {history, bookmarks} = this.props.store
    let item = copy(
      _.find(bookmarks, it => it.id === id) ||
      _.find(sshConfigItems, it => it.id === id)
    )
    if (!item) {
      return
    }
    this.props.store.addTab({
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
      this.props.store.addItem(item, settingMap.history)
    } else {
      let index = _.findIndex(history, f => f.id === existItem.id)
      history.splice(index, 1)
      history.unshift(existItem)
      this.props.store.modifier({history: history})
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

  getItems = (tab, props = this.props.store) => {
    return tab === settingMap.terminalThemes
      ? copy(props.themes)
      : copy(props[tab]) || []
  }

  onChangeTab = tab => {
    let arr = this.getItems(tab)
    let item = getInitItem(arr, tab)
    this.setState({
      item,
      autoFocusTrigger: + new Date(),
      tab
    })
  }

  render() {
    let {
      item,
      tab,
      autoFocusTrigger,
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
      item,
      autoFocusTrigger,
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
    let {transferHistory} = this.props.store
    return (
      <div>
        {
          showModal
            ? (
              <SettingModal
                store={store}
                {...props}
              />
            )
            : null
        }
        {
          transferHistory.length
            ? (
              <TransferHistoryModal
                store={store}
              />
            )
            : null
        }
        <Btns
          store={store}
          {...props}
        />
        <Tabs
          store={store}
          {...props}
        />
      </div>
    )
  }

}
