import BookmarksList from '../sidebar/bookmark-select'

export default function BookmarkSubMenu (props) {
  const { store } = props
  return (
    <div className='sub-context-menu bookmarks-sub-context-menu'>
      <BookmarksList
        store={store}
      />
    </div>
  )
}
