/**
 * animate text when text change
 */

import React from 'react'
import uid from '../../common/uid'
import './animate-text.styl'

export default class AnimateText extends React.PureComponent {
  constructor (props) {
    super(props)
    this.uid = 'AnimateText-' + uid()
  }

  componentDidUpdate () {
    const dom = document.getElementById(this.uid)
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
      <div className={className} id={this.uid}>
        {children}
      </div>
    )
  }
}
