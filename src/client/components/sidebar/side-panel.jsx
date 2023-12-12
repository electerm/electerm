import { PureComponent } from 'react'
export default class SidePanel extends PureComponent {
  handleMousedown = (e) => {
    this.dragStart = true
    this.clientX = e.clientX
    window.addEventListener('mouseup', this.handleMouseup)
    window.addEventListener('mousemove', this.handleMousemove)
  }

  handleMouseup = (e) => {
    this.dragStart = false
    const {
      clientX
    } = e
    let nw = clientX - this.clientX + this.props.leftSidebarWidth
    if (nw < 343) {
      nw = 343
    } else if (nw > 600) {
      nw = 600
    }
    this.props.setLeftSidePanelWidth(nw)
    window.removeEventListener('mouseup', this.handleMouseup)
    window.removeEventListener('mousemove', this.handleMousemove)
  }

  handleMousemove = (e) => {
    const {
      clientX
    } = e
    const el = document.getElementById('side-panel')
    let nw = clientX - this.clientX + this.props.leftSidebarWidth
    if (nw < 343) {
      nw = 343
    } else if (nw > 600) {
      nw = 600
    }
    el.style.width = nw + 'px'
    const el1 = document.querySelector('.sessions')
    if (el1) {
      el1.style.marginLeft = (nw + 43) + 'px'
    }
  }

  render () {
    return (
      <div
        {...this.props.sideProps}
        id='side-panel'
        draggable={false}
      >
        <div
          className='drag-handle'
          onMouseDown={this.handleMousedown}
          draggable={false}
        />
        {this.props.children}
      </div>
    )
  }
}
