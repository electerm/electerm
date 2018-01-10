
import React from 'react'
import Tabs from './tabs'
import Btns from './btns'
import Modal from './modal'
import {generate} from 'shortid'
import _ from 'lodash'
import {statusMap, settingMap} from '../../common/constants'
import './control.styl'

const defaultStatus = statusMap.processing
const newTerm = () => ({
  id: generate(),
  status: defaultStatus,
  title: 'new terminal'
})

export default class IndexControl extends React.Component {

  state = {
    item: {
      id: ''
    },
    tab: settingMap.bookmarks
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
    let item = _.find(this.props.bookmarks, it => it.id === id)
    this.props.addTab({
      ...item,
      status: defaultStatus,
      id: generate()
    })
    item.id = generate()
    if (!_.some(this.props.history, j => {
      let keysj = Object.keys(j)
      let keysi = Object.keys(item)
      return _.isEqual(
        _.pick(item, _.without(keysi, 'id')),
        _.pick(j, _.without(keysj, 'id'))
      )
    })) {
      this.props.addItem(item, settingMap.history)
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
        <Modal
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
