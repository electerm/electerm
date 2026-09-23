/**
 * Shared shell for remote desktop sessions (RDP / VNC / SPICE).
 *
 * Layout is a plain flex column:
 *
 *   [ control bar ]   auto height, wraps when the window is narrow
 *   [ viewport    ]   flex: 1, holds the remote surface
 *
 * The control bar owns a real height instead of being positioned over the
 * surface, so the old "- 10 / - 80" guesses are gone and the surface can
 * never be covered by the bar.
 *
 * The viewport is measured with a ResizeObserver rather than derived from
 * the layout props, because in fullscreen the session is re-parented to the
 * whole window by term-fullscreen.styl and those props are stale. Measured
 * size is what lets the remote surface scale up to fill the screen.
 */
import { PureComponent, createRef } from 'react'
import { Spin } from 'antd'
import classnames from 'classnames'
import './remote-session-shell.styl'

export default class RemoteSessionShell extends PureComponent {
  constructor (props) {
    super(props)
    this.viewRef = createRef()
    this.state = {
      width: 0,
      height: 0
    }
  }

  componentDidMount () {
    this.observeViewport()
  }

  componentDidUpdate () {
    // the viewport node is stable, this only re-observes if React swapped it
    this.observeViewport()
  }

  componentWillUnmount () {
    this.unobserveViewport()
  }

  observeViewport = () => {
    const el = this.viewRef.current
    if (!el || this.viewEl === el) {
      return
    }
    this.unobserveViewport()
    this.viewEl = el
    this.observer = new ResizeObserver(this.measureViewport)
    this.observer.observe(el)
    this.measureViewport()
  }

  unobserveViewport = () => {
    if (this.observer) {
      this.observer.disconnect()
      this.observer = null
    }
    this.viewEl = null
  }

  measureViewport = () => {
    const el = this.viewRef.current
    if (!el) {
      return
    }
    const { clientWidth: width, clientHeight: height } = el
    const { width: prevWidth, height: prevHeight } = this.state
    if (width === prevWidth && height === prevHeight) {
      return
    }
    this.setState({
      width,
      height
    })
    this.props.onViewportResize?.(width, height)
  }

  // measured viewport box, 0 until the first layout pass
  getViewportSize = () => {
    const { width, height } = this.state
    return {
      width,
      height
    }
  }

  render () {
    const {
      loading,
      fit,
      wrapClassName,
      controlLeft,
      controlRight,
      floatControl,
      overlay,
      children
    } = this.props
    const cls = classnames(
      'remote-session-wrap',
      'session-v-wrap',
      wrapClassName,
      {
        fit: !!fit
      }
    )
    return (
      <Spin
        spinning={!!loading}
        className='remote-session-spin'
      >
        <div className={cls}>
          <div className='remote-session-control session-v-info'>
            <div className='remote-session-control-left'>
              {controlLeft}
            </div>
            <div className='remote-session-control-right'>
              {controlRight}
            </div>
          </div>
          <div
            className='remote-session-viewport'
            ref={this.viewRef}
          >
            {children}
          </div>
          {overlay}
          {floatControl}
        </div>
      </Spin>
    )
  }
}
