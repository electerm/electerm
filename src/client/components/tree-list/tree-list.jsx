/**
 * tree list for bookmarks
 */

import React from 'react'
import { Component } from 'manate/react/class-components'
import { LoadingOutlined } from '@ant-design/icons'
import { uniq, filter, pick } from 'lodash-es'
import {
  maxBookmarkGroupTitleLength,
  defaultBookmarkGroupId,
  settingMap
} from '../../common/constants'
import findParentBySel from '../../common/find-parent'
import copy from 'json-deep-copy'
import NewButtonsGroup from './bookmark-toolbar'
import findBookmarkGroupId from '../../common/find-bookmark-group-id'
import getInitItem from '../../common/init-setting-item'
import uid from '../../common/uid'
import { action } from 'manate'
import './tree-list.styl'
import TreeListRow from './tree-list-row'
import TreeListEditorOverlay from './tree-list-editor-overlay.jsx'
import TreeSearch from './tree-search'
import VirtualTreeList from './virtual-tree-list'
import { buildVisibleTreeRows } from './tree-list-rows'
import { getRandomDefaultColor } from '../../common/rand-hex-color.js'
import {
  treeEditorRowHeight,
  treeLevelIndent,
  treeRowHeight
} from './tree-list-layout'

export default class ItemListTree extends Component {
  constructor (props) {
    super(props)
    this.state = {
      ready: false,
      keyword: '',
      parentId: '',
      showNewBookmarkGroupForm: false,
      bookmarkGroupTitle: '',
      bookmarkGroupColor: '',
      categoryTitle: '',
      categoryColor: '',
      categoryId: '',
      searchSelectedRowKey: ''
    }
    this.listRef = React.createRef()
  }

  onSubmit = false

  onSubmitEdit = false

  componentDidMount () {
    this.timer = setTimeout(() => {
      this.setState({
        ready: true
      })
    }, 0)
  }

  componentWillUnmount () {
    clearTimeout(this.timer)
  }

  scrollTreeToTop = () => {
    const listWrap = this.listRef.current
    if (listWrap) {
      listWrap.scrollTop = 0
    }
  }

  onCancelMoveItem = () => {
    this.setState({
      openMoveModal: false,
      moveItem: null,
      moveItemIsGroup: false
    })
  }

  onExpandKey = group => {
    const {
      expandedKeys
    } = window.store
    expandedKeys.push(group.id)
    this.onExpand()
  }

  onUnExpandKey = group => {
    const {
      expandedKeys
    } = window.store
    const index = expandedKeys.findIndex(
      d => d === group.id
    )
    if (index < 0) {
      return
    }
    expandedKeys.splice(index, 1)
    this.onExpand(expandedKeys)
  }

  handleChange = keyword => {
    this.setState({
      keyword,
      searchSelectedRowKey: ''
    })
  }

  handleKeyDown = (e) => {
    const { keyword } = this.state
    if (!keyword) return
    this.handleVirtualTreeKeyDown(e)
  }

  handleVirtualTreeKeyDown = (e) => {
    const { matchedRowKeys, rows } = this.getVisibleTreeData()
    if (!matchedRowKeys.length) {
      return
    }

    const { searchSelectedRowKey } = this.state
    const currentIndex = matchedRowKeys.indexOf(searchSelectedRowKey)

    if (e.key === 'ArrowDown') {
      e.preventDefault()
      const nextIndex = (currentIndex + 1) % matchedRowKeys.length
      const rowKey = matchedRowKeys[nextIndex]
      this.setState({ searchSelectedRowKey: rowKey })
      this.scrollRowIntoView(rows, rowKey)
      return
    }

    if (e.key === 'ArrowUp') {
      e.preventDefault()
      const nextIndex = currentIndex <= 0 ? matchedRowKeys.length - 1 : currentIndex - 1
      const rowKey = matchedRowKeys[nextIndex]
      this.setState({ searchSelectedRowKey: rowKey })
      this.scrollRowIntoView(rows, rowKey)
      return
    }

    if (e.key === 'Enter') {
      e.preventDefault()
      const rowKey = currentIndex >= 0
        ? matchedRowKeys[currentIndex]
        : matchedRowKeys[0]
      const row = rows.find(item => item.key === rowKey)
      if (row?.item?.id) {
        this.selectBookmarkById(row.item.id)
      }
    }
  }

