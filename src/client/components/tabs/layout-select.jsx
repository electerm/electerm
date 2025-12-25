/**
 * Layout select content component
 */

import React from 'react'
import {
  SingleIcon,
  TwoColumnsIcon,
  ThreeColumnsIcon,
  TwoRowsIcon,
  ThreeRowsIcon,
  Grid2x2Icon,
  TwoRowsRightIcon,
  TwoColumnsBottomIcon
} from '../icons/split-icons'
import { splitMapDesc } from '../../common/constants'

const e = window.translate

const iconMaps = {
  single: SingleIcon,
  twoColumns: TwoColumnsIcon,
  threeColumns: ThreeColumnsIcon,
  twoRows: TwoRowsIcon,
  threeRows: ThreeRowsIcon,
  grid2x2: Grid2x2Icon,
  twoRowsRight: TwoRowsRightIcon,
  twoColumnsBottom: TwoColumnsBottomIcon
}

export function getLayoutIcon (layout) {
  return iconMaps[layout]
}

export default function LayoutSelect (props) {
  const { layout } = props

  function handleChangeLayout (key) {
    window.store.setLayout(key)
  }

  return (
    <div className='layout-menu-content'>
      {Object.keys(splitMapDesc).map((t) => {
        const v = splitMapDesc[t]
        const Icon = getLayoutIcon(v)
        const isActive = layout === t
        return (
          <div
            key={t}
            className={`layout-menu-item ${isActive ? 'active' : ''}`}
            onClick={() => handleChangeLayout(t)}
          >
            <Icon /> {e(v)}
          </div>
        )
      })}
    </div>
  )
}
