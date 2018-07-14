/**
 * tree list for bookmarks
 */

import React from 'react'
import {
  Icon,
  Popconfirm,
  Tree,
  Button,
  Input
} from 'antd'
import createName from '../../common/create-title'
import classnames from 'classnames'
import {generate} from 'shortid'
import InputAutoFocus from '../common/input-auto-focus'
import _ from 'lodash'
import {
  maxBookmarkGroupTitleLength,
  defaultookmarkGroupId
} from '../../common/constants'
import './tree-list.styl'
import copy from 'json-deep-copy'

const {Search} = Input
const {TreeNode} = Tree
const {prefix} = window
const e = prefix('menu')
const c = prefix('common')
const s = prefix('setting')

export default class ItemList extends React.Component {

  state = {
    keyword: '',
    expandedKeys: [defaultookmarkGroupId],
    showNewBookmarkGroupForm: false,
    bookmarkGroupTitle: '',
    categoryTitle: '',
    categoryId: ''
  }

  onChange = e => {
    this.setState({
      keyword: e.target.value
    })
  }

  cancelNew = () => {
    this.setState({
      showNewBookmarkGroupForm: '',
      bookmarkGroupTitle: ''
    })
  }

  cancelEdit = () => {
    this.setState({
      categoryId: '',
      categoryTitle: ''
    })
  }

  onChangeEdit = e => {
    let {value} = e.target
    if (value.length > maxBookmarkGroupTitleLength) {
      value = value.slice(0, maxBookmarkGroupTitleLength)
    }
    this.setState({
      categoryTitle: value
    })
  }

