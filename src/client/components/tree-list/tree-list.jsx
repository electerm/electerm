/**
 * tree list for bookmarks
 */

import { Component } from '../common/component'
import {
  CheckOutlined,
  CloseOutlined,
  LoadingOutlined
} from '@ant-design/icons'
import createName from '../../common/create-title'
import InputAutoFocus from '../common/input-auto-focus'
import { find, uniq, filter, pick } from 'lodash-es'
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
import TreeExpander from './tree-expander'
import TreeListItem from './tree-list-item'
import TreeSearch from './tree-search'
import MoveItemModal from './move-item-modal'

export default class ItemListTree extends Component {
  constructor (props) {
    super(props)
    this.state = {
      ready: false,
      keyword: '',
      parentId: '',
      showNewBookmarkGroupForm: false,
      openMoveModal: false,
      moveItem: null,
      moveItemIsGroup: false,
      bookmarkGroupTitle: '',
      categoryTitle: '',
      categoryId: ''
    }
  }

  onSubmit = false

  onSubmitEdit = false

  componentDidMount () {
    this.timer = setTimeout(() => {
      this.setState({
        ready: true
      })
    }, 100)
  }

  componentWillUnmount () {
    clearTimeout(this.timer)
  }

  onCancelMoveItem = () => {
    this.setState({
      openMoveModal: false,
      moveItem: null,
      moveItemIsGroup: false
    })
  }

  filter = (list) => {
    const { keyword } = this.state
    return keyword
      ? list.filter(item => {
        return createName(item).toLowerCase().includes(keyword.toLowerCase())
      })
      : list
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
    const { bookmarkGroups } = window.store
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
  }

  onClick = () => {

  }

  openMoveModal = (e, item, isGroup) => {
    e.stopPropagation()
    this.setState({
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
    bookmarkGroups.unshift(newCat)
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
  })

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

  onExpand = () => {
    this.closeNewGroupForm()
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
        bookmarkGroupTitle: ''
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

  onDrop = action(e => {
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
          'openMoveModal',
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
          'keyword'
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
      expandedKeys: this.props.expandedKeys,
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
    const shouldRender = this.state.keyword || this.props.expandedKeys.includes(id)
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
    const tree = this.props.bookmarksMap
    const { keyword } = this.state
    const bookmarks = bookmarkIds.map(id => {
      const item = tree.get(id)
      if (!item) {
        return null
      }
      return createName(item).toLowerCase().includes(keyword.toLowerCase())
        ? item
        : null
    }).filter(d => d)
    return bookmarks.map((node) => {
      return this.renderItemTitle(node, false, pid)
    })
  }

  render () {
    const { ready, openMoveModal, moveItem, moveItemIsGroup } = this.state
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
    const moveProps = {
      openMoveModal,
      moveItem,
      moveItemIsGroup,
      bookmarkGroups,
      onCancelMoveItem: this.onCancelMoveItem
    }
    const level1Bookgroups = ready
      ? bookmarkGroups.filter(
        d => !d.level || d.level < 2
      )
      : []
    return (
      <div className={`tree-list item-type-${type}`}>
        <MoveItemModal {...moveProps} />
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
