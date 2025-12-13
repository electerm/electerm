/**
 * theme list render
 */

import { useState } from 'react'
import {
  CheckCircleOutlined,
  PlusOutlined,
  SunOutlined,
  MoonOutlined,
  EyeOutlined
} from '@ant-design/icons'
import { Tag, Tooltip, Button, Space } from 'antd'
import classnames from 'classnames'
import { defaultTheme } from '../../common/theme-defaults'
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

  const [tooltipVisible, setTooltipVisible] = useState(false)
  const [isPreviewing, setIsPreviewing] = useState(false)

  function handleClickApply () {
    setTooltipVisible(false)
    setIsPreviewing(false)
    delete window.originalTheme
    store.setTheme(item.id)
  }

  function handleClickPreview () {
    if (!isPreviewing) {
      // Store current theme ID before changing
      const currentTheme = window.store.config.theme
      window.originalTheme = currentTheme
      // Apply the preview theme
      store.setTheme(item.id)
      setIsPreviewing(true)
    }
  }

  function handleTooltipVisibleChange (visible) {
    setTooltipVisible(visible)
    if (!visible && isPreviewing) {
      // Restore original theme when tooltip closes during preview
      if (window.originalTheme) {
        store.setTheme(window.originalTheme)
        delete window.originalTheme
      }
      setIsPreviewing(false)
    }
  }

  function renderTooltipContent () {
    return (
      <Space.Compact>
        <Button
          size='small'
          icon={<EyeOutlined />}
          onClick={handleClickPreview}
          type={isPreviewing ? 'primary' : 'default'}
        >
          {e('preview')}
        </Button>
        <Button
          size='small'
          icon={<CheckCircleOutlined />}
          onClick={handleClickApply}
          type='primary'
        >
          {e('apply')}
        </Button>
      </Space.Compact>
    )
  }

  function renderApplyBtn () {
    if (!item.id) {
      return null
    }
    return (
      <Tooltip
        title={renderTooltipContent()}
        trigger='click'
        open={tooltipVisible}
        onOpenChange={handleTooltipVisibleChange}
        placement='top'
      >
        <CheckCircleOutlined
          className='pointer list-item-apply'
        />
      </Tooltip>
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
        className='mg1r'
        variant='solid'
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
  let title = id === defaultTheme().id
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
        id === defaultTheme().id || type === 'iterm'
          ? null
          : props.renderDelBtn(item)
      }
      {renderApplyBtn(item)}
    </div>
  )
}
