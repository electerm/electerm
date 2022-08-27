import { Component } from '../common/react-subx'
import createTitle from '../../common/create-title'

export default class HistorySubMenu extends Component {
  render () {
    const { store } = this.props
    return (
      <div className='sub-context-menu'>
        {
          store.history.map(item => {
            const title = createTitle(item)
            return (
              <div
                className='sub-context-menu-item'
                title={title}
                key={item.id}
                onClick={() => store.onSelectHistory(item.id)}
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
