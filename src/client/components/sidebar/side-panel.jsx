import { PureComponent } from 'react'
export default class SidePanel extends PureComponent {
  handleMousedown = (e) => {
    this.dragStart = true
    this.clientX = e.clientX
    document.body.addEventListener('mouseup', this.handleMouseup)
    document.body.addEventListener('mousemove', this.handleMousemove)
  }

  handleMouseup = (e) => {
    this.dragStart = false
    const {
      clientX
    } = e
    let nw = clientX - this.clientX + 300
    if (nw < 343) {
      nw = 343
    } else if (nw > 600) {
      nw = 600
    }
    this.props.setLeftSidePanelWidth(nw)
    document.body.removeEventListener('mouseup', this.handleMouseup)
    document.body.removeEventListener('mousemove', this.handleMousemove)
  }

  handleMousemove = (e) => {
    const {
      clientX
    } = e
    const el = document.getElementById('side-panel')
    const nw = clientX - this.clientX + this.props.leftSidebarWidth
    el.style.width = nw + 'px'
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
