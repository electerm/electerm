import { Component } from '../common/react-subx'
import BookmarksList from '../sidebar/bookmark-select'

export default class BookmarkSubMenu extends Component {
  render () {
    const { store } = this.props
    return (
      <div className='sub-context-menu bookmarks-sub-context-menu'>
        <BookmarksList
          store={store}
        />
      </div>
    )
  }
}
