/**
 * context menu
 */
import {Component} from 'react-subx'
import ReactDOM from 'react-dom'
import './context-menu.styl'
import findParent from '../../common/find-parent'

export default class ContextMenu extends Component {

  componentDidMount() {
    ReactDOM.findDOMNode(this)
      .addEventListener('click', e => {
        let {target} = e
        let p = findParent(target, '.context-item')
        if (
          p &&
          !p.classList.contains('no-auto-close-context')
        ) {
          this.props.store.closeContextMenu()
        }
      })
    window.addEventListener('message', e => {
      if (e.data && e.data.type && e.data.type === 'close-context-menu') {
        this.props.store.closeContextMenu()
      }
    })
  }

  render () {
    let {
      contextMenuVisible = false,
      contextMenuProps: {
        pos = {
          left: 0,
          top: 0
        },
        contentRender = () => null,
        className = 'context-menu'
      }
    } = this.props.store
    let cls = `${className} ${contextMenuVisible ? 'show' : 'hide'}`
    return (
      <div
        className={cls}
        style={pos}
      >
        {contentRender()}
      </div>
    )
  }

}
