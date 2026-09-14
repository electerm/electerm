/**
 * antd Tabs wrapper that collapses to a single tab selector when narrow.
 *
 * A row of tabs is the first thing to break down on a phone: antd keeps them
 * on one line and hides the overflow behind its own dropdown, so the active
 * tab ends up buried. On mobile this wrapper renders only the active tab with
 * a down arrow on the right instead — click it to pick another tab from a
 * dropdown.
 *
 * - desktop: every prop is forwarded to antd Tabs untouched, so it is a
 *   drop-in replacement (`items` / `activeKey` / `onChange` / `type` / `size`
 *   / `destroyOnHidden` ... all behave as before)
 * - mobile: renders the active tab only; the tabs come from the same `items`
 *   array, so callers don't have to describe their tabs twice. The caller's
 *   `className` goes on the wrapper element (the button carries the
 *   `responsive-tabs-mobile` class), so a class like `.setting-tabs` keeps
 *   positioning the selector exactly where it positioned the tab bar.
 *
 * Which breakpoint counts as mobile is decided by the caller via `isMobile`
 * (the setting panel collapses at its own 800px drill-down breakpoint, the
 * theme form at the global 600px one). When omitted it follows the global
 * `store.isMobile`.
 */

import { auto } from 'manate/react'
import { Dropdown, Tabs } from 'antd'
import { DownOutlined } from '@ant-design/icons'
import classNames from 'classnames'
import './responsive-tabs.styl'

export default auto(function ResponsiveTabs (props) {
  const {
    isMobile,
    items = [],
    activeKey,
    onChange,
    className,
    ...rest
  } = props
  const mobile = isMobile === undefined
    ? window.store.isMobile
    : isMobile
  if (!mobile) {
    return (
      <Tabs
        {...rest}
        className={className}
        items={items}
        activeKey={activeKey}
        onChange={onChange}
      />
    )
  }
  const current = items.find(item => item.key === activeKey) || items[0]
  if (!current) {
    return null
  }
  // item level onClick, same as the session tabs dropdown (tabs/index.jsx):
  // it fires with the item's own key and keeps onChange single argument
  const menu = {
    selectable: true,
    selectedKeys: [String(activeKey)],
    items: items.map(item => {
      return {
        key: item.key,
        label: item.label,
        disabled: item.disabled,
        onClick: () => onChange && onChange(item.key)
      }
    })
  }
  return (
    <div className={classNames('responsive-tabs-mobile-wrap', className)}>
      <Dropdown
        menu={menu}
        trigger={['click']}
        placement='bottomLeft'
      >
        <button
          type='button'
          className='responsive-tabs-mobile'
        >
          <span className='responsive-tabs-mobile-label elli'>{current.label}</span>
          <DownOutlined className='responsive-tabs-mobile-icon' />
        </button>
      </Dropdown>
    </div>
  )
})