  submitEdit = () => {
    let {
      categoryTitle,
      categoryId
    } = this.state
    if (!categoryTitle) {
      return
    }
    let bookmarkGroups = copy(
      this.props.bookmarkGroups
    )
    let obj = _.find(
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
    this.props.modifyLs({
      bookmarkGroups
    })
  }

  onDrop = (info) => {
    let {
      dropToGap,
      dragNode,
      dropPosition,
      node
    } = info
    let dropPosArr = node.props.pos
      .split('-')
      .map(g => Number(g))
    let len = dropPosArr.length
    let dropNodePos = dropPosArr[len - 1]

    // let nodePos = Number(dropPosArr[dropPosArr.length - 1])
    // only drag from node to category
    // or change category position
    if (
      (
        !dropToGap &&
        !dragNode.props.isLeaf
      ) ||
      (
        !dropToGap &&
        dragNode.props.isLeaf &&
        node.props.isLeaf
      ) ||
      (
        !dragNode.props.isLeaf &&
        dropPosArr.length > 2
      )
    ) {
      return
    }
    dropPosition = dropPosition > dropNodePos
      ? dropPosition
      : dropPosition + 1
    let targetIndex = dropToGap
      ? dropPosition
      : 0
    let {eventKey} = dragNode.props
    let bookmarkGroups = copy(
      this.props.bookmarkGroups
    )

    let changeCategoryPos = dropPosArr.length === 2
    if (changeCategoryPos && dropToGap) {
      let fromObj = _.find(
        bookmarkGroups,
        d => d.id === eventKey
      )
      if (!fromObj) {
        return
      }
      let oldIndex = _.findIndex(
        bookmarkGroups,
        d => d.id === eventKey
      )
      let tobeDelIndex = oldIndex >= targetIndex
        ? oldIndex + 1
        : oldIndex
      bookmarkGroups.splice(targetIndex, 0, fromObj)
      bookmarkGroups.splice(tobeDelIndex, 1)
    } else {
      let fromObj = _.find(
        bookmarkGroups,
        d => d.bookmarkIds.includes(eventKey)
      )
      let targetObj = bookmarkGroups[dropPosArr[1]]
      if (!targetObj || !fromObj) {
        return
      }
      let oldIndex = _.findIndex(
        fromObj.bookmarkIds,
        d => d === eventKey
      )
      if (targetObj.id === fromObj.id) {
        let tobeDelIndex = oldIndex >= targetIndex
          ? oldIndex + 1
          : oldIndex
        fromObj.bookmarkIds.splice(
          targetIndex,
          0,
          eventKey
        )
        fromObj.bookmarkIds.splice(
          tobeDelIndex,
          1
        )
      } else {
        fromObj.bookmarkIds.splice(
          oldIndex,
          1
        )
        targetObj.bookmarkIds.splice(
          targetIndex,
          0,
          eventKey
        )
      }
    }
    this.props.modifyLs({
      bookmarkGroups
    })
  }

  onSubmit = false
  onSubmitEdit = false

  onChangeBookmarkGroupTitle = e => {
    let {value} = e.target
    if (value.length > maxBookmarkGroupTitleLength) {
      value = value.slice(0, maxBookmarkGroupTitleLength)
    }
    this.setState({
      bookmarkGroupTitle: value
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
      this.props.addBookmarkGroup({
        id: generate(),
        title: this.state.bookmarkGroupTitle,
        bookmarkIds: []
      })
    })
  }

  newBookmarkGroup = () => {
    this.setState({
      showNewBookmarkGroupForm: true,
      bookmarkGroupTitle: ''
    })
  }

  del = (item, e) => {
    e.stopPropagation()
    if (item.bookmarkIds) {
      return this.props.delBookmarkGroup(item)
    }
    this.props.delItem(item, this.props.type)
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
    let [id] = selectedKeys
    if (!node.props.isLeaf) {
      this.props.modifier({
        currentBookmarkGroupId: id
      })
    }
    let {bookmarks} = this.props
    let bookmark = _.find(
      bookmarks,
      d => d.id === id
    )
    if (bookmark) {
      this.props.onClickItem(bookmark)
    }
  }

  renderSearch = () => {
    return (
      <div className="pd1y pd2r">
        <Search
          onChange={this.onChange}
          value={this.state.keyword}
        />
      </div>
    )
  }

  renderDelBtn = item => {
    if (item.id === defaultookmarkGroupId) {
      return null
    }
    return (
      <Popconfirm
        title={e('del') + '?'}
        onConfirm={e => this.del(item, e)}
        okText={e('del')}
        cancelText={c('cancel')}
        placement="top"
      >
        <Icon
          type="close"
          title={e('del')}
          className="pointer list-item-del"
        />
      </Popconfirm>
    )
  }

  editItem = (e, item) => {
    e.stopPropagation()
    this.setState({
      categoryTitle: '' + item.title,
      categoryId: item.id + ''
    })
  }

  renderEditBtn = item => {
    return (
      <Icon
        type="edit"
        title={e('edit')}
        onClick={(e) => this.editItem(e, item)}
        className="pointer list-item-edit"
      />
    )
  }

  editCategory = () => {
    let {
      categoryTitle
    } = this.state
    let confirm = (
      <span>
        <Icon
          type="check"
          className="pointer"
          onClick={this.submitEdit}
        />
        <Icon
          type="close"
          className="mg1l pointer"
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
    let cls = classnames(
      'tree-item elli',
      {
        'is-category': isGroup
      }
    )
    let title = isGroup
      ? item.title
      : createName(item)
    return (
      <div className={cls} key={item.id} title={title}>
        <div className="tree-item-title elli">
          {title}
        </div>
        {
          isGroup
            ? this.renderEditBtn(item)
            : null
        }
        {this.renderDelBtn(item)}
      </div>
    )
  }

  renderChildNodes = bookmarkIds => {
    let bookmarks = this.filter(
      this.props.bookmarks
    )
    let map = bookmarks.reduce((p, b) => {
      return {
        ...p,
        [b.id]: b
      }
    }, {})
    let nodes = bookmarkIds.reduce((prev, id) => {
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

  renderItem = (item) => {
    let {bookmarkIds = []} = item
    return (
      <TreeNode
        key={item.id}
        title={this.renderItemTitle(item, true)}
      >
        {
          bookmarkIds.length
            ? this.renderChildNodes(bookmarkIds)
            : null
        }
      </TreeNode>
    )
  }

  filter = list => {
    let {keyword} = this.state
    return keyword
      ? list.filter(item => {
        return createName(item).toLowerCase().includes(keyword.toLowerCase())
      })
      : list
  }

  renderNewButtons = () => {
    return (
      <div className="pd1b pd2r">
        <Button
          className="mg1r mg1t"
          icon="plus"
          onClick={this.newBookmark}
        >
          {s('new')}{c('bookmarks')}
        </Button>
        <Button
          icon="plus-circle-o"
          className="mg1t"
          onClick={this.newBookmarkGroup}
        >
          {s('new')}{c('bookmarkCategory')}
        </Button>
      </div>
    )
  }

  renderNewBookmarkGroup = () => {
    let {
      bookmarkGroupTitle,
      showNewBookmarkGroupForm
    } = this.state
    if (!showNewBookmarkGroupForm) {
      return null
    }
    let confirm = (
      <span>
        <Icon
          type="check"
          className="pointer"
          onClick={this.submit}
        />
        <Icon
          type="close"
          className="mg1l pointer"
          onClick={this.cancelNew}
        />
      </span>
    )
    return (
      <div className="pd1y">
        <InputAutoFocus
          value={bookmarkGroupTitle}
          onPressEnter={this.submit}
          onChange={this.onChangeBookmarkGroupTitle}
          addonAfter={confirm}
        />
      </div>
    )
  }

  render() {
    let {
      bookmarkGroups,
      type
    } = this.props
    let {expandedKeys, keyword} = this.state
    return (
      <div className={`tree-list item-type-${type}`}>
        {this.renderNewButtons()}
        {this.renderSearch()}
        <div className="item-list-wrap pd2r">
          {this.renderNewBookmarkGroup()}
          <Tree
            onExpand={this.onExpand}
            expandedKeys={expandedKeys}
            autoExpandParent={!!keyword}
            onSelect={this.onSelect}
            draggable
            onDrop={this.onDrop}
          >
            {bookmarkGroups.map(this.renderItem)}
          </Tree>
        </div>
      </div>
    )
  }

}

