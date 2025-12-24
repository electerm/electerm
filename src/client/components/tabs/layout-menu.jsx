/**
 * Layout menu dropdown component
 */

import React from 'react'
import { Dropdown } from 'antd'
import { DownOutlined } from '@ant-design/icons'
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

function getLayoutIcon (layout) {
  return iconMaps[layout]
}

export default function LayoutMenu (props) {
  const { layout, visible } = props

  if (!visible) {
    return null
  }

  function handleChangeLayout ({ key }) {
    window.store.setLayout(key)
  }

  const items = Object.keys(splitMapDesc).map((t) => {
    const v = splitMapDesc[t]
    const Icon = getLayoutIcon(v)
    return {
      key: t,
      label: (
        <span>
          <Icon /> {e(v)}
        </span>
      ),
      onClick: () => handleChangeLayout({ key: t })
    }
  })

  const v = splitMapDesc[layout]
  const Icon = getLayoutIcon(v)

  return (
    <Dropdown
      menu={{ items }}
      placement='bottomRight'
    >
      <span className='tabs-dd-icon layout-dd-icon mg1l'>
        <Icon /> <DownOutlined />
      </span>
    </Dropdown>
  )
}
