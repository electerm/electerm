/**
 * two column layout, left column fixed width, right column auto width.
 * the DOM is identical on desktop and mobile — which part is visible is
 * pure CSS driven by the 800px media query in setting-wrap.styl (not the
 * global `.is-mobile` class, which matches a different breakpoint), so a
 * resize across the breakpoint never remounts the forms:
 * - desktop (>800px): both columns side by side, breadcrumb hidden
 * - mobile menu view (`setting-view-menu`): left menu fills the panel
 * - mobile content view (`setting-view-content`): breadcrumb on top
 *   (click it to go back to the menu) + right content scrolls below
 */

import { auto } from 'manate/react'
import Placeholder from '../common/placeholder'
import SettingMobileBreadcrumb from './setting-mobile-breadcrumb'

const e = window.translate

function SettingCol (props) {
  const store = window.store
  const {
    title,
    name
  } = store.settingItem
  const label = title || name || e('new')
  const viewCls = store.settingMobileView === 'content'
    ? 'setting-view-content'
    : 'setting-view-menu'
  return (
    <div className={`setting-col ${viewCls}`}>
      <SettingMobileBreadcrumb
        onBack={() => store.backToSettingMenu()}
        parentLabel={e(store.settingTab)}
        currentLabel={label}
      />
      <div className='setting-row setting-row-left'>
        {props.children[0]}
      </div>
      <div className='setting-row setting-row-right'>
        <div className='setting-col-content'>
          {props.children[1]}
        </div>
        <div className='setting-col-placeholder'>
          <Placeholder />
        </div>
      </div>
    </div>
  )
}

export default auto(SettingCol)
