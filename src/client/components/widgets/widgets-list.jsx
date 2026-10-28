/**
 * widgets list
 */
import React, { useState, useEffect } from 'react'
import {
  Button,
  Input,
  Popconfirm,
  Tabs,
  Tooltip
} from 'antd'
import {
  CloseOutlined,
  ImportOutlined,
  WarningOutlined
} from '@ant-design/icons'
import WidgetInstances from './widget-instances'
import WidgetImportModal from './widget-import-modal'
import HelpIcon from '../common/help-icon'
import classnames from 'classnames'
import highlight from '../common/highlight'
import Modal from '../common/modal'
import message from '../common/message'
import {
  settingPanelMobileBreakpoint
} from '../../common/constants'
import {
  auto
} from 'manate/react'

const e = window.translate

// Where "how do I write one / where do I get one" is answered. Kept next to the
// import button because that is the moment the question comes up.
const WIDGET_WIKI = 'https://github.com/electerm/electerm/wiki/User-widget-guide'

export default auto(function WidgetsList ({ activeItemId, store, onClickItem }) {
  const { widgetInstances } = store
  const [tab, setTab] = useState('widgets') // or instances
  const [widgets, setWidgets] = useState([])
  const [keyword, setKeyword] = useState('')
  const [ready, setReady] = useState(false)
  const [importOpen, setImportOpen] = useState(false)

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
    if (onClickItem) {
      return onClickItem(widget)
    }
    window.store.setSettingItem(widget)
    // narrow panels drill into the right col content after picking a widget
    if (window.store.innerWidth <= settingPanelMobileBreakpoint) {
      window.store.settingMobileView = 'content'
    }
  }

  // Install: pick a widget folder, copy it whole into <data dir>/widgets/<id>/
  const installFrom = async (dir, overwrite) => {
    const result = await window.pre.runGlobalAsync('importWidget', dir, !!overwrite)
    if (result && result.needOverwrite) {
      Modal.confirm({
        title: e('import') + '?',
        content: `Widget "${result.id}" is already installed. Replace it with the selected folder?`,
        okText: e('import'),
        cancelText: e('cancel'),
        onOk: () => {
          installFrom(dir, true).catch(err => {
            console.error('import widget error', err)
            message.error(err.message)
          })
        }
      })
      return
    }
    await afterInstall(result)
  }

  // Install from a repository: the main process downloads it, finds the widget
  // folder inside it and copies that in, so the renderer only reads what came
  // back. Errors are thrown on purpose — the import modal shows them under the
  // input instead of in a toast that outlives the field.
  const installFromSource = async (input, overwrite) => {
    const result = await window.pre.runGlobalAsync(
      'importWidgetFromSource',
      input,
      !!overwrite
    )
    // the modal is closed either way before asking: two overlays at the same
    // z-index would stack in whatever order the DOM happens to have them
    setImportOpen(false)
    if (result && result.needOverwrite) {
      Modal.confirm({
        title: e('import') + '?',
        content: `Widget "${result.id}" is already installed. Replace it with ${result.source}?`,
        okText: e('import'),
        cancelText: e('cancel'),
        onOk: () => {
          installFromSource(input, true).catch(err => {
            console.error('import widget error', err)
            message.error(err.message)
          })
        }
      })
      return
    }
    await afterInstall(result)
  }

  const afterInstall = async (result) => {
    const installed = await window.store.listWidgets()
    setWidgets(installed)
    const item = installed.find(w => w.id === result.id)
    if (item) {
      onClickWidget(item)
    }
  }

  const handleChooseFolder = async () => {
    setImportOpen(false)
    try {
      const dirs = await window.api.openDialog({
        title: e('import'),
        properties: ['openDirectory']
      })
      if (!dirs || !dirs[0]) {
        return
      }
      await installFrom(dirs[0], false)
    } catch (err) {
      console.error('import widget error', err)
      message.error(err.message)
    }
  }

  const handleDelete = async (widget) => {
    try {
      await window.pre.runGlobalAsync('deleteWidget', widget.id)
      await loadWidgets()
      if (activeItemId === widget.id) {
        window.store.closeWidgetInstance()
      }
    } catch (err) {
      console.error('delete widget error', err)
      message.error(err.message)
    }
  }

  const renderWidgetActions = (widget) => {
    // a built-in that a user widget tried to shadow: the built-in wins, and the
    // ignored folder is reported here instead of vanishing
    if (widget.warning) {
      return (
        <Tooltip title={widget.warning}>
          <WarningOutlined className='pointer list-item-widget-error' />
        </Tooltip>
      )
    }
    if (widget.builtin !== false) {
      return null
    }
    if (widget.state === 'error') {
      return (
        <Tooltip title={widget.error}>
          <WarningOutlined className='pointer list-item-widget-error' />
        </Tooltip>
      )
    }
    return (
      <Popconfirm
        title={e('del') + '?'}
        onConfirm={() => handleDelete(widget)}
        okText={e('del')}
        cancelText={e('cancel')}
        placement='top'
      >
        <CloseOutlined
          title={e('del')}
          className='pointer list-item-remove'
        />
      </Popconfirm>
    )
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
          title={widget.error || title}
          className='elli pd1y pd2x list-item-title'
        >
          {tag}{titleHighlight || e('new')}
        </div>
        {renderWidgetActions(widget)}
      </div>
    )
  }

  const renderWidgetsList = () => {
    const filteredWidgets = keyword
      ? widgets.filter(widget => widget.info.name.toLowerCase().includes(keyword.toLowerCase()))
      : widgets

    return (
      <div className='item-list item-type-widgets'>
        {/* its own row, above the search box: as a search addon the import
            icon looked like part of the search feature. The help icon points at
            the wiki page from the same row, so "where do I get a widget?" is
            answered where the button is. */}
        <div className='pd1y widgets-import-row'>
          <Button
            block
            icon={<ImportOutlined />}
            onClick={() => setImportOpen(true)}
          >
            {e('import')}
          </Button>
          <HelpIcon link={WIDGET_WIKI} />
        </div>
        <div className='pd1y'>
          <Input.Search
            type='text'
            placeholder='Search widgets...'
            value={keyword}
            onChange={handleSearch}
            className='form-control'
          />
        </div>
        <div className='item-list-wrap pd1y'>
          {filteredWidgets.map(renderWidgetItem)}
        </div>
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

  // clicking a running instance shows its detail + log in the right column
  // (the widgets list above drills into the run form instead)
  const onClickWidgetInstance = (instance) => {
    window.store.selectWidgetInstance(instance)
  }

  const renderInstancesSection = () => {
    return (
      <WidgetInstances
        widgetInstances={widgetInstances}
        activeItemId={activeItemId}
        onClickItem={onClickWidgetInstance}
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
      <WidgetImportModal
        open={importOpen}
        onCancel={() => setImportOpen(false)}
        onImport={(input) => installFromSource(input, false)}
        onChooseFolder={handleChooseFolder}
      />
    </div>
  )
})
