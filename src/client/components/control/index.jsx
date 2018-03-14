
import React from 'react'
import Tabs from './tabs'
import Btns from './btns'
import SettingModal from './setting-modal'
import {generate} from 'shortid'
import _ from 'lodash'
import copy from 'json-deep-copy'
import {statusMap, settingMap} from '../../common/constants'
import './control.styl'

const {prefix} = window
const e = prefix('control')

const defaultStatus = statusMap.processing
export const newTerm = () => ({
  id: generate(),
  status: defaultStatus,
  title: e('newTerminal')
})

export default class IndexControl extends React.Component {

  state = {
    item: {
      id: ''
    },
    tab: settingMap.bookmarks
  }

  componentDidMount() {
    window._require('electron')
      .ipcRenderer
      .on('new-ssh', this.onNewSsh)
  }

  onDup = tab => {
    delete tab.status
    this.props.addTab({
      ...tab,
      status: defaultStatus,
      id: generate()
    })
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
      item: {
        id: ''
      }
    }, this.openModal)
  }

  onSelectHistory = id => {
    let item = _.find(this.props.history, it => it.id === id)
    this.props.addTab({
      ...item,
      status: defaultStatus,
      id: generate()
    })
  }

  onSelectBookmark = id => {
    let {history, bookmarks} = this.props
    let item = _.find(bookmarks, it => it.id === id)
    this.props.addTab({
      ...item,
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
      item: {
        id: ''
      }
    }, this.openModal)
  }

  openModal = () => {
    this.modal.show()
  }

  render() {
    let {item, tab} = this.state
    let props = {
      ...this.props,
      item,
      tab,
      ..._.pick(this, [
        'onAdd', 'onChange', 'onClose',
        'onDup', 'onNewSsh', 'openSetting',
        'onEditBookmark', 'onSelectHistory', 'onSelectBookmark'
      ]),
      onEditBookmark: this.onNewSsh
    }
    return (
      <div>
        <SettingModal
          {...this.props}
          {...props}
          ref={ref => this.modal = ref}
        />
        <Btns
          {...this.props}
          {...props}
        />
        <Tabs
          {...props}
        />
      </div>
    )
  }

}
