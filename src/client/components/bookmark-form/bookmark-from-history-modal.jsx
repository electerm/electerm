/**
 * Bookmark from history modal - used to create bookmark from history item
 */

import React from 'react'
import { Button, message } from 'antd'
import { PlusOutlined } from '@ant-design/icons'
import Modal from '../common/modal'
import { refsStatic } from '../common/ref'
import AICategorySelect from './common/ai-category-select.jsx'
import generate from '../../common/uid'
import copy from 'json-deep-copy'

const e = window.translate

export default class BookmarkFromHistoryModal extends React.PureComponent {
  state = {
    visible: false,
    tab: null,
    selectedCategory: 'default'
  }

  componentDidMount () {
    refsStatic.add('bookmark-from-history-modal', this)
  }

  show (tab) {
    this.setState({
      visible: true,
      tab: copy(tab),
      selectedCategory: 'default'
    })
  }

  handleClose = () => {
    this.setState({
      visible: false,
      tab: null,
      selectedCategory: 'default'
    })
  }

  buildBookmark = () => {
    const { tab } = this.state
    if (!tab) return null

    const r = {
      ...tab,
      id: generate()
    }
    console.log(r)
    delete r.parentId
    delete r.category
    return r
  }

  handleConfirm = () => {
    const { tab, selectedCategory } = this.state
    if (!tab) {
      return
    }

    const { store } = window
    const { addItem } = store

    // Create bookmark from tab data
    const bookmark = this.buildBookmark()

    // Add bookmark
    addItem(bookmark, 'bookmarks')

    // Ensure the bookmark id is registered in its group
    try {
      const groupId = selectedCategory || 'default'
      const group = window.store.bookmarkGroups.find(g => g.id === groupId)
      if (group) {
        group.bookmarkIds = [
          ...new Set([...(group.bookmarkIds || []), bookmark.id])
        ]
        bookmark.color = group.color
      }
    } catch (err) {
      console.error('Failed to update bookmark group:', err)
    }

    message.success(e('Done'))
    this.handleClose()
  }

  render () {
    const { visible, selectedCategory } = this.state

    if (!visible) {
      return null
    }

    const bookmark = this.buildBookmark()
    const bookmarkJson = JSON.stringify(bookmark, null, 2)

    const modalProps = {
      open: visible,
      title: (
        <span>
          <PlusOutlined className='mg1r' />
          {e('bookmarks')}
        </span>
      ),
      width: 600,
      onCancel: this.handleClose,
      footer: (
        <div className='custom-modal-footer-buttons'>
          <Button onClick={this.handleClose}>
            {e('cancel')}
          </Button>
          <Button type='primary' onClick={this.handleConfirm}>
            {e('confirm')}
          </Button>
        </div>
      )
    }

    return (
      <Modal {...modalProps}>
        <div className='bookmark-from-history-modal pd2'>
          <div className='pd1b'>
            <AICategorySelect
              bookmarkGroups={window.store.bookmarkGroups}
              value={selectedCategory}
              onChange={(val) => this.setState({ selectedCategory: val })}
            />
          </div>
          <div className='pd1b'>
            <pre className='bookmark-json-preview'>
              {bookmarkJson}
            </pre>
          </div>
        </div>
      </Modal>
    )
  }
}
