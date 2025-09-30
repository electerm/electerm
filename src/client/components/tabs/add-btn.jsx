/**
 * Add button component for tabs
 */

import React, { Component } from 'react'
import {
  CodeFilled,
  PlusOutlined,
  RightSquareFilled
} from '@ant-design/icons'
import BookmarksList from '../sidebar/bookmark-select'
import classNames from 'classnames'
import hasActiveInput from '../../common/has-active-input'
import './add-btn.styl'

const e = window.translate

export default class AddBtn extends Component {
  constructor (props) {
    super(props)
    this.state = {
      open: false,
      menuPosition: 'right',
      menuTop: 0,
      menuLeft: 0
    }
    this.addBtnRef = React.createRef()
    this.menuRef = React.createRef()
    this.hideTimeout = null
  }

  componentDidMount () {
    document.addEventListener('click', this.handleDocumentClick)
    // Listen for dropdown events to prevent menu closing
    document.addEventListener('ant-dropdown-show', this.handleDropdownShow)
    document.addEventListener('ant-dropdown-hide', this.handleDropdownHide)
  }

  componentWillUnmount () {
    document.removeEventListener('click', this.handleDocumentClick)
    document.removeEventListener('ant-dropdown-show', this.handleDropdownShow)
    document.removeEventListener('ant-dropdown-hide', this.handleDropdownHide)
    if (this.hideTimeout) {
      clearTimeout(this.hideTimeout)
    }
  }

  handleDropdownShow = () => {
    // Cancel any pending hide timeout when dropdown shows
    if (this.hideTimeout) {
      clearTimeout(this.hideTimeout)
      this.hideTimeout = null
    }
  }

  handleDropdownHide = () => {
    // Small delay after dropdown hides before allowing menu to close
    // This prevents flicker when dropdown closes
  }

  handleDocumentClick = (e) => {
    // Don't close menu when clicking inside menu or add button
    if (this.menuRef.current && this.menuRef.current.contains(e.target)) {
      return
    }
    if (this.addBtnRef.current && this.addBtnRef.current.contains(e.target)) {
      return
    }

    // Don't close if clicking on dropdown or active input elements
    if (hasActiveInput()) {
      return
    }

    this.setState({ open: false })
  }

  handleMouseEnter = () => {
    if (this.hideTimeout) {
      clearTimeout(this.hideTimeout)
      this.hideTimeout = null
    }

    // Calculate menu position
    if (this.addBtnRef.current) {
      const rect = this.addBtnRef.current.getBoundingClientRect()
      const windowWidth = window.innerWidth
      const windowHeight = window.innerHeight

      // Estimate menu width and height
      const estimatedMenuWidth = Math.min(300, windowWidth - 40) // Responsive width
      const estimatedMenuHeight = 400 // Rough estimate

      // Calculate fixed position coordinates
      let menuTop = rect.bottom + 4 // 4px margin
      let menuLeft = rect.left
      let menuPosition = 'right'

      // Check if menu would overflow bottom of screen
      if (menuTop + estimatedMenuHeight > windowHeight - 20) {
        menuTop = rect.top - estimatedMenuHeight - 4 // Show above button
      }

      // If aligning right would cause overflow, align left instead
      if (rect.left + estimatedMenuWidth > windowWidth - 20) {
        menuPosition = 'left'
        menuLeft = rect.right - estimatedMenuWidth
      }

      // If aligning left would cause overflow (negative position), force right
      if (menuLeft < 20) {
        menuPosition = 'right'
        menuLeft = Math.max(20, rect.left) // Ensure at least 20px from edge
      }

      // Final check to ensure menu doesn't go off screen
      if (menuLeft + estimatedMenuWidth > windowWidth - 20) {
        menuLeft = windowWidth - estimatedMenuWidth - 20
      }

      this.setState({
        open: true,
        menuPosition,
        menuTop,
        menuLeft
      })

      if (!this.state.open) {
        window.openTabBatch = this.props.batch
      }
    }
  }

  handleMouseLeave = () => {
    this.hideTimeout = setTimeout(() => {
      this.setState({ open: false })
    }, 200)
  }

  handleMenuMouseEnter = () => {
    if (this.hideTimeout) {
      clearTimeout(this.hideTimeout)
      this.hideTimeout = null
    }
  }

  handleMenuMouseLeave = () => {
    // Don't close if there's an active input or dropdown
    if (hasActiveInput()) {
      return
    }

    this.hideTimeout = setTimeout(() => {
      this.setState({ open: false })
    }, 200)
  }

  handleMenuScroll = (e) => {
    // Prevent scroll events from bubbling up
    e.stopPropagation()
  }

  handleTabAdd = () => {
    if (!window.store.hasNodePty) {
      window.store.onNewSsh()
      return
    }
    window.store.addTab(
      undefined, undefined,
      this.props.batch
    )
  }

  renderMenus = () => {
    const { onNewSsh } = window.store
    const cls = 'pd2x pd1y context-item pointer'
    const addTabBtn = window.store.hasNodePty
      ? (
        <div
          className={cls}
          onClick={this.handleTabAdd}
        >
          <RightSquareFilled /> {e('newTab')}
        </div>
        )
      : null

    const { menuPosition, menuTop, menuLeft } = this.state

    return (
      <div
        ref={this.menuRef}
        className={`add-menu-wrap add-menu-${menuPosition}`}
        style={{
          maxHeight: window.innerHeight - 200,
          top: menuTop,
          left: menuLeft
        }}
        onMouseEnter={this.handleMenuMouseEnter}
        onMouseLeave={this.handleMenuMouseLeave}
        onScroll={this.handleMenuScroll}
      >
        <div
          className={cls}
          onClick={onNewSsh}
        >
          <CodeFilled /> {e('newBookmark')}
        </div>
        {addTabBtn}
        <BookmarksList
          store={window.store}
        />
      </div>
    )
  }

  render () {
    const { empty, className } = this.props
    const { open } = this.state
    const cls = classNames(
      'tabs-add-btn pointer',
      className,
      {
        empty
      }
    )

    return (
      <>
        <PlusOutlined
          title={e('openNewTerm')}
          className={cls}
          onClick={this.handleTabAdd}
          onMouseEnter={this.handleMouseEnter}
          onMouseLeave={this.handleMouseLeave}
          ref={this.addBtnRef}
        />
        {open && this.renderMenus()}
      </>
    )
  }
}
