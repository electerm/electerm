import { TreeSelect } from 'antd'
import formatBookmarkGroups from './bookmark-group-tree-format'

const e = window.translate

export default function AICategorySelect ({
  bookmarkGroups = [],
  value,
  onChange,
  disabled = false
}) {
  const tree = formatBookmarkGroups(bookmarkGroups)

  const handleChange = (categoryId) => {
    if (onChange) {
      onChange(categoryId)
    }
  }

  return (
    <div className='pd1b'>
      <label className='iblock mg1r'>{e('bookmarkCategory')}</label>
      <TreeSelect
        value={value}
        treeData={tree}
        treeDefaultExpandAll
        showSearch
        disabled={disabled}
        onChange={handleChange}
        style={{ minWidth: 200 }}
      />
    </div>
  )
}
