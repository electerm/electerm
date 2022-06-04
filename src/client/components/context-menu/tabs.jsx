import { Component } from 'react-subx'
import createTitle from '../../common/create-title'

export default class TabsSubMenu extends Component {
  render () {
    const { store } = this.props
    return (
      <div className='sub-context-menu'>
        {
          store.getTabs().map(item => {
            const title = createTitle(item)
            return (
              <div
                className='sub-context-menu-item'
                title={title}
                key={item.id}
                onClick={() => store.onChangeTabId(item.id)}
              >
                {title}
              </div>
            )
          })
        }
      </div>
    )
  }
}
