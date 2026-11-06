/**
 * Appearance control of a bookmark and of a bookmark group: one trigger, two
 * tabs (colour / icon).
 *
 * The icon and the colour are two ways of drawing the same thing, the icon
 * taking precedence, so they live behind a single button instead of two
 * side-by-side ones. The tab the user picked last is remembered in
 * localStorage: whoever sets icons for a list of bookmarks stays on "icon"
 * until they go back to colours.
 *
 * Controlled on purpose: the bookmark form binds it through color-picker-item
 * (antd Form), the bookmark group editor through its own component state.
 */

import { useState } from 'react'
import { Modal, Popover, Tabs } from 'antd'
import { ColorPicker } from '../bookmark-form/common/color-picker.jsx'
import IconPicker from './icon-picker.jsx'
import ItemIcon from './item-icon.jsx'
import { getItem, setItem } from '../../common/safe-local-storage.js'
import { normalizeIcon } from '../../common/icon-value'
import './appearance-picker.styl'

const e = window.translate

export const appearancePickerTabKey = 'appearance-picker-tab'
const tabs = ['color', 'icon']

function readTab () {
  const saved = getItem(appearancePickerTabKey)
  return tabs.includes(saved) ? saved : 'color'
}

export default function AppearancePicker ({
  color,
  icon,
  onColorChange,
  onIconChange,
  disabled
}) {
  const [open, setOpen] = useState(false)
  const [modal, setModal] = useState(false)
  const [tab, setTab] = useState(readTab)
  const current = normalizeIcon(icon)

  const openPicker = () => {
    if (open) {
      // the popover toggles itself closed, do not fight it
      return
    }
    // another window, or the same user in another tab, may have changed it
    setTab(readTab())
    setModal(Boolean(window.store && window.store.isMobile))
    setOpen(true)
  }

  const changeTab = key => {
    setTab(key)
    setItem(appearancePickerTabKey, key)
  }

  // A 392px popover anchored to an 18px button falls off a phone screen, and
  // antd does not shift it back: on a narrow screen the panel is a dialog.
  const panel = (
    <div className='appearance-picker-panel'>
      <Tabs
        size='small'
        activeKey={tab}
        onChange={changeTab}
        items={[
          {
            key: 'color',
            label: e('color'),
            children: (
              <ColorPicker
                inline
                value={color}
                onChange={onColorChange}
              />
            )
          },
          {
            key: 'icon',
            label: e('icon'),
            children: (
              <IconPicker
                icon={current}
                onChange={onIconChange}
              />
            )
          }
        ]}
      />
    </div>
  )

  const trigger = (
    <span
      role='button'
      tabIndex={disabled ? -1 : 0}
      aria-label={e('editWithColorPicker')}
      aria-disabled={disabled || undefined}
      title={e('editWithColorPicker')}
      className={
        disabled
          ? 'appearance-picker-trigger is-disabled'
          : 'appearance-picker-trigger'
      }
      onClick={disabled ? undefined : openPicker}
      onKeyDown={ev => {
        if (disabled) {
          return
        }
        // a span is not activated by Enter/Space on its own, and the popover
        // only handles Escape while focus is inside it
        if (ev.key === 'Escape' && open) {
          ev.preventDefault()
          setOpen(false)
          return
        }
        if (ev.key === 'Enter' || ev.key === ' ') {
          ev.preventDefault()
          openPicker()
        }
      }}
    >
      <ItemIcon icon={current} color={color} size={16} />
    </span>
  )

  if (disabled) {
    return trigger
  }

  if (modal) {
    return (
      <>
        {trigger}
        <Modal
          open={open}
          footer={null}
          centered
          destroyOnHidden
          onCancel={() => setOpen(false)}
        >
          {panel}
        </Modal>
      </>
    )
  }

  return (
    <Popover
      content={panel}
      trigger='click'
      open={open}
      placement='bottomLeft'
      onOpenChange={setOpen}
      destroyOnHidden
    >
      {trigger}
    </Popover>
  )
}
