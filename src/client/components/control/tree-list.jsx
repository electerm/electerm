/**
 * tree list for bookmarks
 */

import React from 'react'
import {
  Tooltip,
  Icon,
  Popconfirm,
  Tree,
  message,
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
    bookmarkGroupTitle: ''
  }

  onChange = e => {
    this.setState({
      keyword: e.target.value
    })
  }

  onSubmit = false

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
    // if (item.id === defaultookmarkGroupId) {
    //   return null
    // }
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

  renderItemTitle = (item, isGroup) => {
    let cls = classnames(
      'tree-item elli',
      {
        'is-category': isGroup
      }
    )
    return (
      <div className={cls} key={item.id}>
        <div className="tree-item-title elli">
          {
            isGroup
              ? item.title
              : createName(item)
          }
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
    let {
      bookmarks
    } = this.props
    let map = bookmarks.reduce((p, b) => {
      return {
        ...p,
        [b.id]: b
      }
    }, {})
    let nodes = bookmarkIds.map(id => {
      return map[id]
    }).filter(d => d)
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
    // let {onClickItem, type, activeItemId} = this.props
    // let {id} = item
    // let title = createName(item)
    // let cls = classnames(
    //   'item-list-unit',
    //   {
    //     active: activeItemId === id
    //   }
    // )
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
    // return (
    //   <div
    //     key={i + '__' + id}
    //     className={cls}
    //     onClick={() => onClickItem(item, type)}
    //   >
    //     <Tooltip
    //       title={title}
    //       placement="right"
    //     >
    //       <div className="elli pd1y pd2x">{title || s('new')}</div>
    //     </Tooltip>
    //     {this.renderDelBtn(item)}
    //   </div>
    // )
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
          {s('new')}
        </Button>
        <Button
          icon="plus-circle-o"
          className="mg1t"
          onClick={this.newBookmarkGroup}
        >
          {s('new')} {c('bookmarkCategory')}
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
      <Icon
        type="check"
        onClick={this.submit}
      />
    )
    return (
      <div className="pd1y">
        <InputAutoFocus
          value={bookmarkGroupTitle}
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
          >
            {bookmarkGroups.map(this.renderItem)}
          </Tree>
        </div>
      </div>
    )
  }

}

