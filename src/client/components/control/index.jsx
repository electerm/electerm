
import React from 'react'
import Tabs from './tabs'
import Btns from './btns'
import Modal from './modal'
import {generate} from 'shortid'
import _ from 'lodash'
import './control.styl'

const newTerm = () => ({
  id: generate(),
  title: 'new terminal'
})

export default class IndexControl extends React.Component {

  state = {
    item: {
      id: ''
    },
    tab: 'bookmarks'
  }

  onDup = tab => {
    this.props.addTab({
      ...tab,
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
      tab: 'bookmarks',
      item: {
        id: ''
      }
    }, this.openModal)
  }

  onSelectHistory = id => {
    let item = _.find(this.props.history, it => it.id === id)
    this.props.addTab({
      ...item,
      id: generate()
    })
  }

  onSelectBookmark = id => {
    let item = _.find(this.props.bookmarks, it => it.id === id)
    this.props.addTab({
      ...item,
      id: generate()
    })
  }

  openSetting = () => {
    this.setState({
      tab: 'setting',
      item: {
        id: ''
      }
    }, this.openModal)
  }

  openModal = () => {
    this.modal.show()
  }

  render() {
    let {
      tabs,
      currentTabId
    } = this.props
    let {item, tab} = this.state
    let props = {
      tabs,
      item,
      tab,
      currentTabId,
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
