/**
 * tree list for bookmarks
 */

import React from 'react'

import {
  BookOutlined,
  CheckOutlined,
  CloseOutlined,
  CopyOutlined,
  EditOutlined,
  FolderAddOutlined,
  FolderOutlined
} from '@ant-design/icons'

import { Popconfirm, Tree, Button } from 'antd'
import createName from '../../common/create-title'
import classnames from 'classnames'
import { nanoid as generate } from 'nanoid/non-secure'
import InputAutoFocus from '../common/input-auto-focus'
import _ from 'lodash'
import {
  maxBookmarkGroupTitleLength,
  defaultBookmarkGroupId,
  settingMap
} from '../../common/constants'
import highlight from '../common/highlight'
import copy from 'json-deep-copy'
import onDrop from './on-tree-drop'
import Search from '../common/search'
import Btns from './bookmark-transport'
import findBookmarkGroupId from '../../common/find-bookmark-group-id'
import getInitItem from '../../common/init-setting-item'
import './tree-list.styl'

const { TreeNode } = Tree
const { prefix } = window
const e = prefix('menu')
const c = prefix('common')
const s = prefix('setting')

export default class ItemListTree extends React.PureComponent {
  constructor (props) {
    super(props)
    this.state = {
      keyword: '',
      expandedKeys: props.expandedKeys || [defaultBookmarkGroupId],
      showNewBookmarkGroupForm: false,
      bookmarkGroupTitle: '',
      categoryTitle: '',
      categoryId: '',
      bookmarkGroupTitleSub: '',
      bookmarkGroupSubParentId: ''
    }
  }

  onChange = e => {
    this.setState({
      keyword: e.target.value
    })
  }

  cancelNew = () => {
    this.setState({
      showNewBookmarkGroupForm: false,
      bookmarkGroupTitle: ''
    })
  }

  cancelNewSub = () => {
    this.setState({
      bookmarkGroupSubParentId: ''
    })
  }

  cancelEdit = () => {
    this.setState({
      categoryId: '',
      categoryTitle: ''
    })
  }

  onChangeEdit = e => {
    let { value } = e.target
    if (value.length > maxBookmarkGroupTitleLength) {
      value = value.slice(0, maxBookmarkGroupTitleLength)
    }
    this.setState({
      categoryTitle: value
    })
  }

  submitEdit = () => {
    const {
      categoryTitle,
      categoryId
    } = this.state
    if (!categoryTitle) {
      return
    }
    const bookmarkGroups = copy(
      this.props.bookmarkGroups
    )
    const obj = _.find(
      bookmarkGroups,
      bg => bg.id === categoryId
    )
    if (!obj) {
      return this.cancelEdit()
    }
    obj.title = categoryTitle
    this.setState({
      categoryId: ''
    })
    this.props.store.storeAssign({
      bookmarkGroups
    })
    this.props.store.batchDbUpdate([{
      id: categoryId,
      db: 'bookmarkGroups',
      upsert: false,
      update: {
        title: categoryTitle
      }
    }])
  }

  onDrop = (info) => {
    onDrop(info, this.props)
  }

  onSubmit = false

  onSubmitEdit = false

  onChangeBookmarkGroupTitle = e => {
    let { value } = e.target
    if (value.length > maxBookmarkGroupTitleLength) {
      value = value.slice(0, maxBookmarkGroupTitleLength)
    }
    this.setState({
      bookmarkGroupTitle: value
    })
  }

  onChangeBookmarkGroupTitleSub = e => {
    let { value } = e.target
    if (value.length > maxBookmarkGroupTitleLength) {
      value = value.slice(0, maxBookmarkGroupTitleLength)
    }
    this.setState({
      bookmarkGroupTitleSub: value
    })
  }

  newBookmark = () => {
    this.props.onClickItem(getInitItem([], settingMap.bookmarks))
  }

  submit = () => {
    if (this.onSubmit) {
      return
    }
    this.onSubmit = true
    this.setState({
      showNewBookmarkGroupForm: false
    }, () => {
      this.onSubmit = false
      this.props.store.addBookmarkGroup({
        id: generate(),
        title: this.state.bookmarkGroupTitle,
        bookmarkIds: []
      })
    })
  }

