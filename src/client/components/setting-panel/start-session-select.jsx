import { TreeSelect } from 'antd'
import { Component } from '../common/react-subx'
import copy from 'json-deep-copy'
import createTitle from '../../common/create-title'

const { prefix } = window
const e = prefix('setting')
const { SHOW_CHILD } = TreeSelect

export default class StartSessionSelect extends Component {
  buildData = () => {
    const cats = this.props.store.getItems('bookmarkGroups')
    const tree = this.props.store.getItems('bookmarks')
      .reduce((p, k) => {
        return {
          ...p,
          [k.id]: k
        }
      }, {})
    const btree = cats
      .reduce((p, k) => {
        return {
          ...p,
          [k.id]: k
        }
      }, {})
    function buildSubCats (id) {
      const x = btree[id]
      if (!x) {
        return ''
      }
      const y = {
        key: x.id,
        value: x.id,
        title: x.title
      }
      if (x.bookmarkIds && x.bookmarkIds.length) {
        y.children = x.bookmarkIds.map(buildLeaf).filter(d => d)
      }
      if (y.children && !y.children.length) {
        delete y.children
      }
      return y
    }
    function buildLeaf (id) {
      const x = tree[id]
      if (!x) {
        return ''
      }
      return {
        value: x.id,
        key: x.id,
        title: createTitle(x)
      }
    }
    const level1 = cats.filter(d => d.level !== 2)
      .map(d => {
        const r = {
          title: d.title,
          value: d.id,
          key: d.id,
          children: [
            ...(d.bookmarkGroupIds || []).map(buildSubCats),
            ...(d.bookmarkIds || []).map(buildLeaf)
          ].filter(d => d)
        }
        if (!r.children.length) {
          return ''
        }
        return r
      }).filter(d => d)
    return level1
  }

  render () {
    const rProps = {
      treeData: this.buildData(),
      value: copy(this.props.onStartSessions || []),
      onChange: this.props.onChangeStartSessions,
      treeCheckable: true,
      showCheckedStrategy: SHOW_CHILD,
      placeholder: e('pleaseSelect'),
      style: {
        width: '100%'
      }
    }
    return (
      <TreeSelect {...rProps} />
    )
  }
}
