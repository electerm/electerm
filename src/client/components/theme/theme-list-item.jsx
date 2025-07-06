/**
 * theme list render
 */

import {
  CheckCircleOutlined,
  PlusOutlined,
  SunOutlined,
  MoonOutlined
} from '@ant-design/icons'
import { Tag } from 'antd'
import classnames from 'classnames'
import { defaultTheme } from '../../common/constants'
import highlight from '../common/highlight'
import isColorDark from '../../common/is-color-dark'

const e = window.translate

export default function ThemeListItem (props) {
  const {
    item,
    activeItemId,
    theme,
    keyword
  } = props
  const { store } = window

  function handleClickApply () {
    delete window.originalTheme
    store.setTheme(item.id)
  }

  function handleMouseEnter () {
    // Store current theme ID before changing
    const currentTheme = window.store.config.theme
    window.originalTheme = currentTheme
    // Apply the hovered theme
    store.setTheme(item.id)
  }

  function handleMouseLeave () {
    if (!window.originalTheme) return
    // Restore the original theme
    store.setTheme(window.originalTheme)
    // Clean up
    delete window.originalTheme
  }

  function renderApplyBtn () {
    if (!item.id) {
      return null
    }
    return (
      <CheckCircleOutlined
        className='pointer list-item-apply'
        onClick={handleClickApply}
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
      />
    )
  }

  function handleClickTheme () {
    props.onClickItem(item)
  }

  function renderTag () {
    if (!id) {
      return null
    }
    const { main, text } = item.uiThemeConfig
    const isDark = isColorDark(main)
    const txt = isDark ? <MoonOutlined /> : <SunOutlined />
    return (
      <Tag
        color={main}
        className='mg1l'
        style={
          {
            color: text
          }
        }
      >
        {txt}
      </Tag>
    )
  }

  const { name, id, type } = item
  const cls = classnames(
    'item-list-unit theme-item',
    {
      current: theme === id
    },
    {
      active: activeItemId === id
    }
  )
  let title = id === defaultTheme.id
    ? e(id)
    : name
  title = highlight(
    title,
    keyword
  )

  return (
    <div
      className={cls}
      onClick={handleClickTheme}
    >
      <div className='elli pd1y pd2x' title={name}>
        {
          !id
            ? <PlusOutlined className='mg1r' />
            : null
        }
        {renderTag()}{title}
      </div>
      {
        id === defaultTheme.id || type === 'iterm'
          ? null
          : props.renderDelBtn(item)
      }
      {renderApplyBtn(item)}
    </div>
  )
}
