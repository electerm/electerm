import React from 'react'
import PropTypes from 'prop-types'
import './context-menu.styl'

export default class ContextMenu extends React.Component {

  static propTypes = {
    content: PropTypes.element.isRequired,
    visible: PropTypes.bool,
    position: PropTypes.object,
    className: PropTypes.string
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

  render () {
    let {visible, pos, content, className} = this.props
    let cls = `${className} ${visible ? 'show' : 'hide'}`

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
