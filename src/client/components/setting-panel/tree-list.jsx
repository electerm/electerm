/**
 * tree list for bookmarks
 */

import { Component } from 'react'
import {
  BookOutlined,
  CheckOutlined,
  CloseOutlined,
  CopyOutlined,
  EditOutlined,
  FolderAddOutlined,
  FolderOutlined,
  FolderOpenOutlined,
  SettingOutlined,
  LoadingOutlined
} from '@ant-design/icons'
import {
  readClipboard,
  cut,
  hasBookmarkOrGroupInClipboardText
} from '../../common/clipboard'
import {
  Popconfirm,
  Tree,
  Button,
  Tooltip,
  Space
} from 'antd'
import createName, { createTitleTag } from '../../common/create-title'
import classnames from 'classnames'
import InputAutoFocus from '../common/input-auto-focus'
import { find, uniq, findIndex, isEqual, filter } from 'lodash-es'
import {
  maxBookmarkGroupTitleLength,
  defaultBookmarkGroupId,
  settingMap,
  commonActions,
  copyBookmarkItemPrefix,
  copyBookmarkGroupItemPrefix
} from '../../common/constants'
import highlight from '../common/highlight'
import copy from 'json-deep-copy'
import onDrop from './on-tree-drop'
import Search from '../common/search'
import Btns from './bookmark-transport'
import findBookmarkGroupId from '../../common/find-bookmark-group-id'
import getInitItem from '../../common/init-setting-item'
import uid from '../../common/uid'
import deepEqual from 'fast-deep-equal'
import './tree-list.styl'

const { TreeNode } = Tree
const { prefix } = window
const e = prefix('menu')
const c = prefix('common')
const s = prefix('setting')

export default class ItemListTree extends Component {
  constructor (props) {
    super(props)
    this.state = {
      ready: false,
      keyword: '',
      showNewBookmarkGroupForm: false,
      bookmarkGroupTitle: '',
      categoryTitle: '',
      categoryId: '',
      bookmarkGroupTitleSub: '',
      bookmarkGroupSubParentId: '',
      expandedKeys: window.store.expandedKeys
    }
  }

  componentDidMount () {
    this.timer = setTimeout(() => {
      this.setState({
        ready: true
      })
    }, 100)
  }

  componentDidUpdate (prevProps, prevState) {
    if (
      !deepEqual(prevProps.expandedKeys, this.props.expandedKeys) &&
      !deepEqual(this.props.expandedKeys, this.state.expandedKeys)
    ) {
      this.setState({
        expandedKeys: this.props.expandedKeys
      })
    }
  }

  componentWillUnmount () {
    clearTimeout(this.timer)
    window.removeEventListener('message', this.onContextAction)
  }

  handleChange = e => {
    this.setState({
      keyword: e.target.value
    })
  }

  handleCancelNew = () => {
    this.setState({
      showNewBookmarkGroupForm: false,
      bookmarkGroupTitle: ''
    })
  }

  handleCancelNewSub = () => {
    this.setState({
      bookmarkGroupSubParentId: ''
    })
  }

  handleCancelEdit = () => {
    this.setState({
      categoryId: '',
      categoryTitle: ''
    })
  }

  handleChangeEdit = e => {
    let { value } = e.target
    if (value.length > maxBookmarkGroupTitleLength) {
      value = value.slice(0, maxBookmarkGroupTitleLength)
    }
    this.setState({
      categoryTitle: value
    })
  }

