/**
 * context menu
 */
import React from 'react'
import ReactDOM from 'react-dom'
import PropTypes from 'prop-types'
import './context-menu.styl'
import findParent from '../../common/find-parent'

export default class ContextMenu extends React.PureComponent {
  static propTypes = {
    content: PropTypes.element.isRequired,
    visible: PropTypes.bool,
    pos: PropTypes.object,
    className: PropTypes.string,
    closeContextMenu: PropTypes.func
  }

  static defaultProps = {
    content: <div />,
    visible: false,
    pos: {
      left: 0,
      top: 0
    },
    className: 'context-menu'
  }

  componentDidMount () {
    ReactDOM.findDOMNode(this)
      .addEventListener('click', e => {
        const { target } = e
        const p = findParent(target, '.context-item')
        if (
          p &&
          !p.classList.contains('no-auto-close-context') &&
          !p.classList.contains('disabled')
        ) {
          this.props.closeContextMenu()
        }
      })
    window.addEventListener('message', e => {
      if (e.data && e.data.type && e.data.type === 'close-context-menu') {
        this.props.closeContextMenu()
      }
    })
  }

  render () {
    const { visible, pos, content, className } = this.props
    const cls = `${className} ${visible ? 'show' : 'hide'}`

    return (
      <div
        className={cls}
        style={pos}
      >
        {content}
      </div>
    )
  }
}
