import { PureComponent } from 'react'
import createTitle from '../../common/create-title'

export default class TabsSubMenuChild extends PureComponent {
  handleClick = () => {
    window.store.changeActiveTabId(this.props.item.id)
    // dismiss the system menu popover after switching
    const { onClose } = this.props
    if (onClose) {
      onClose()
    }
  }

  render () {
    const { item } = this.props
    const title = createTitle(item)
    return (
      <div
        className='sub-context-menu-item'
        title={title}
        key={item.id}
        onClick={this.handleClick}
      >
        {title}
      </div>
    )
  }
}
