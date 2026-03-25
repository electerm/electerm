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

const e = window.translate

export default auto(function WidgetsList ({ activeItemId, store }) {
  const { widgetInstances } = store
  const [tab, setTab] = useState('widgets') // or instances
  const [widgets, setWidgets] = useState([])
  const [keyword, setKeyword] = useState('')
  const [ready, setReady] = useState(false)
  const [editorVisible, setEditorVisible] = useState(false)
  const [editingWidget, setEditingWidget] = useState(null) // null → create, widget → edit

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
      const widgets = await window.store.listWidgets()
      setWidgets(widgets)
    } catch (error) {
      console.error('Failed to load widgets:', error)
    }
  }

  const handleSearch = (e) => {
    setKeyword(e.target.value)
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

  const onDeleteWidget = async (widget, ev) => {
    ev.stopPropagation()
    try {
      await window.store.deleteUserWidget(widget.id)
      await loadWidgets()
      // If the deleted widget was selected, clear the form
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
    // Select the saved widget in the form panel
    window.store.setSettingItem(savedWidget)
  }

  const onEditorCancel = () => {
    setEditorVisible(false)
  }

  const renderWidgetItem = (widget, i) => {
    const title = widget.info.name
    const tag = ''
    const cls = classnames(
      'item-list-unit',
      {
        active: activeItemId === widget.id
      }
    )
    const titleHighlight = highlight(
      title,
      keyword
    )
    return (
      <div
        key={widget.id}
        className={cls}
        onClick={() => onClickWidget(widget)}
      >
        <div
          title={title}
          className='elli pd1y pd2x list-item-title'
          style={{ flex: 1, minWidth: 0 }}
        >
          {tag}{titleHighlight || e('new')}
        </div>
        {widget.userCreated && (
          <Space size={2} className='pd1x' onClick={ev => ev.stopPropagation()}>
            <Tooltip title={e('edit') || 'Edit'}>
              <Button
                type='text'
                size='small'
                icon={<EditOutlined />}
                onClick={(ev) => onEditWidget(widget, ev)}
              />
            </Tooltip>
            <Popconfirm
              title={e('confirmDelete') || 'Delete this widget?'}
              onConfirm={(ev) => onDeleteWidget(widget, ev || { stopPropagation: () => {} })}
              okText={e('yes') || 'Yes'}
              cancelText={e('no') || 'No'}
            >
              <Tooltip title={e('delete') || 'Delete'}>
                <Button
                  type='text'
                  size='small'
                  danger
                  icon={<DeleteOutlined />}
                  onClick={ev => ev.stopPropagation()}
                />
              </Tooltip>
            </Popconfirm>
          </Space>
        )}
      </div>
    )
  }

  const renderWidgetsList = () => {
    const filteredWidgets = keyword
      ? widgets.filter(widget => widget.info.name.toLowerCase().includes(keyword.toLowerCase()))
      : widgets

    return (
      <div className='item-list item-type-widgets'>
        <div className='pd1y'>
          <Input.Search
            type='text'
            placeholder='Search widgets...'
            value={keyword}
            onChange={handleSearch}
            className='form-control'
          />
        </div>
        <div className='pd1b'>
          <Button
            type='dashed'
            block
            icon={<PlusOutlined />}
            onClick={onCreateWidget}
          >
            {e('createNewWidget') || 'Create New Widget'}
          </Button>
        </div>
        <div className='item-list-wrap pd1y'>
          {filteredWidgets.map(renderWidgetItem)}
        </div>
        <UserWidgetEditor
          visible={editorVisible}
          widgetId={editingWidget ? editingWidget.id : undefined}
          initialCode={editingWidget ? editingWidget.code : undefined}
          onSave={onEditorSave}
          onCancel={onEditorCancel}
        />
      </div>
    )
  }

  const renderTabs = () => {
    const instancesTag = e('runningInstances') + ` (${widgetInstances.length})`
    const items = [
      {
        key: 'widgets',
        label: e('widgets'),
        children: null
      },
      {
        key: 'instances',
        label: instancesTag,
        children: null
      }
    ]
    return (
      <Tabs
        activeKey={tab}
        onChange={handleTabChange}
        items={items}
      />
    )
  }

  const renderInstancesSection = () => {
    return (
      <WidgetInstances
        widgetInstances={widgetInstances}
      />
    )
  }

  if (!ready) {
    return null
  }

  return (
    <div>
      {renderTabs()}
      <div className='pd2x pd1y'>
        {
          tab === 'widgets'
            ? renderWidgetsList()
            : renderInstancesSection()
        }
      </div>
    </div>
  )
})