  scrollRowIntoView = (rows, rowKey) => {
    const listWrap = this.listRef.current
    if (!listWrap) {
      return
    }
    const rowIndex = rows.findIndex(row => row.key === rowKey)
    if (rowIndex < 0) {
      return
    }
    const rowTop = rowIndex * treeRowHeight
    const rowBottom = rowTop + treeRowHeight
    const viewportTop = listWrap.scrollTop
    const viewportBottom = viewportTop + listWrap.clientHeight

    if (rowTop < viewportTop) {
      listWrap.scrollTop = rowTop
    } else if (rowBottom > viewportBottom) {
      listWrap.scrollTop = rowBottom - listWrap.clientHeight
    }
  }

  getVisibleTreeData = () => {
    return buildVisibleTreeRows({
      bookmarkGroups: this.props.bookmarkGroups,
      bookmarkGroupTree: this.props.bookmarkGroupTree,
      bookmarksMap: this.props.bookmarksMap,
      expandedKeys: this.props.expandedKeys,
      keyword: this.state.keyword
    })
  }

  handleCancelNew = () => {
    this.setState({
      showNewBookmarkGroupForm: false,
      bookmarkGroupTitle: '',
      bookmarkGroupColor: ''
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
      categoryTitle: '',
      categoryColor: ''
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
      categoryColor,
      categoryId
    } = this.state
    if (!categoryTitle) {
      return
    }
    const { bookmarkGroups } = window.store
    const obj = bookmarkGroups.find(
      bg => bg.id === categoryId
    )
    if (!obj) {
      return this.handleCancelEdit()
    }
    obj.title = categoryTitle
    if (categoryColor) {
      obj.color = categoryColor
    }
    this.setState({
      categoryId: ''
    })
  }

  onClick = () => {

  }

  openMoveModal = (e, item, isGroup) => {
    e.stopPropagation()
    window.store.storeAssign({
      openMoveModal: true,
      moveItem: item,
      moveItemIsGroup: isGroup
    })
  }

  handleChangeBookmarkGroupTitle = e => {
    let { value } = e.target
    if (value.length > maxBookmarkGroupTitleLength) {
      value = value.slice(0, maxBookmarkGroupTitleLength)
    }
    this.setState({
      bookmarkGroupTitle: value
    })
  }

  handleChangeBookmarkGroupColor = color => {
    this.setState({
      bookmarkGroupColor: color
    })
  }

  handleChangeCategoryColor = color => {
    this.setState({
      categoryColor: color
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
      const newGroup = {
        id: uid(),
        title: this.state.bookmarkGroupTitle,
        bookmarkIds: []
      }
      if (this.state.bookmarkGroupColor) {
        newGroup.color = this.state.bookmarkGroupColor
      }
      window.store.addBookmarkGroup(newGroup)
    })
  }

  handleSubmitSub = () => {
    if (this.onSubmit) {
      return
    }
    this.onSubmit = true
    this.parentId = this.state.parentId
    this.setState({
      showNewBookmarkGroupForm: false,
      parentId: ''
    }, this.afterSubmitSub)
  }

  afterSubmitSub = action(() => {
    const id = this.parentId
    this.onSubmit = false
    const { bookmarkGroups } = window.store
    const newCat = {
      id: uid(),
      title: this.state.bookmarkGroupTitle,
      level: 2,
      bookmarkIds: []
    }
    if (this.state.bookmarkGroupColor) {
      newCat.color = this.state.bookmarkGroupColor
    }
    bookmarkGroups.unshift(newCat)
    const cat = bookmarkGroups.find(
      d => d.id === id
    )
    if (!cat) {
      return
    }
    cat.bookmarkGroupIds = [
      ...(cat.bookmarkGroupIds || []),
      newCat.id
    ]
  })

  handleNewBookmarkGroup = () => {
    this.setState({
      showNewBookmarkGroupForm: true,
      bookmarkGroupTitle: '',
      bookmarkGroupColor: getRandomDefaultColor(),
      parentId: ''
    }, this.scrollTreeToTop)
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

  onExpand = () => {
    this.closeNewGroupForm()
  }

  onSelect = (
    e
  ) => {
    const id = e.currentTarget.getAttribute('data-item-id')
    const isGroup = e.currentTarget.getAttribute('data-is-group') === 'true'
    const { store } = window
    if (isGroup) {
      store.storeAssign({
        currentBookmarkGroupId: id
      })
      const func = this.props.expandedKeys.includes(id)
        ? this.onUnExpandKey
        : this.onExpandKey
      func({ id })
    } else {
      this.selectBookmarkById(id)
    }
  }

  selectBookmarkById = (id) => {
    const { store } = window
    store.storeAssign({
      currentBookmarkGroupId: findBookmarkGroupId(store.bookmarkGroups, id)
    })
    const { bookmarks } = this.props
    const bookmark = bookmarks.find(
      d => d.id === id
    )
    if (bookmark) {
      this.props.onClickItem(bookmark)
    }
  }

  renderSearch = () => {
    return (
      <div className='pd1y'>
        <TreeSearch
          onSearch={this.handleChange}
          keyword={this.state.keyword}
          autoFocus={this.props.autoFocus}
          onKeyDown={this.handleKeyDown}
        />
      </div>
    )
  }

  editItem = (e, item, isGroup) => {
    e.stopPropagation()
    if (isGroup) {
      this.setState({
        categoryTitle: '' + item.title,
        categoryColor: item.color || '',
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
        bookmarkGroupColor: getRandomDefaultColor()
      }
    })
    window.store.expandedKeys.push(item.id)
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

  onDragEnter = e => {
    e.preventDefault()
    let {
      target
    } = e
    const tar = findParentBySel(target, '.tree-item')
    if (tar) {
      target = tar
    }
    target.classList.add('item-dragover-top')
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
    target.classList.remove('item-dragover-top')
  }

  onDragOver = e => {
    let {
      target
    } = e
    const tar = findParentBySel(target, '.tree-item')
    if (tar) {
      target = tar
    }
    target.classList.add('item-dragover-top')
  }

  onDrop = action(e => {
    e.preventDefault()
    const elems = document.querySelectorAll('.tree-item.item-dragover-top')
    elems.forEach(elem => {
      elem.classList.remove('item-dragover-top')
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
      ) ||
      idDragged === idDrop
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
      return
    }
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
      }
    }
  })

  duplicateItem = (e, item) => {
    e.stopPropagation()
    const { addItem } = window.store
    const { bookmarkGroups } = this.props

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
      newbookmark,
      categoryId
    )
    this.props.onClickItem(newbookmark)
  }

