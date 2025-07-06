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
import {
  splitMapDesc
} from '../../common/constants'

const e = window.translate

export default function LayoutChanger (props) {
  const getLayoutIcon = (layout) => {
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
    return iconMaps[layout]
  }

  const handleChangeLayout = ({ key }) => {
    window.store.setLayout(key)
  }

  const items = Object.keys(splitMapDesc).map((t) => {
    const v = splitMapDesc[t]
    const Icon = getLayoutIcon(v)
    return (
      <div
        key={t}
        className='sub-context-menu-item'
        onClick={() => handleChangeLayout({ key: t })}
      >
        <span>
          <Icon /> {e(v)}
        </span>
      </div>
    )
  })

  return (
    <div className='sub-context-menu bookmarks-sub-context-menu'>
      {items}
    </div>
  )
}
