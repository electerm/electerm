import React, { useId, useState } from 'react'
import { Alert, Button, Form, Input, Popover, Space, Tabs } from 'antd'
import { ColorPicker } from './color-picker.jsx'
import BookmarkIcon from '../../common/bookmark-icon.jsx'
import { getBookmarkIconUrl } from '../../../common/bookmark-icon-url.js'
import './bookmark-appearance.styl'

const FormItem = Form.Item

function labels () {
  const language = window.store?.config.language || window.initLanguage || 'en_us'
  if (language.toLowerCase().startsWith('zh')) {
    return {
      appearance: '颜色与图标',
      color: '颜色',
      icon: '图标',
      url: 'HTTPS 图标地址',
      hint: '粘贴可直接访问的 HTTPS 图片地址，支持 SVG。',
      invalid: '请输入有效的 HTTPS 图片地址。',
      failed: '图标加载失败，将显示原来的颜色。',
      apply: '使用图标',
      clear: '恢复色块',
      preview: '预览'
    }
  }
  return {
    appearance: 'Color and icon',
    color: 'Color',
    icon: 'Icon',
    url: 'HTTPS icon URL',
    hint: 'Paste a direct HTTPS image URL. SVG is supported.',
    invalid: 'Enter a valid HTTPS image URL.',
    failed: 'Could not load the icon. The original color will be used.',
    apply: 'Use icon',
    clear: 'Use color',
    preview: 'Preview'
  }
}

export function ColorPickerItem () {
  const form = Form.useFormInstance()
  const color = Form.useWatch('color', form)
  const iconUrl = Form.useWatch('iconUrl', form)
  const [open, setOpen] = useState(false)
  const [draft, setDraft] = useState('')
  const [failed, setFailed] = useState(false)
  const [activeKey, setActiveKey] = useState('color')
  const [pickerSession, setPickerSession] = useState(0)
  const iconInputId = useId()
  const text = labels()
  const previewUrl = getBookmarkIconUrl(draft)
  const invalid = Boolean(draft.trim() && !previewUrl)

  function changeOpen (visible) {
    if (visible) {
      setDraft(typeof iconUrl === 'string' ? iconUrl : '')
      setFailed(false)
      setActiveKey(iconUrl ? 'icon' : 'color')
      // Reset previews even if reopened before the closing animation ends.
      setPickerSession(value => value + 1)
    }
    setOpen(visible)
  }

  function applyIcon () {
    if (!previewUrl) return
    form.setFieldsValue({ iconUrl: previewUrl })
    setOpen(false)
  }

  function clearIcon () {
    form.setFieldsValue({ iconUrl: '' })
    setDraft('')
    setFailed(false)
    setOpen(false)
  }

  const content = (
    <div className='bookmark-appearance' key={pickerSession}>
      <Tabs
        activeKey={activeKey}
        onChange={setActiveKey}
        items={[
          {
            key: 'color',
            label: text.color,
            children: (
              <ColorPicker
                inline
                value={color}
                onChange={value => {
                  form.setFieldsValue({ color: value, iconUrl: '' })
                  setOpen(false)
                }}
              />
            )
          },
          {
            key: 'icon',
            label: text.icon,
            children: (
              <Space orientation='vertical' className='bookmark-icon-editor'>
                <label htmlFor={iconInputId}>
                  {text.url}
                </label>
                <Input
                  id={iconInputId}
                  aria-label={text.url}
                  value={draft}
                  placeholder='https://example.com/icon.svg'
                  status={invalid ? 'error' : undefined}
                  allowClear
                  onChange={event => {
                    setDraft(event.target.value)
                    setFailed(false)
                  }}
                  onPressEnter={event => {
                    event.preventDefault()
                    applyIcon()
                  }}
                />
                <div className='bookmark-icon-hint'>{text.hint}</div>
                {invalid && <Alert type='error' title={text.invalid} />}
                <div className='bookmark-icon-preview'>
                  <span>{text.preview}</span>
                  <BookmarkIcon
                    key={draft}
                    iconUrl={previewUrl}
                    color={color}
                    onError={() => setFailed(true)}
                    onLoad={() => setFailed(false)}
                  />
                </div>
                {failed && <Alert type='warning' title={text.failed} />}
                <Space>
                  <Button type='primary' disabled={!previewUrl} onClick={applyIcon}>{text.apply}</Button>
                  <Button onClick={clearIcon}>{text.clear}</Button>
                </Space>
              </Space>
            )
          }
        ]}
      />
    </div>
  )

  return (
    <>
      {/* Register both fields even before the popover is opened. */}
      <FormItem name='color' noStyle><Input type='hidden' /></FormItem>
      <FormItem name='iconUrl' noStyle><Input type='hidden' /></FormItem>
      <Popover content={content} trigger='click' open={open} onOpenChange={changeOpen} placement='bottom' destroyOnHidden>
        <button type='button' className='bookmark-appearance-trigger' aria-label={text.appearance} title={text.appearance}>
          <BookmarkIcon iconUrl={iconUrl} color={color} />
        </button>
      </Popover>
    </>
  )
}
