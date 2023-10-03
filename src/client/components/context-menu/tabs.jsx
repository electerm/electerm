import { Component } from '../common/react-subx'
import TabsSubMenuChild from './sub-tab-menu'

export default class TabsSubMenu extends Component {
  render () {
    const { store } = this.props
    return (
      <div className='sub-context-menu'>
        {
          store.getTabs().map(item => {
            return (
              <TabsSubMenuChild
                key={item.id}
                item={item}
              />
            )
          })
        }
      </div>
    )
  }
}
