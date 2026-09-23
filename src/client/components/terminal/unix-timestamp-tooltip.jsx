/**
 * Global tooltip that detects Unix timestamps in terminal selections
 * and displays their human-readable date/time near the cursor.
 * Clicking the tooltip (or its copy icon) copies the formatted string.
 * Registered via refsStatic as 'unix-timestamp-tooltip'.
 */

import { Component } from 'react'
import { CopyOutlined } from '@ant-design/icons'
import { refsStatic } from '../common/ref'
import { copy } from '../../common/clipboard'

export default class UnixTimestampTooltip extends Component {
  state = {
    visible: false,
    x: 0,
    y: 0,
    text: ''
  }

  _mouseX = 0
  _mouseY = 0

  componentDidMount () {
    refsStatic.add('unix-timestamp-tooltip', this)
    document.addEventListener('mousemove', this.onMouseMove)
  }

  componentWillUnmount () {
    refsStatic.remove('unix-timestamp-tooltip')
    document.removeEventListener('mousemove', this.onMouseMove)
  }

  detectUnixTimestamp (txt) {
    if (!/^\d+$/.test(txt)) return null
    const num = parseInt(txt, 10)
    // seconds: 9-10 digits, year ~2001-2286
    if ((txt.length === 9 || txt.length === 10) && num >= 946684800 && num <= 32503680000) {
      return new Date(num * 1000).toLocaleString()
    }
    // milliseconds: 13 digits
    if (txt.length === 13 && num >= 946684800000 && num <= 32503680000000) {
      return new Date(num).toLocaleString()
    }
    return null
  }

  onMouseMove = (e) => {
    this._mouseX = e.clientX
    this._mouseY = e.clientY
  }

  onSelection = (txt) => {
    const ts = this.detectUnixTimestamp(txt)
    if (ts) {
      this.setState({ visible: true, x: this._mouseX, y: this._mouseY, text: ts })
    } else {
      this.setState({ visible: false })
    }
  }

  handleHide = () => {
    this.setState({ visible: false })
  }

  /**
   * Copy on mousedown instead of click: pressing the tooltip collapses the
   * document selection, and the terminal drops its (DOM backed) selection on
   * that change, which would unmount this tooltip before a click could land.
   * preventDefault also keeps the terminal selection and focus untouched.
   * The whole tooltip is the hit area, the icon is just the affordance.
   */
  handleCopy = (e) => {
    e.preventDefault()
    e.stopPropagation()
    copy(this.state.text)
    this.handleHide()
  }

  render () {
    const { visible, x, y, text } = this.state
    if (!visible) {
      return null
    }
    return (
      <div
        className='unix-timestamp-tooltip pointer'
        title={window.translate('copy')}
        onMouseDown={this.handleCopy}
        onMouseLeave={this.handleHide}
        style={{
          position: 'fixed',
          left: x,
          top: y - 36,
          background: 'rgba(0,0,0,0.75)',
          color: '#fff',
          padding: '3px 8px',
          borderRadius: 4,
          fontSize: 12,
          whiteSpace: 'nowrap',
          transform: 'translateX(-50%)',
          userSelect: 'none',
          zIndex: 9999
        }}
      >
        {text}
        <CopyOutlined style={{ marginLeft: 6 }} />
      </div>
    )
  }
}