  handleSubmitEdit = () => {
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
    const obj = find(
      bookmarkGroups,
      bg => bg.id === categoryId
    )
    if (!obj) {
      return this.handleCancelEdit()
    }
    obj.title = categoryTitle
    this.setState({
      categoryId: ''
    })
    this.props.store.setBookmarkGroups(
      bookmarkGroups
    )
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

  onClick = () => {

  }

  onSubmit = false

  onSubmitEdit = false

  handleChangeBookmarkGroupTitle = e => {
    let { value } = e.target
    if (value.length > maxBookmarkGroupTitleLength) {
      value = value.slice(0, maxBookmarkGroupTitleLength)
    }
    this.setState({
      bookmarkGroupTitle: value
    })
  }

  handleChangeBookmarkGroupTitleSub = e => {
    let { value } = e.target
    if (value.length > maxBookmarkGroupTitleLength) {
      value = value.slice(0, maxBookmarkGroupTitleLength)
    }
    this.setState({
      bookmarkGroupTitleSub: value
    })
  }

  handleNewBookmark = () => {
    this.props.onClickItem(getInitItem([], settingMap.bookmarks))
  }

  handleSubmit = () => {
    if (this.onSubmit) {
      return
    }
    this.onSubmit = true
    this.setState({
      showNewBookmarkGroupForm: false
    }, () => {
      this.onSubmit = false
      this.props.store.addBookmarkGroup({
        id: uid(),
        title: this.state.bookmarkGroupTitle,
        bookmarkIds: []
      })
    })
  }

  handleSubmitSub = () => {
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
        id: uid(),
        title: this.state.bookmarkGroupTitleSub,
        level: 2,
        bookmarkIds: []
      }
      bookmarkGroups = [
        newCat,
        ...bookmarkGroups
      ]
      const cat = find(
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
      this.props.store.setBookmarkGroups(
        bookmarkGroups
      )
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

  handleNewBookmarkGroup = () => {
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

  closeNewGroupForm = () => {
    this.setState({
      showNewBookmarkGroupForm: false,
      bookmarkGroupSubParentId: ''
    })
  }

  onExpand = (expandedKeys) => {
    this.setState({
      expandedKeys
    })
    this.closeNewGroupForm()
    this.props.store.setState(
      'expandedKeys', expandedKeys
    )
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
    const bookmark = find(
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
          onChange={this.handleChange}
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

  renderOperationBtn = (item, isGroup) => {
    if (this.props.staticList) {
      return null
    }
    return (
      <SettingOutlined
        className='pointer tree-control-btn'
        onClick={e => this.onContextMenu(e, item, isGroup)}
      />
    )
  }

  onCut = (item, isGroup) => {
    const str = isGroup
      ? copyBookmarkGroupItemPrefix
      : copyBookmarkItemPrefix
    const txt = str + item.id
    cut(txt, createName(item))
  }

  onPaste = (item) => {
    const str = readClipboard()
    const id = str.split(':')[1]
    const bookmarkGroups = copy(
      this.props.bookmarkGroups
    )
    const from = bookmarkGroups.find(t => {
      return t.bookmarkIds.includes(id)
    })
    from.bookmarkIds = from.bookmarkIds.filter(d => {
      return d !== id
    })
    const to = bookmarkGroups.find(t => {
      return t.id === item.id
    })
    if (!to.bookmarkIds) {
      to.bookmarkIds = []
    }
    to.bookmarkIds = uniq(
      [
        ...to.bookmarkIds,
        id
      ]
    )
    if (from) {
      this.props.store.editBookmarkGroup(
        from.id,
        {
          bookmarkIds: (from.bookmarkIds || []).filter(d => {
            return d !== id
          })
        }
      )
    }
    this.props.store.editBookmarkGroup(
      item.id,
      {
        bookmarkIds: uniq(
          [
            ...(item.bookmarkIds || []),
            id
          ]
        )
      }
    )
  }

  computePos = (e) => {
    return {
      left: e.clientX,
      top: e.clientY
    }
  }

  onContextAction = e => {
    const {
      action,
      id,
      args = [],
      func
    } = e.data || {}
    if (
      action !== commonActions.clickContextMenu ||
      id !== this.uid ||
      !this[func]
    ) {
      return false
    }
    window.removeEventListener('message', this.onContextAction)
    this[func](...args)
  }

  onContextMenu = (e, item, isGroup) => {
    e.preventDefault()
    if (this.props.staticList) {
      return null
    }
    const menus = this.renderContextItems(item, isGroup)
    this.uid = uid()
    this.props.store.openContextMenu({
      items: menus,
      id: this.uid,
      pos: this.computePos(e)
    })
    window.addEventListener('message', this.onContextAction)
    this.closeNewGroupForm()
  }

  renderContextItems (item, isGroup) {
    const res = []
    const args = [copy(item), isGroup]
    if (!isGroup) {
      // res.push({
      //   func: 'onCopy',
      //   icon: 'CopyOutlined',
      //   text: e('copy'),
      //   args
      // })
      res.push({
        func: 'onCut',
        icon: 'FileExcelOutlined',
        text: e('cut'),
        args
      })
    }
    const canPaste = hasBookmarkOrGroupInClipboardText()
    if (isGroup) {
      res.push({
        func: 'onPaste',
        icon: 'CopyOutlined',
        text: e('paste'),
        disabled: !canPaste,
        args
      })
    }
    return res
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
        expandedKeys: uniq([
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
        className='pointer tree-control-btn'
      />
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
        className='pointer tree-control-btn'
      />
    )
  }

  renderOpenAll = (item, isGroup) => {
    if (
      (this.props.staticList && isGroup) ||
      (!this.props.staticList && !isGroup)
    ) {
      return null
    }
    return (
      <Tooltip title={s('openAll')}>
        <FolderOpenOutlined
          key='open-all-tree'
          onClick={(e) => this.props.store.openAllBookmarkInCategory(item)}
          className='pointer tree-control-btn'
        />
      </Tooltip>
    )
  }

  editCategory = () => {
    const {
      categoryTitle
    } = this.state
    const confirm = (
      <span>
        <CheckOutlined className='pointer' onClick={this.handleSubmitEdit} />
        <CloseOutlined className='mg1l pointer' onClick={this.handleCancelEdit} />
      </span>
    )
    return (
      <InputAutoFocus
        value={categoryTitle}
        onChange={this.handleChangeEdit}
        onPressEnter={this.handleSubmitEdit}
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
    newbookmark.id = uid()
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
    let index = findIndex(
      bookmarkGroups,
      bg => bg.id === categoryId
    )
    if (index < 0) {
      index = findIndex(
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
    bg.bookmarkIds = uniq(bg.bookmarkIds)
    if (!isEqual(old, copy(bg.bookmarkIds))) {
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
      if (!isEqual(old, copy(bg.bookmarkIds))) {
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
    this.props.store.setBookmarkGroups(
      bookmarkGroups
    )
    this.props.store.batchDbUpdate(updates)
  }

  findBookmarkByTitle = (bookmarks, oldBookmark) => {
    return filter(bookmarks, bookmark => {
      return (bookmark.title || '').includes(oldBookmark.title) && bookmark.host === oldBookmark.host && bookmark.port === oldBookmark.port
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
        onClick={(e) => this.duplicateItem(e, item)}
      />
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
    const tag = isGroup ? '' : createTitleTag(item)
    const title = isGroup
      ? item.title
      : createName(item)
    const titleAll = title + (item.description ? ' - ' + item.description : '')
    const titleHighlight = isGroup
      ? item.title || 'no title'
      : highlight(
        title,
        this.state.keyword
      )
    return (
      <div
        className={cls}
        key={item.id || uid()}
        title={titleAll}
        onContextMenu={e => this.onContextMenu(e, item, isGroup)}
      >
        <div
          className='tree-item-title elli'
        >
          {tag}{titleHighlight}
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
        {this.renderOperationBtn(item, isGroup)}
        {this.renderDelBtn(item)}
        {this.renderEditBtn(item, isGroup)}
      </div>
    )
  }

  renderGroupBtns = (item) => {
    return [
      this.renderAddNewSubGroupBtn(item),
      this.renderEditBtn(item),
      this.renderOpenAll(item)
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
      return find(this.props.bookmarkGroups, d => d.id === id)
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
        <Space.Compact>
          <Button
            onClick={this.handleNewBookmark}
            title={`${s('new')} ${c('bookmarks')}`}
          >
            <BookOutlined className='with-plus' />
          </Button>
          <Button
            onClick={this.handleNewBookmarkGroup}
            title={`${s('new')} ${c('bookmarkCategory')}`}
          >
            <FolderOutlined className='with-plus' />
          </Button>
          <Btns
            store={this.props.store}
          />
        </Space.Compact>
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
        <CheckOutlined className='pointer' onClick={this.handleSubmitSub} />
        <CloseOutlined className='mg1l pointer' onClick={this.handleCancelNewSub} />
      </span>
    )
    return (
      <TreeNode
        key={bookmarkGroupSubParentId}
        isLeaf
        title={(
          <InputAutoFocus
            value={bookmarkGroupTitleSub}
            onPressEnter={this.handleSubmitSub}
            onChange={this.handleChangeBookmarkGroupTitleSub}
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
        <CheckOutlined className='pointer' onClick={this.handleSubmit} />
        <CloseOutlined className='mg1l pointer' onClick={this.handleCancelNew} />
      </span>
    )
    return (
      <div className='pd1y'>
        <InputAutoFocus
          value={bookmarkGroupTitle}
          onPressEnter={this.handleSubmit}
          onChange={this.handleChangeBookmarkGroupTitle}
          addonAfter={confirm}
          onBlur={this.handleBlurBookmarkGroupTitle}
        />
      </div>
    )
  }

  render () {
    const { ready } = this.state
    if (!ready) {
      return (
        <div className='pd3 aligncenter'>
          <LoadingOutlined />
        </div>
      )
    }
    const {
      bookmarkGroups,
      type,
      activeItemId,
      staticList,
      listStyle = {}
    } = this.props
    const { keyword, expandedKeys } = this.state
    const level1Bookgroups = ready
      ? bookmarkGroups.filter(
        d => !d.level || d.level < 2
      )
      : []
    const treeProps = {
      onExpand: this.onExpand,
      expandedKeys: keyword ? bookmarkGroups.map(f => f.id) : expandedKeys,
      onSelect: this.onSelect,
      draggable: staticList ? false : { icon: false },
      selectedKeys: [activeItemId],
      onDrop: this.onDrop
    }
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
            {...treeProps}
          >
            {level1Bookgroups.map(this.renderItem)}
          </Tree>
        </div>
      </div>
    )
  }
}