  updateBookmarkGroups = (bookmark, categoryId) => {
    const {
      bookmarkGroups
    } = window.store
    let index = bookmarkGroups.findIndex(
      bg => bg.id === categoryId
    )
    if (index < 0) {
      index = bookmarkGroups.findIndex(
        bg => bg.id === defaultBookmarkGroupId
      )
    }
    const bid = bookmark.id
    const bg = bookmarkGroups[index]
    if (!bg.bookmarkIds.includes(bid)) {
      bg.bookmarkIds.unshift(bid)
    }
    bg.bookmarkIds = uniq(bg.bookmarkIds)
    bookmarkGroups.forEach((bg, i) => {
      if (i === index) {
        return
      }
      bg.bookmarkIds = bg.bookmarkIds.filter(
        g => g !== bid
      )
    })
  }

  findBookmarkByTitle = (bookmarks, oldBookmark) => {
    return filter(bookmarks, bookmark => {
      return (bookmark.title || '').includes(oldBookmark.title) && bookmark.host === oldBookmark.host && bookmark.port === oldBookmark.port
    })
  }

  renderVirtualRow = (row, editor) => {
    return (
      <TreeListRow
        row={row}
        keyword={this.state.keyword}
        expandedKeys={this.props.expandedKeys}
        activeItemId={this.props.activeItemId}
        searchSelectedRowKey={this.state.searchSelectedRowKey}
        staticList={this.props.staticList}
        leftSidebarWidth={this.props.leftSidebarWidth}
        {...pick(
          this,
          [
            'del',
            'openAll',
            'openMoveModal',
            'editItem',
            'addSubCat',
            'onSelect',
            'duplicateItem',
            'onDragStart',
            'onDrop',
            'onDragEnter',
            'onDragLeave',
            'onDragOver'
          ]
        )}
        handleExpand={this.onExpandKey}
        handleUnExpand={this.onUnExpandKey}
        isHidden={editor?.hideRowKey === row.key}
      />
    )
  }

