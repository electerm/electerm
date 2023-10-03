import TreeList from './tree-list'
import BookmarkTreeDelete from '../bookmark-form/tree-delete'

export default function BookmarkTreeList (props) {
  return props.bookmarkSelectMode
    ? (
      <BookmarkTreeDelete
        store={props.store}
      />
      )
    : (
      <TreeList {...props} />
      )
}
