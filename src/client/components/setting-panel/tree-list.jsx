/**
 * tree list for bookmarks
 */

import React from 'react'
import {
  Icon,
  Popconfirm,
  Tree,
  Button
} from 'antd'
import createName from '../../common/create-title'
import classnames from 'classnames'
import { generate } from 'shortid'
import InputAutoFocus from '../common/input-auto-focus'
import _ from 'lodash'
import {
  maxBookmarkGroupTitleLength,
  defaultookmarkGroupId
} from '../../common/constants'
import highlight from '../common/highlight'
import copy from 'json-deep-copy'
import onDrop from './on-tree-drop'
import Search from '../common/search'
import Btns from './bookmark-transport'
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
      expandedKeys: props.expandedKeys || [defaultookmarkGroupId],
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
    this.props.store.modifier({
      bookmarkGroups
    })
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
    this.props.onClickItem({
      id: '',
      title: ''
    })
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
      this.props.store.modifier({
        bookmarkGroups
      })
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
    if (!node.props.isLeaf) {
      this.props.store.modifier({
        currentBookmarkGroupId: id
      })
    }
    const { bookmarks } = this.props
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
    if (item.id === defaultookmarkGroupId || this.props.staticList) {
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
        <Icon
          type='close'
          title={e('del')}
          className='pointer list-item-del'
        />
      </Popconfirm>
    )
  }

  editItem = (e, item) => {
    e.stopPropagation()
    this.setState({
      categoryTitle: '' + item.title,
      categoryId: item.id + '',
      bookmarkGroupSubParentId: ''
    })
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
      <Icon
        type='folder-add'
        title={`${s('new')} ${c('bookmarkCategory')}`}
        onClick={(e) => this.addSubCat(e, item)}
        className='pointer list-item-edit'
      />
    )
  }

  renderEditBtn = item => {
    if (this.props.staticList) {
      return null
    }
    return (
      <Icon
        type='edit'
        title={e('edit')}
        onClick={(e) => this.editItem(e, item)}
        className='pointer list-item-edit'
      />
    )
  }

  editCategory = () => {
    const {
      categoryTitle
    } = this.state
    const confirm = (
      <span>
        <Icon
          type='check'
          className='pointer'
          onClick={this.submitEdit}
        />
        <Icon
          type='close'
          className='mg1l pointer'
          onClick={this.cancelEdit}
        />
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
      ? item.title
      : highlight(
        title,
        this.state.keyword
      )
    return (
      <div className={cls} key={item.id} title={title}>
        <div className='tree-item-title elli'>
          {title}
        </div>
        {
          isGroup
            ? this.renderGroupBtns(item)
            : null
        }
        {this.renderDelBtn(item)}
      </div>
    )
  }

  renderGroupBtns = (item) => {
    return (
      <span>
        {this.renderAddNewSubGroupBtn(item)}
        {this.renderEditBtn(item)}
      </span>
    )
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
    return nodes.map(node => {
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
    return bookmarkGroups.map(node => {
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

  renderItem = (item) => {
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
          <Icon type='book' className='with-plus' />
        </Button>
        <Button
          className='mg1t'
          onClick={this.newBookmarkGroup}
          title={`${s('new')} ${c('bookmarkCategory')}`}
        >
          <Icon type='folder' className='with-plus' />
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
        <Icon
          type='check'
          className='pointer'
          onClick={this.submitSub}
        />
        <Icon
          type='close'
          className='mg1l pointer'
          onClick={this.cancelNewSub}
        />
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
        <Icon
          type='check'
          className='pointer'
          onClick={this.submit}
        />
        <Icon
          type='close'
          className='mg1l pointer'
          onClick={this.cancelNew}
        />
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
