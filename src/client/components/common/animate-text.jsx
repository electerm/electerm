/**
 * animate text when text change
 */

import React from 'react'
import './animate-text.styl'

export default class AnimateText extends React.PureComponent {
  constructor (props) {
    super(props)
    this.textRef = React.createRef()
  }

  componentDidUpdate () {
    const dom = this.textRef.current
    dom.className = (this.props.className || 'animate-text-wrap') + ' animated bounceIn'
    this.timer = setTimeout(() => {
      if (dom) {
        dom.className = this.props.className || 'animate-text-wrap'
      }
    }, 450)
  }

  componentWillUnmount () {
    clearTimeout(this.timer)
  }

  render () {
    const { children, className } = this.props
    return (
      <div className={className} ref={this.textRef}>
        {children}
      </div>
    )
  }
}
