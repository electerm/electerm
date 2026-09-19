/**
 * theme list render
 */

import { useEffect, useState } from 'react'
import {
  CheckCircleOutlined,
  CloseOutlined,
  PlusOutlined,
  SunOutlined,
  MoonOutlined
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

  function startPreview () {
    // keep the very first original, hopping between themes must never
    // overwrite it with a theme that is itself only a preview
    if (!window.originalTheme) {
      window.originalTheme = store.config.theme
    }
    store.setTheme(item.id)
    setIsPreviewing(true)
  }

  function cancelPreview () {
    if (window.originalTheme) {
      store.setTheme(window.originalTheme)
      delete window.originalTheme
    }
    setIsPreviewing(false)
  }

  useEffect(() => {
    return () => {
      // leaving the list mid preview (switching settings tab, filtering the
      // list, ...) must not leave the user stuck on a theme never applied
      if (window.originalTheme) {
        store.setTheme(window.originalTheme)
        delete window.originalTheme
      }
    }
  }, [])

  function handleClickApply () {
    delete window.originalTheme
    setIsPreviewing(false)
    setTooltipVisible(false)
    store.setTheme(item.id)
  }

  function handleClickCancel () {
    cancelPreview()
    setTooltipVisible(false)
  }

  function handleTooltipVisibleChange (visible) {
    setTooltipVisible(visible)
    // opening the popup is the preview itself; every other way of closing it
    // (click elsewhere, esc, clicking the icon again) rolls the preview back
    if (visible) {
      startPreview()
    } else {
      cancelPreview()
    }
  }

  function handleClickApplyIcon (e) {
    // previewing must not also load the theme into the edit form
    e.stopPropagation()
  }

  function renderTooltipContent () {
    return (
      <Space.Compact>
        <Button
          size='small'
          icon={<CloseOutlined />}
          onClick={handleClickCancel}
        >
          {e('cancel')}
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
          className={
            classnames(
              'pointer list-item-apply',
              {
                'list-item-apply-previewing': isPreviewing
              }
            )
          }
          onClick={handleClickApplyIcon}
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