  submitSub = () => {
    if (this.onSubmit) {
      return
    }
    this.onSubmit = true
    const id = this.state.bookmarkGroupSubParentId
    this.setState({
      bookmarkGroupSubParentId: ''
    }, () => {
      this.onSubmit = false
      let bookmarkGroups = copy(
        this.props.bookmarkGroups
      )
      const newCat = {
        id: generate(),
        title: this.state.bookmarkGroupTitleSub,
        level: 2,
        bookmarkIds: []
      }
      bookmarkGroups = [
        newCat,
        ...bookmarkGroups
      ]
      const cat = _.find(
        bookmarkGroups,
        d => d.id === id
      )
      if (!cat) {
        return
      }
      cat.bookmarkGroupIds = [
        ...(cat.bookmarkGroupIds || []),
        newCat.id
      ]
      this.props.store.storeAssign({
        bookmarkGroups
      })
      this.props.store.batchDbAdd([{
        db: 'bookmarkGroups',
        obj: newCat
      }])
      this.props.store.batchDbUpdate([{
        upsert: false,
        id,
        update: {
          bookmarkGroupIds: cat.bookmarkGroupIds
        },
        db: 'bookmarkGroups'
      }])
    })
  }

  newBookmarkGroup = () => {
    this.setState({
      showNewBookmarkGroupForm: true,
      bookmarkGroupTitle: '',
      bookmarkGroupSubParentId: ''
    })
  }

  del = (item, e) => {
    e.stopPropagation()
    if (item.bookmarkIds) {
      return this.props.store.delBookmarkGroup(item)
    }
    this.props.store.onDelItem(item, this.props.type)
    this.props.store.delItem(item, this.props.type)
  }

  onExpand = (expandedKeys) => {
    this.setState({
      expandedKeys
    })
  }

  onSelect = (
    selectedKeys,
    {
      node
    }
  ) => {
    const [id] = selectedKeys
    if (!node.isLeaf) {
      this.props.store.storeAssign({
        currentBookmarkGroupId: id
      })
    } else {
      this.props.store.storeAssign({
        currentBookmarkGroupId: findBookmarkGroupId(this.props.store.bookmarkGroups, id)
      })
    }
    const bookmarks = copy(this.props.bookmarks)
    const bookmark = _.find(
      bookmarks,
      d => d.id === id
    )
    if (bookmark) {
      this.props.onClickItem(bookmark)
    }
  }

  renderSearch = () => {
    return (
      <div className='pd1y pd2r'>
        <Search
          onChange={this.onChange}
          value={this.state.keyword}
        />
      </div>
    )
  }

  renderDelBtn = item => {
    if (item.id === defaultBookmarkGroupId || this.props.staticList) {
      return null
    }
    return (
      <Popconfirm
        title={e('del') + '?'}
        onConfirm={e => this.del(item, e)}
        okText={e('del')}
        cancelText={c('cancel')}
        placement='top'
      >
        <CloseOutlined title={e('del')} className='pointer tree-control-btn' />
      </Popconfirm>
    )
  }

  editItem = (e, item, isGroup) => {
    e.stopPropagation()
    if (isGroup) {
      this.setState({
        categoryTitle: '' + item.title,
        categoryId: item.id + '',
        bookmarkGroupSubParentId: ''
      })
    } else {
      this.props.store.openBookmarkEdit(item)
    }
  }

  addSubCat = (e, item) => {
    this.setState(old => {
      return {
        showNewBookmarkGroupForm: false,
        bookmarkGroupTitleSub: '',
        bookmarkGroupSubParentId: item.id,
        expandedKeys: _.uniq([
          ...old.expandedKeys,
          item.id
        ])
      }
    })
  }

  renderAddNewSubGroupBtn = item => {
    if (this.props.staticList || item.level === 2) {
      return null
    }
    return (
      <FolderAddOutlined
        key='new-tree'
        title={`${s('new')} ${c('bookmarkCategory')}`}
        onClick={(e) => this.addSubCat(e, item)}
        className='pointer tree-control-btn' />
    )
  }

  renderEditBtn = (item, isGroup) => {
    if (
      (this.props.staticList && isGroup) ||
      (!this.props.staticList && !isGroup)
    ) {
      return null
    }
    return (
      <EditOutlined
        title={e('edit')}
        key='edit-tree'
        onClick={(e) => this.editItem(e, item, isGroup)}
        className='pointer tree-control-btn' />
    )
  }

  editCategory = () => {
    const {
      categoryTitle
    } = this.state
    const confirm = (
      <span>
        <CheckOutlined className='pointer' onClick={this.submitEdit} />
        <CloseOutlined className='mg1l pointer' onClick={this.cancelEdit} />
      </span>
    )
    return (
      <InputAutoFocus
        value={categoryTitle}
        onChange={this.onChangeEdit}
        onPressEnter={this.submitEdit}
        addonAfter={confirm}
      />
    )
  }

