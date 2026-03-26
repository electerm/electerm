/**
 * widgets list
 */
import React, { useState, useEffect } from 'react'
import {
  Input,
  Tabs,
  Button,
  Popconfirm,
  Space,
  Tooltip
} from 'antd'
import {
  PlusOutlined,
  EditOutlined,
  DeleteOutlined
} from '@ant-design/icons'
import WidgetInstances from './widget-instances'
import UserWidgetEditor from './user-widget-editor'
import classnames from 'classnames'
import highlight from '../common/highlight'
import {
  auto
} from 'manate/react'
import './widget.styl'

export default auto(function WidgetsList ({ activeItemId, store }) {
  const { widgetInstances } = store
  const [tab, setTab] = useState('widgets')
  const [widgets, setWidgets] = useState([])
  const [keyword, setKeyword] = useState('')
  const [ready, setReady] = useState(false)
  const [editorVisible, setEditorVisible] = useState(false)
  const [editingWidget, setEditingWidget] = useState(null)

  useEffect(() => {
    const timer = setTimeout(() => {
      setReady(true)
    }, 200)
    loadWidgets()
    return () => {
      clearTimeout(timer)
    }
  }, [])

  const loadWidgets = async () => {
    try {
      const list = await window.store.listWidgets()
      setWidgets(list)
    } catch (error) {
      console.error('Failed to load widgets:', error)
    }
  }

  const handleSearch = (ev) => {
    setKeyword(ev.target.value)
  }

  const handleTabChange = (key) => {
    setTab(key)
  }

  const onClickWidget = (widget) => {
    window.store.setSettingItem(widget)
  }

  const onCreateWidget = () => {
    setEditingWidget(null)
    setEditorVisible(true)
  }

  const onEditWidget = (widget, ev) => {
    ev.stopPropagation()
    setEditingWidget(widget)
    setEditorVisible(true)
  }

  const onDeleteWidget = async (widget) => {
    try {
      await window.store.deleteUserWidget(widget.id)
      await loadWidgets()
      if (activeItemId === widget.id) {
        window.store.setSettingItem({})
      }
    } catch (err) {
      console.error('Failed to delete widget:', err)
    }
  }

  const onEditorSave = async (savedWidget) => {
    setEditorVisible(false)
    await loadWidgets()
    window.store.setSettingItem(savedWidget)
  }

  const onEditorCancel = () => {
    setEditorVisible(false)
  }

  const renderWidgetItem = (widget) => {
    const { id, info, userCreated } = widget
    const { name: title } = info
    const cls = classnames('item-list-unit', { active: activeItemId === id })
    const titleHighlight = highlight(title, keyword)

    const editBtnProps = {
      type: 'text',
      size: 'small',
      icon: <EditOutlined />,
      onClick: (ev) => onEditWidget(widget, ev)
    }

    const deleteBtnProps = {
      type: 'text',
      size: 'small',
      danger: true,
      icon: <DeleteOutlined />,
      onClick: (ev) => ev.stopPropagation()
    }

    const popconfirmProps = {
      title: 'Delete this widget?',
      onConfirm: () => onDeleteWidget(widget),
      okText: 'Yes',
      cancelText: 'No'
    }

    return (
      <div
        key={id}
        className={cls}
        onClick={() => onClickWidget(widget)}
      >
        <div
          title={title}
          className='elli pd1y pd2x widget-list-item-title'
        >
          {titleHighlight || title}
        </div>
        {userCreated && (
          <Space size={2} className='pd1x' onClick={ev => ev.stopPropagation()}>
            <Tooltip title='Edit'>
              <Button {...editBtnProps} />
            </Tooltip>
            <Popconfirm {...popconfirmProps}>
              <Tooltip title='Delete'>
                <Button {...deleteBtnProps} />
              </Tooltip>
            </Popconfirm>
          </Space>
        )}
      </div>
    )
  }

  const renderWidgetsList = () => {
    const filteredWidgets = keyword
      ? widgets.filter(w => w.info.name.toLowerCase().includes(keyword.toLowerCase()))
      : widgets

    const editorWidgetId = editingWidget ? editingWidget.id : undefined
    const editorInitialCode = editingWidget ? editingWidget.code : undefined

    const createBtnProps = {
      type: 'dashed',
      block: true,
      icon: <PlusOutlined />,
      onClick: onCreateWidget
    }

    const editorProps = {
      visible: editorVisible,
      widgetId: editorWidgetId,
      initialCode: editorInitialCode,
      onSave: onEditorSave,
      onCancel: onEditorCancel
    }

    const searchInputProps = {
      type: 'text',
      placeholder: 'Search widgets...',
      value: keyword,
      onChange: handleSearch,
      className: 'form-control'
    }

    return (
      <div className='item-list item-type-widgets'>
        <div className='pd1y'>
          <Input.Search {...searchInputProps} />
        </div>
        <div className='pd1b'>
          <Button {...createBtnProps}>
            Create New Widget
          </Button>
        </div>
        <div className='item-list-wrap pd1y'>
          {filteredWidgets.map(renderWidgetItem)}
        </div>
        <UserWidgetEditor {...editorProps} />
      </div>
    )
  }

  const renderTabs = () => {
    const instancesLabel = `Running Instances (${widgetInstances.length})`
    const tabItems = [
      { key: 'widgets', label: 'Widgets', children: null },
      { key: 'instances', label: instancesLabel, children: null }
    ]
    const tabsProps = {
      activeKey: tab,
      onChange: handleTabChange,
      items: tabItems
    }
    return <Tabs {...tabsProps} />
  }

  const renderInstancesSection = () => {
    return (
      <WidgetInstances widgetInstances={widgetInstances} />
    )
  }

  if (!ready) {
    return null
  }

  const content = tab === 'widgets' ? renderWidgetsList() : renderInstancesSection()

  return (
    <div>
      {renderTabs()}
      <div className='pd2x pd1y'>
        {content}
      </div>
    </div>
  )
})
