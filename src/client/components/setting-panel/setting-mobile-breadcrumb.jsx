/**
 * breadcrumb shown at the top of the settings content view on mobile.
 * - parent crumb = the active setting tab, clickable, returns to the menu list
 * - current crumb = the selected item name, plain text
 * `onBack` + labels are props so it stays reusable for other panels
 */

import { ArrowLeftOutlined } from '@ant-design/icons'

export default function SettingMobileBreadcrumb (props) {
  const {
    onBack,
    parentLabel,
    currentLabel
  } = props
  return (
    <div className='setting-mobile-back'>
      <button
        className='setting-mobile-back-btn'
        onClick={onBack}
      >
        <ArrowLeftOutlined />
        <span className='setting-mobile-back-parent'>{parentLabel}</span>
      </button>
      <span className='setting-mobile-back-sep'>&gt;</span>
      <span className='setting-mobile-back-current elli'>{currentLabel}</span>
    </div>
  )
}