  duplicateItem = (e, item) => {
    e.stopPropagation()
    const { addItem } = this.props.store
    const bookmarkGroups = copy(
      this.props.bookmarkGroups
    )

    const newbookmark = copy(item)
    newbookmark.id = generate()
    const bookmarkWithSameTitle = this.findBookmarkByTitle(this.props.bookmarks, item)
    let deplicateIndex
    if (bookmarkWithSameTitle.length === 1) {
      deplicateIndex = 1
    } else {
      deplicateIndex = bookmarkWithSameTitle.length
    }
    newbookmark.title = item.title + '(' + deplicateIndex + ')'
    const categoryId = findBookmarkGroupId(bookmarkGroups, item.id)
    this.props.store.storeAssign({
      currentBookmarkGroupId: categoryId
    })
    // add bookmark to store
    addItem(newbookmark, settingMap.bookmarks)
    // update bookmark groups
    this.updateBookmarkGroups(
      bookmarkGroups,
      newbookmark,
      categoryId
    )
    this.props.onClickItem(newbookmark)
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
    const updates = []
    const bid = bookmark.id
    const bg = bookmarkGroups[index]
    const old = copy(bg.bookmarkIds)
    if (!bg.bookmarkIds.includes(bid)) {
      bg.bookmarkIds.unshift(bid)
    }
    bg.bookmarkIds = _.uniq(bg.bookmarkIds)
    if (!_.isEqual(old, copy(bg.bookmarkIds))) {
      updates.push({
        id: bg.id,
        db: 'bookmarkGroups',
        upsert: false,
        update: {
          bookmarkIds: bg.bookmarkIds
        }
      })
    }
    bookmarkGroups = bookmarkGroups.map((bg, i) => {
      if (i === index) {
        return bg
      }
      const old = copy(bg.bookmarkIds)
      bg.bookmarkIds = bg.bookmarkIds.filter(
        g => g !== bid
      )
      if (!_.isEqual(old, copy(bg.bookmarkIds))) {
        updates.push({
          id: bg.id,
          db: 'bookmarkGroups',
          upsert: false,
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
  }

  findBookmarkByTitle = (bookmarks, oldBookmark) => {
    return _.filter(bookmarks, bookmark => {
      return bookmark.title.includes(oldBookmark.title) && bookmark.host === oldBookmark.host && bookmark.port === oldBookmark.port
    })
  }

  renderDuplicateBtn = (item, isGroup) => {
    if (!item.id || this.props.staticList) {
      return null
    }
    const icon = (
      <CopyOutlined
        title={e('duplicate')}
        className='pointer tree-control-btn'
        onClick={(e) => this.duplicateItem(e, item)} />
    )
    return icon
  }

  renderItemTitle = (item, isGroup) => {
    if (isGroup && item.id === this.state.categoryId) {
      return this.editCategory(item)
    }
    const cls = classnames(
      'tree-item elli',
      {
        'is-category': isGroup,
        level2: item.level === 2
      }
    )
    let title = isGroup
      ? item.title
      : createName(item)
    title = isGroup
      ? item.title || 'no title'
      : highlight(
        title,
        this.state.keyword
      )
    return (
      <div className={cls} key={item.id || 'noid'} title={title}>
        <div
          className='tree-item-title elli'
        >
          {title}
        </div>
        {
          isGroup
            ? this.renderGroupBtns(item)
            : null
        }
        {
          !isGroup
            ? this.renderDuplicateBtn(item)
            : null
        }
        {this.renderDelBtn(item)}
        {this.renderEditBtn(item, isGroup)}
      </div>
    )
  }

  renderGroupBtns = (item) => {
    return [
      this.renderAddNewSubGroupBtn(item),
      this.renderEditBtn(item)
    ]
  }

  renderChildNodes = bookmarkIds => {
    const bookmarks = this.filter(
      this.props.bookmarks
    )
    const map = bookmarks.reduce((p, b) => {
      return {
        ...p,
        [b.id]: b
      }
    }, {})
    const nodes = bookmarkIds.reduce((prev, id) => {
      return map[id]
        ? [
          ...prev,
          map[id]
        ]
        : prev
    }, [])
    return nodes.map((node, i) => {
      return (
        <TreeNode
          key={node.id}
          isLeaf
          title={this.renderItemTitle(node)}
        />
      )
    })
  }

  renderGroupChildNodes = bookmarkGroupIds => {
    const bookmarkGroups = bookmarkGroupIds.map(id => {
      return _.find(this.props.bookmarkGroups, d => d.id === id)
    }).filter(d => d)
    return bookmarkGroups.map((node, i) => {
      const { bookmarkIds = [], id } = node
      return (
        <TreeNode
          key={id}
          title={this.renderItemTitle(node, true)}
        >
          {
            bookmarkIds.length
              ? this.renderChildNodes(bookmarkIds)
              : null
          }
        </TreeNode>
      )
    })
  }

  renderItem = (item, i) => {
    const {
      bookmarkIds = [],
      bookmarkGroupIds = []
    } = item
    return (
      <TreeNode
        key={item.id}
        title={this.renderItemTitle(item, true)}
      >
        {this.renderNewSubBookmarkGroup(item)}
        {
          bookmarkGroupIds.length
            ? this.renderGroupChildNodes(bookmarkGroupIds)
            : null
        }
        {
          bookmarkIds.length
            ? this.renderChildNodes(bookmarkIds)
            : null
        }
      </TreeNode>
    )
  }

  filter = list => {
    const { keyword } = this.state
    return keyword
      ? list.filter(item => {
        return createName(item).toLowerCase().includes(keyword.toLowerCase())
      })
      : list
  }

  renderNewButtons = () => {
    return (
      <div className='pd1b pd2r'>
        <Button
          className='mg1r mg1t'
          onClick={this.newBookmark}
          title={`${s('new')} ${c('bookmarks')}`}
        >
          <BookOutlined className='with-plus' />
        </Button>
        <Button
          className='mg1t'
          onClick={this.newBookmarkGroup}
          title={`${s('new')} ${c('bookmarkCategory')}`}
        >
          <FolderOutlined className='with-plus' />
        </Button>
        <Btns
          store={this.props.store}
        />
      </div>
    )
  }

  renderNewSubBookmarkGroup = item => {
    const {
      bookmarkGroupTitleSub,
      bookmarkGroupSubParentId
    } = this.state
    if (!bookmarkGroupSubParentId || item.id !== bookmarkGroupSubParentId) {
      return null
    }
    const confirm = (
      <span>
        <CheckOutlined className='pointer' onClick={this.submitSub} />
        <CloseOutlined className='mg1l pointer' onClick={this.cancelNewSub} />
      </span>
    )
    return (
      <TreeNode
        key={bookmarkGroupSubParentId}
        isLeaf
        title={(
          <InputAutoFocus
            value={bookmarkGroupTitleSub}
            onPressEnter={this.submitSub}
            onChange={this.onChangeBookmarkGroupTitleSub}
            addonAfter={confirm}
          />
        )}
      />
    )
  }

  renderNewBookmarkGroup = () => {
    const {
      bookmarkGroupTitle,
      showNewBookmarkGroupForm
    } = this.state
    if (!showNewBookmarkGroupForm) {
      return null
    }
    const confirm = (
      <span>
        <CheckOutlined className='pointer' onClick={this.submit} />
        <CloseOutlined className='mg1l pointer' onClick={this.cancelNew} />
      </span>
    )
    return (
      <div className='pd1y'>
        <InputAutoFocus
          value={bookmarkGroupTitle}
          onPressEnter={this.submit}
          onChange={this.onChangeBookmarkGroupTitle}
          addonAfter={confirm}
        />
      </div>
    )
  }

  render () {
    const {
      bookmarkGroups,
      type,
      activeItemId,
      staticList,
      listStyle = {}
    } = this.props
    const { keyword } = this.state
    const expandedKeys = this.props.expandedKeys || this.state.expandedKeys
    const level1Bookgroups = bookmarkGroups.filter(
      d => !d.level || d.level < 2
    )
    return (
      <div className={`tree-list item-type-${type}`}>
        {
          staticList
            ? null
            : this.renderNewButtons()
        }
        {
          this.renderSearch()
        }
        <div className='item-list-wrap pd2r' style={listStyle}>
          {this.renderNewBookmarkGroup()}
          <Tree
            onExpand={this.props.onExpand || this.onExpand}
            expandedKeys={expandedKeys}
            autoExpandAll={!!keyword || !!staticList}
            onSelect={this.onSelect}
            draggable={!staticList}
            selectedKeys={[activeItemId]}
            onDrop={this.onDrop}
          >
            {level1Bookgroups.map(this.renderItem)}
          </Tree>
        </div>
      </div>
    )
  }
}
