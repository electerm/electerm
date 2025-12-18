/**
 * Simple drawer component without animation
 * Replaces antd Drawer for better performance
 */

import classnames from 'classnames'
import './drawer.styl'

export default function Drawer (props) {
  const {
    open,
    placement = 'left',
    size,
    zIndex = 1000,
    className,
    children,
    styles = {},
    onClose
  } = props

  function handleMaskClick (e) {
    if (e.target === e.currentTarget && onClose) {
      onClose()
    }
  }

  if (!open) {
    return null
  }

  const drawerStyle = {
    zIndex
  }

  const contentStyle = {
    width: typeof size === 'number' ? `${size}px` : size,
    ...styles.content
  }

  const cls = classnames(
    'custom-drawer',
    `custom-drawer-${placement}`,
    className
  )

  return (
    <div className={cls} style={drawerStyle}>
      <div
        className='custom-drawer-mask'
        onClick={handleMaskClick}
      />
      <div
        className='custom-drawer-content-wrapper'
        style={contentStyle}
      >
        <div className='custom-drawer-content'>
          {children}
        </div>
      </div>
    </div>
  )
}
