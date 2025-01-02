/**
 * tree list for bookmarks
 */

import { Component } from 'react'
import {
  CheckOutlined,
  CloseOutlined,
  LoadingOutlined
} from '@ant-design/icons'
import {
  readClipboard,
  cut,
  hasBookmarkOrGroupInClipboardText
} from '../../common/clipboard'
import createName from '../../common/create-title'
import InputAutoFocus from '../common/input-auto-focus'
import { find, uniq, isEqual, filter, pick } from 'lodash-es'
import {
  maxBookmarkGroupTitleLength,
  defaultBookmarkGroupId,
  settingMap,
  commonActions,
  copyBookmarkItemPrefix,
  copyBookmarkGroupItemPrefix
} from '../../common/constants'
import findParentBySel from '../../common/find-parent'
import copy, { deepCopy } from 'json-deep-copy'
import NewButtonsGroup from './bookmark-toolbar'
import findBookmarkGroupId from '../../common/find-bookmark-group-id'
import getInitItem from '../../common/init-setting-item'
import uid from '../../common/uid'
import deepEqual from 'fast-deep-equal'
import './tree-list.styl'
import TreeExpander from './tree-expander'
import TreeListItem from './tree-list-item'
import TreeSearch from './tree-search'

const e = window.translate

export default class ItemListTree extends Component {
  constructor (props) {
    super(props)
    this.state = {
      ready: false,
      keyword: '',
      parentId: '',
      showNewBookmarkGroupForm: false,
      bookmarkGroupTitle: '',
      categoryTitle: '',
      categoryId: '',
      expandedKeys: props.expandedKeys
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
        expandedKeys: deepCopy(this.props.expandedKeys)
      })
    }
  }

  componentWillUnmount () {
    clearTimeout(this.timer)
    window.removeEventListener('message', this.onContextAction)
  }

  filter = list => {
    const { keyword } = this.state
    return keyword
      ? list.filter(item => {
        return createName(item).toLowerCase().includes(keyword.toLowerCase())
      })
      : list
  }

  getBookmarkTree = () => {
    return this.filter(this.props.bookmarks).reduce((tree, bookmark) => {
      tree[bookmark.id] = bookmark
      return tree
    }, {})
  }

  onExpandKey = group => {
    const nkeys = [
      ...this.state.expandedKeys,
      group.id
    ]
    this.onExpand(nkeys)
  }

  onUnExpandKey = group => {
    const nkeys = this.state.expandedKeys.filter(
      d => d !== group.id
    )
    this.onExpand(nkeys)
  }

  handleChange = keyword => {
    this.setState({
      keyword
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
    const { store } = window
    store.setBookmarkGroups(
      bookmarkGroups
    )
    store.batchDbUpdate([{
      id: categoryId,
      db: 'bookmarkGroups',
      upsert: false,
      update: {
        title: categoryTitle
      }
    }])
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

  handleNewBookmark = () => {
    this.props.onClickItem(getInitItem([], settingMap.bookmarks))
  }

  handleSubmit = () => {
    if (this.onSubmit) {
      return
    }
    if (this.state.parentId) {
      return this.handleSubmitSub()
    }
    this.onSubmit = true
    this.setState({
      showNewBookmarkGroupForm: false
    }, () => {
      this.onSubmit = false
      window.store.addBookmarkGroup({
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
    const id = this.state.parentId
    this.setState({
      showNewBookmarkGroupForm: false,
      parentId: ''
    }, () => {
      this.onSubmit = false
      let bookmarkGroups = copy(
        this.props.bookmarkGroups
      )
      const newCat = {
        id: uid(),
        title: this.state.bookmarkGroupTitle,
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
      const { store } = window
      store.setBookmarkGroups(
        bookmarkGroups
      )
      store.batchDbAdd([{
        db: 'bookmarkGroups',
        obj: newCat
      }])
      store.batchDbUpdate([{
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
      parentId: ''
    })
  }

  del = (item, e) => {
    e.stopPropagation()
    const { store } = window
    if (item.bookmarkIds) {
      return store.delBookmarkGroup(item)
    }
    store.onDelItem(item, this.props.type)
    store.delItem(item, this.props.type)
  }

  closeNewGroupForm = () => {
    this.setState({
      showNewBookmarkGroupForm: false,
      parentId: ''
    })
  }

  onExpand = (expandedKeys) => {
    this.setState({
      expandedKeys
    })
    this.closeNewGroupForm()
    window.store.expandedKeys = deepCopy(expandedKeys)
  }

  onSelect = (
    e
  ) => {
    const id = e.target.getAttribute('data-item-id')
    const isGroup = e.target.getAttribute('data-is-group') === 'true'
    const { store } = window
    if (isGroup) {
      store.storeAssign({
        currentBookmarkGroupId: id
      })
    } else {
      store.storeAssign({
        currentBookmarkGroupId: findBookmarkGroupId(store.bookmarkGroups, id)
      })
      const { bookmarks } = this.props
      const bookmark = find(
        bookmarks,
        d => d.id === id
      )
      if (bookmark) {
        this.props.onClickItem(bookmark)
      }
    }
  }

  renderSearch = () => {
    return (
      <div className='pd1y'>
        <TreeSearch
          onSearch={this.handleChange}
          keyword={this.state.keyword}
        />
      </div>
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
    const { store } = window
    if (from) {
      store.editBookmarkGroup(
        from.id,
        {
          bookmarkIds: (from.bookmarkIds || []).filter(d => {
            return d !== id
          })
        }
      )
    }
    store.editBookmarkGroup(
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
    if (action === commonActions.closeContextMenuAfter) {
      window.removeEventListener('message', this.onContextAction)
      return false
    }
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
    window.store.openContextMenu({
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
        categoryId: item.id,
        bookmarkGroupSubParentId: ''
      })
    } else {
      window.store.openBookmarkEdit(item)
    }
  }

  addSubCat = (e, item) => {
    this.setState(old => {
      return {
        showNewBookmarkGroupForm: true,
        parentId: item.id,
        bookmarkGroupTitle: '',
        expandedKeys: uniq([
          ...old.expandedKeys,
          item.id
        ])
      }
    })
  }

  openAll = (item) => {
    window.store.openAllBookmarkInCategory(item)
  }

  onDragStart = e => {
    let {
      target
    } = e
    const tar = findParentBySel(target, '.tree-item')
    if (tar) {
      target = tar
    }
    const id = target.getAttribute('data-item-id')
    const pid = target.getAttribute('data-parent-id')
    const isGroup = target.getAttribute('data-is-group')
    e.dataTransfer
      .setData(
        'idDragged', `${id}@${pid}@${isGroup}`
      )
  }

  onDragLeave = e => {
    e.preventDefault()
    let {
      target
    } = e
    const tar = findParentBySel(target, '.tree-item')
    if (tar) {
      target = tar
    }
    target.classList.remove('item-dragover')
  }

  onDragOver = e => {
    let {
      target
    } = e
    const tar = findParentBySel(target, '.tree-item')
    if (tar) {
      target = tar
    }
    target.classList.add('item-dragover')
  }

  onDrop = e => {
    e.preventDefault()
    const elems = document.querySelectorAll('.tree-item.item-dragover')
    elems.forEach(elem => {
      elem.classList.remove('item-dragover')
    })
    let {
      target
    } = e
    const tar = findParentBySel(target, '.tree-item')
    if (tar) {
      target = tar
    }
    const dataDragged = e.dataTransfer.getData('idDragged')
    const [idDragged, pidDrags, isGroupDragged] = dataDragged.split('@')
    const isGroupDrag = isGroupDragged === 'true'
    const pidDragsArr = pidDrags.split('#')
    const pidDragged = pidDragsArr[pidDragsArr.length - 1]
    const idDrop = target.getAttribute('data-item-id')
    const isGroupDrop = target.getAttribute('data-is-group') === 'true'
    const pidDrops = target.getAttribute('data-parent-id') || ''
    const pidDropsArr = pidDrops.split('#')
    const pidDrop = pidDropsArr[pidDropsArr.length - 1]

    // can not drag item to its own children
    if (
      (idDragged === 'default' &&
      pidDrop !== '') ||
      (
        pidDrop &&
        pidDrags !== pidDrops &&
        pidDrops.includes(idDragged)
      )
    ) {
      return
    }

    const {
      bookmarkGroups
    } = window.store

    if (!pidDragged && !pidDrop) {
      const indexDrag = bookmarkGroups.findIndex(item => item.id === idDragged)
      if (indexDrag < 0) {
        return
      }
      const dragItem = bookmarkGroups.splice(indexDrag, 1)[0]
      dragItem.level = 1
      const indexDrop = bookmarkGroups.findIndex(item => item.id === idDrop)
      if (indexDrop < 0) {
        return
      }
      bookmarkGroups.splice(
        indexDrop,
        0,
        dragItem
      )
      return window.store.setState('bookmarkGroups', bookmarkGroups)
    }
    const updates = []
    if (isGroupDrag) {
      const parentDrag = pidDragged
        ? bookmarkGroups.find(
          item => item.id === pidDragged
        )
        : false
      if (parentDrag) {
        parentDrag.bookmarkGroupIds = (parentDrag.bookmarkGroupIds || []).filter(
          id => id !== idDragged
        )
        updates.push({
          upsert: false,
          id: parentDrag.id,
          update: {
            bookmarkGroupIds: parentDrag.bookmarkGroupIds
          },
          db: 'bookmarkGroups'
        })
      }
      const parentDrop = pidDrop
        ? bookmarkGroups.find(
          item => item.id === pidDrop
        )
        : bookmarkGroups.find(
          item => item.id === idDrop
        )
      if (!parentDrop) {
        return
      }
      if (!pidDrop) {
        parentDrop.bookmarkGroupIds = uniq(
          [
            ...(parentDrop.bookmarkGroupIds || []),
            idDragged
          ]
        )
      } else {
        const arr = parentDrop.bookmarkGroupIds || []
        let index = arr.findIndex(item => item === idDrop)
        if (index < 0) {
          index = 0
        }
        arr.splice(index, 0, idDragged)
      }
      updates.push({
        upsert: false,
        id: parentDrop.id,
        update: {
          bookmarkGroupIds: parentDrop.bookmarkGroupIds
        },
        db: 'bookmarkGroups'
      })
    } else {
      const parentDrag = bookmarkGroups.find(
        item => item.id === pidDragged
      )
      if (!parentDrag) {
        return
      }
      parentDrag.bookmarkIds = (parentDrag.bookmarkIds || []).filter(
        id => id !== idDragged
      )
      updates.push({
        upsert: false,
        id: parentDrag.id,
        update: {
          bookmarkIds: parentDrag.bookmarkIds
        },
        db: 'bookmarkGroups'
      })
      const parentDrop = isGroupDrop
        ? bookmarkGroups.find(
          item => item.id === idDrop
        )
        : bookmarkGroups.find(
          item => item.id === pidDrop
        )
      if (!parentDrop) {
        return
      }
      if (isGroupDrop) {
        parentDrop.bookmarkIds = uniq(
          [
            ...(parentDrop.bookmarkIds || []),
            idDragged
          ]
        )
      } else {
        const arr = parentDrop.bookmarkIds || []
        let index = arr.findIndex(item => item === idDrop)
        if (index < 0) {
          index = 0
        }
        arr.splice(index, 0, idDragged)
      }
      updates.push({
        upsert: false,
        id: parentDrop.id,
        update: {
          bookmarkIds: parentDrop.bookmarkIds
        },
        db: 'bookmarkGroups'
      })
    }
    if (
      isGroupDrag &&
      pidDrop &&
      !pidDragged
    ) {
      const i = bookmarkGroups.findIndex(item => item.id === idDragged)
      if (i >= 0) {
        const item = bookmarkGroups[i]
        item.level = 2
        updates.push({
          upsert: false,
          id: item.id,
          update: {
            level: item.level
          },
          db: 'bookmarkGroups'
        })
      }
    }
    window.store.batchDbUpdate(updates)
    return window.store.setState('bookmarkGroups', bookmarkGroups)
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
    const { addItem } = window.store
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
    window.store.storeAssign({
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
    let index = bookmarkGroups.findIndex(
      bg => bg.id === categoryId
    )
    if (index < 0) {
      index = bookmarkGroups.findIndex(
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
    window.store.setBookmarkGroups(
      bookmarkGroups
    )
    window.store.batchDbUpdate(updates)
  }

  findBookmarkByTitle = (bookmarks, oldBookmark) => {
    return filter(bookmarks, bookmark => {
      return (bookmark.title || '').includes(oldBookmark.title) && bookmark.host === oldBookmark.host && bookmark.port === oldBookmark.port
    })
  }

  renderItemTitle = (item, isGroup, parentId) => {
    if (isGroup && item.id === this.state.categoryId) {
      return this.editCategory(item)
    }
    const itemProps = {
      item,
      isGroup,
      parentId,
      leftSidebarWidth: this.props.leftSidebarWidth,
      staticList: this.props.staticList,
      selectedItemId: this.props.activeItemId,
      ...pick(
        this,
        [
          'del',
          'openAll',
          'onContextMenu',
          'editItem',
          'addSubCat',
          'onSelect',
          'duplicateItem',
          'onDragStart',
          'onDrop',
          'onDragLeave',
          'onDragOver'
        ]
      ),
      ...pick(
        this.state,
        [
          'keyword',
          'openAll',
          'onContextMenu',
          'editItem',
          'addSubCat',
          'onSelect',
          'duplicateItem'
        ]
      )
    }
    return (
      <TreeListItem
        {...itemProps}
      />
    )
  }

  handleImport = () => {
    document.querySelector('.upload-bookmark-icon input')?.click()
  }

  handleExport = () => {
    document.querySelector('.download-bookmark-icon')?.click()
  }

  handleSshConfigs = () => {
    window.store.showSshConfigModal = true
  }

  renderNewButtons = () => {
    return (
      <NewButtonsGroup
        onNewBookmark={this.handleNewBookmark}
        onNewBookmarkGroup={this.handleNewBookmarkGroup}
        onImport={this.handleImport}
        onExport={this.handleExport}
        onSshConfigs={this.handleSshConfigs}
        bookmarkGroups={this.props.bookmarkGroups}
        bookmarks={this.props.bookmarks}
      />
    )
  }

  renderGroup = (group, index, parentId) => {
    const pids = typeof parentId === 'string' ? parentId : ''
    const pid = pids + '#' + group.id
    return (
      <div key={group.id} className='group-container'>
        {
          this.renderExpander(group, pid)
        }
        {
          this.renderGroupTitle(group, pids)
        }
        <div className='group-container-sub'>
          {
            this.renderNewCat(group, pid)
          }
          {
            this.renderGroupChildren(group, pid)
          }
        </div>
      </div>
    )
  }

  renderNewCat = (group) => {
    const {
      bookmarkGroupTitle,
      parentId,
      showNewBookmarkGroupForm
    } = this.state
    if (!showNewBookmarkGroupForm || group.id !== parentId) {
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

  renderExpander = (group, level) => {
    const expProps = {
      level,
      group,
      keyword: this.state.keyword,
      expandedKeys: this.state.expandedKeys,
      onExpand: this.onExpandKey,
      onUnExpand: this.onUnExpandKey
    }
    return (
      <TreeExpander
        {...expProps}
      />
    )
  }

  renderGroupTitle = (group, parentId) => {
    return this.renderItemTitle(group, true, parentId)
  }

  renderGroupChildren = (group, parentId) => {
    const {
      bookmarkIds = [],
      bookmarkGroupIds = [],
      id
    } = group
    const shouldRender = this.state.keyword || this.state.expandedKeys.includes(id)
    if (!shouldRender) {
      return null
    }
    return [
      ...this.renderSubGroup(bookmarkGroupIds, parentId),
      ...this.renderChilds(bookmarkIds, parentId)
    ]
  }

  renderSubGroup = (bookmarkGroupIds, parentId) => {
    const bookmarkGroups = bookmarkGroupIds.map(id => {
      return window.store.bookmarkGroupTree[id]
    }).filter(d => d)
    return bookmarkGroups.map((node, i) => {
      return this.renderGroup(node, i, parentId)
    })
  }

  renderChilds = (bookmarkIds, pid) => {
    const bookmarks = bookmarkIds.map(id => {
      return this.getBookmarkTree()[id]
    }).filter(d => d)
    return bookmarks.map((node) => {
      return this.renderItemTitle(node, false, pid)
    })
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
      staticList,
      listStyle = {}
    } = this.props
    const level1Bookgroups = ready
      ? bookmarkGroups.filter(
        d => !d.level || d.level < 2
      )
      : []
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
        <div className='item-list-wrap' style={listStyle}>
          {this.renderNewCat({ id: '' })}
          {level1Bookgroups.map(this.renderGroup)}
        </div>
      </div>
    )
  }
}