  getEditorOverlayState = (rows) => {
    const {
      categoryColor,
      categoryId,
      categoryTitle,
      bookmarkGroupColor,
      bookmarkGroupTitle,
      parentId,
      showNewBookmarkGroupForm
    } = this.state

    if (categoryId) {
      const rowIndex = rows.findIndex(row => row.isGroup && row.item.id === categoryId)
      if (rowIndex < 0) {
        return null
      }
      const row = rows[rowIndex]
      return {
        top: rowIndex * treeRowHeight,
        left: Math.max(0, (row.depth - 1) * treeLevelIndent),
        title: categoryTitle,
        color: categoryColor,
        handleTitleChange: this.handleChangeEdit,
        handleColorChange: this.handleChangeCategoryColor,
        handleSubmit: this.handleSubmitEdit,
        handleCancel: this.handleCancelEdit,
        selectall: true,
        hideRowKey: row.key
      }
    }

    if (!showNewBookmarkGroupForm) {
      return null
    }

    if (!parentId) {
      return {
        top: 0,
        left: 0,
        title: bookmarkGroupTitle,
        color: bookmarkGroupColor,
        handleTitleChange: this.handleChangeBookmarkGroupTitle,
        handleColorChange: this.handleChangeBookmarkGroupColor,
        handleSubmit: this.handleSubmit,
        handleCancel: this.handleCancelNew,
        insertionGap: {
          index: 0,
          height: treeEditorRowHeight
        }
      }
    }

    const parentIndex = rows.findIndex(row => row.isGroup && row.item.id === parentId)
    if (parentIndex < 0) {
      return null
    }
    const parentRow = rows[parentIndex]
    return {
      top: (parentIndex + 1) * treeRowHeight,
      left: parentRow.depth * treeLevelIndent,
      title: bookmarkGroupTitle,
      color: bookmarkGroupColor,
      handleTitleChange: this.handleChangeBookmarkGroupTitle,
      handleColorChange: this.handleChangeBookmarkGroupColor,
      handleSubmit: this.handleSubmit,
      handleCancel: this.handleCancelNew,
      insertionGap: {
        index: parentIndex + 1,
        height: treeEditorRowHeight
      }
    }
  }

  renderVirtualTreeContent = (rows, editor) => {
    return (
      <VirtualTreeList
        items={rows}
        rowHeight={treeRowHeight}
        containerRef={this.listRef}
        insertionGap={editor?.insertionGap}
        renderItem={row => this.renderVirtualRow(row, editor)}
      />
    )
  }

  renderEditorOverlay = (editor) => {
    return <TreeListEditorOverlay editor={editor} />
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
        onExport={this.handleExport}
        onSshConfigs={this.handleSshConfigs}
        bookmarkGroups={this.props.bookmarkGroups}
        bookmarks={this.props.bookmarks}
      />
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
      type,
      staticList,
      listStyle = {}
    } = this.props
    const { rows } = this.getVisibleTreeData()
    const editor = this.getEditorOverlayState(rows)
    return (
      <div className={`tree-list item-type-${type}`}>
        <div className='tree-list-header'>
          {
            staticList
              ? null
              : this.renderNewButtons()
          }
          {
            this.renderSearch()
          }
        </div>
        <div
          className='item-list-wrap'
          style={listStyle}
          ref={this.listRef}
        >
          {this.renderVirtualTreeContent(rows, editor)}
          {this.renderEditorOverlay(editor)}
        </div>
      </div>
    )
  }
}
