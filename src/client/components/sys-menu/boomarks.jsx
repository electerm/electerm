import BookmarksList from '../sidebar/bookmark-select'

export default function BookmarkSubMenu (props) {
  return (
    <div className='sub-context-menu bookmarks-sub-context-menu'>
      <BookmarksList
        store={window.store}
        onClose={props.onClose}
      />
    </div>
  )
}
