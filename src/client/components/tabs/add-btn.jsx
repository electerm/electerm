/**
 * Add button component for tabs
 */

import React, { Component } from 'react'
import { createPortal } from 'react-dom'
import {
  PlusOutlined
} from '@ant-design/icons'
import AddBtnMenu from './add-btn-menu'
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
    this.portalContainer = null
  }

  getPortalContainer = () => {
    if (!this.portalContainer) {
      this.portalContainer = document.createElement('div')
      this.portalContainer.className = 'add-btn-menu-portal'
      document.body.appendChild(this.portalContainer)
    }
    return this.portalContainer
  }

  componentWillUnmount () {
    if (this.state.open) {
      document.removeEventListener('click', this.handleDocumentClick)
    }
    // Clean up portal container
    if (this.portalContainer) {
      document.body.removeChild(this.portalContainer)
      this.portalContainer = null
    }
  }

  componentDidUpdate (prevProps, prevState) {
    // Attach or detach document click listener only when menu open state changes
    if (this.state.open && !prevState.open) {
      document.addEventListener('click', this.handleDocumentClick)
    } else if (!this.state.open && prevState.open) {
      document.removeEventListener('click', this.handleDocumentClick)
    }
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
    const { menuPosition, menuTop, menuLeft } = this.state
    const addBtnMenuProps = {
      menuRef: this.menuRef,
      menuPosition,
      menuTop,
      menuLeft,
      onMenuScroll: this.handleMenuScroll,
      onTabAdd: this.handleTabAdd,
      batch: this.props.batch,
      addPanelWidth: this.props.addPanelWidth,
      setAddPanelWidth: window.store.setAddPanelWidth
    }

    return (
      <AddBtnMenu
        {...addBtnMenuProps}
      />
    )
  }

  handleAddBtnClick = () => {
    if (this.state.open) {
      this.setState({ open: false })
    } else {
      // Calculate menu position and open the menu
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

        window.openTabBatch = this.props.batch
      }
    }
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
          onClick={this.handleAddBtnClick}
          ref={this.addBtnRef}
        />
        {open && createPortal(this.renderMenus(), this.getPortalContainer())}
      </>
    )
  }
}
