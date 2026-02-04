import TreeList from '../tree-list/tree-list'
import BookmarkTreeSelect from '../bookmark-form/tree-select'

export default function BookmarkTreeList (props) {
  return props.bookmarkSelectMode
    ? (
      <BookmarkTreeSelect
        {...props}
      />
      )
    : (
      <TreeList {...props} />
      )
}
