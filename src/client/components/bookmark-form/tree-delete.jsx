import StartSessionSelect from '../setting-panel/start-session-select'
import { Tree } from 'antd'

export class BookmarkTreeDelete extends StartSessionSelect {
  onCheck = (expandedKeys) => {
    window.store.setState(
      'expandedKeys',
      expandedKeys
    )
  }

  onCheck = (checkedKeys) => {
    window.store.setState(
      'checkedKeys',
      checkedKeys
    )
  }

  render () {
    const { store } = this.props
    const rProps = {
      checkable: true,
      autoExpandParent: true,
      onCheck: this.onCheck,
      expandedKeys: store.expandedKeys,
      checkedKeys: store.checkedKeys,
      onExpand: this.onExpand,
      treeData: this.buildData()
    }
    return (
      <Tree {...rProps} />
    )
  }
}
