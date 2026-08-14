/**
 * Generic form renderer driven by config (flattened path)
 */
import React, { useEffect, useState, useRef } from 'react'
import { Form, Tabs } from 'antd'
import message from '../common/message'
import { renderFormItem } from './common/fields'
import SubmitButtons from './common/submit-buttons'
import { uniq } from 'lodash-es'
import {
  authTypeMap,
  settingMap,
  newBookmarkIdPrefix,
  defaultBookmarkGroupId
} from '../../common/constants'
import copy from 'json-deep-copy'
import generate from '../../common/uid'
import runIdle from '../../common/run-idle'
import getInitItem from '../../common/init-setting-item'
import testCon from '../../common/test-connection'
import newTerm from '../../common/new-terminal'
import { isValidIP } from '../../common/is-ip'
import { action as manateAction } from 'manate'

// Groups a flat field list into titled section cards. A field with
// type 'sectionHeader' starts a new card; fields before the first
// sectionHeader render ungrouped (unchanged legacy behavior for tabs
// that don't opt into sectioning, e.g. Settings/Quick commands/Ssh tunnel).
function renderFieldList (fields, layout, form, ctxProps) {
  const nodes = []
  let section = null
  fields.forEach((f, index) => {
    if (f.type === 'sectionHeader') {
      section = {
        title: typeof f.title === 'function' ? f.title() : f.title,
        description: typeof f.description === 'function' ? f.description() : f.description,
        items: []
      }
      nodes.push(section)
      return
    }
    if (section) {
      section.items.push({ f, index })
    } else {
      nodes.push({ f, index })
    }
  })
  return nodes.map((n, i) => {
    if (!n.items) {
      return renderFormItem(n.f, layout, form, ctxProps, n.index)
    }
    return (
      <div className='bookmark-form-section' key={`section-${i}`}>
        <div className='bookmark-form-section-head'>
          <div className='bookmark-form-section-title'>{n.title}</div>
          {n.description ? <div className='bookmark-form-section-desc'>{n.description}</div> : null}
        </div>
        <div className='bookmark-form-section-body'>
          {n.items.map(({ f, index }) => (
            <div className={f.half ? 'bookmark-field-half' : 'bookmark-field-full'} key={f.name || index}>
              {renderFormItem(f, layout, form, ctxProps, index)}
            </div>
          ))}
        </div>
      </div>
    )
  })
}

export default function FormRenderer ({ config, props }) {
  const initialValues = config.initValues(props)
  const [form] = Form.useForm()
  const [ips, setIps] = useState([])
  const [authType, setAuthType] = useState(initialValues.authType || authTypeMap.password)
  const [testing, setTesting] = useState(false)
  const action = useRef('submit')

  useEffect(() => {
    const init = config.initValues(props)
    form.resetFields()
    form.setFieldsValue(init)
  }, [
    props.currentBookmarkGroupId,
    props.formData?.id,
    config.key
  ])

  const updateBookmarkGroups = manateAction((bookmark, categoryId) => {
    const {
      bookmarkGroups
    } = window.store
    let index = bookmarkGroups.findIndex(
      bg => bg.id === categoryId
    )
    if (index < 0) {
      index = bookmarkGroups.findIndex(
        bg => bg.id === defaultBookmarkGroupId
      )
    }
    const bid = bookmark.id
    const bg = bookmarkGroups[index]
    if (!bg.bookmarkIds.includes(bid)) {
      bg.bookmarkIds.unshift(bid)
    }
    bg.bookmarkIds = uniq(bg.bookmarkIds)
    bookmarkGroups.forEach((bg, i) => {
      if (i === index) {
        return bg
      }
      bg.bookmarkIds = bg.bookmarkIds.filter(
        g => g !== bid
      )
      return bg
    })
    message.success('OK', 3)
  })

  const setNewItem = (settingItem = getInitItem([], settingMap.bookmarks)) => {
    const { store } = props
    store.setSettingItem(settingItem)
  }

  const submit = (evt, item, type = props.type) => {
    if (item.host) {
      item.host = item.host.trim()
    }
    const obj = item
    if (obj.connectionHoppings?.length) {
      obj.hasHopping = true
    }
    const { addItem, editItem } = props.store
    const categoryId = obj.category
    delete obj.category
    if (!obj.id.startsWith(newBookmarkIdPrefix)) {
      const tar = copy(obj)
      delete tar.id
      runIdle(() => {
        editItem(obj.id, tar, settingMap.bookmarks)
      })
      updateBookmarkGroups(
        obj,
        categoryId
      )
      if (evt === 'saveAndCreateNew') {
        setNewItem()
      }
    } else {
      obj.id = generate()
      runIdle(() => {
        addItem(obj, settingMap.bookmarks)
      })
      updateBookmarkGroups(
        obj,
        categoryId
      )
      setNewItem(evt === 'saveAndCreateNew'
        ? getInitItem([], settingMap.bookmarks)
        : obj
      )
    }
  }

  const test = async (update) => {
    let options = copy({
      ...props.formData,
      ...update
    })
    let msg = ''
    setTesting(true)
    options = window.store.applyProfileToTabs(options)
    const res = await testCon(options)
      .then(r => r)
      .catch((e) => {
        msg = e.message
        return false
      })
    setTesting(false)
    if (res) {
      message.success('connection ok')
    } else {
      const err = 'connection fails' +
        (msg ? `: ${msg}` : '')
      message.error(err)
    }
  }

  const onSelectProxy = (proxy, form) => {
    const obj = Object.keys(proxy)
      .reduce((prev, c) => {
        return {
          ...prev,
          [`proxy.${c}`]: proxy[c]
        }
      }, {})
    form.setFieldsValue(obj)
  }

  const handleSubmit = async (evt, res, isTest = false) => {
    if (res.enableSsh === false && res.enableSftp === false) {
      return message.warning('SSH and SFTP all disabled')
    }
    const obj = {
      ...props.formData,
      ...res
    }
    if (!obj.terminalBackground?.terminalBackgroundImagePath) {
      delete obj.terminalBackground
    }
    if (isTest) {
      return test(obj)
    }
    if (evt && evt !== 'connect') {
      submit(evt, obj)
    }
    if (evt !== 'save' && evt !== 'saveAndCreateNew') {
      window.store.currentLayoutBatch = window.openTabBatch || 0
      props.store.addTab({
        ...copy(obj),
        ...newTerm(true, true),
        batch: window.openTabBatch ?? window.store.currentLayoutBatch
      })
      delete window.openTabBatch
      props.hide()
    }
  }

  // Button handlers - exactly like original use-form-funcs
  const save = () => {
    action.current = 'save'
    form.submit()
  }

  const saveAndCreateNew = () => {
    action.current = 'saveAndCreateNew'
    form.submit()
  }

  const testConnection = () => {
    action.current = 'testConnection'
    form.submit()
  }

  const connect = () => {
    action.current = 'connect'
    form.submit()
  }

  const handleFinish = (res) => {
    if (action.current === 'save') {
      handleSubmit('save', res, false)
    } else if (action.current === 'saveAndCreateNew') {
      handleSubmit('saveAndCreateNew', res, false)
    } else if (action.current === 'connect') {
      handleSubmit('connect', res, false)
    } else if (action.current === 'testConnection') {
      handleSubmit('test', res, true)
    } else {
      handleSubmit('submit', res, false)
    }
    action.current = 'submit'
  }

  const trim = (v) => {
    return (v || '').replace(/^\s+|\s+$/g, '')
  }
  const useIp = (form, ip) => {
    form.setFieldsValue({
      host: ip
    })
  }
  const onPaste = (e, form) => {
    const txt = e.clipboardData.getData('Text')
    // support name:passsword@host:23
    const arr = txt.match(/([^:@]+)(:[^:@]+)?@([^:@]+)(:\d+)?/)
    if (!arr) {
      return
    }
    const username = arr[1]
    const password = arr[2] ? arr[2].slice(1) : ''
    const host = arr[3]
    const port = arr[4] ? arr[4].slice(1) : ''
    const obj = {
      username,
      host
    }
    if (password) {
      obj.password = password
    }
    if (port) {
      obj.port = port
    }
    setTimeout(() => {
      form.setFieldsValue(obj)
    }, 20)
  }

  const onBlur = async (e) => {
    const value = e.target.value.trim()
    const { type } = props
    if (
      type !== settingMap.bookmarks ||
      !value ||
      isValidIP(value)
    ) {
      return
    }
    const ips = await window.pre.runGlobalAsync('lookup', value)
      .catch(err => {
        console.debug(err)
      })
    setIps(ips || [])
  }

  function onChangeAuthType (e) {
    const newAuthType = e.target.value
    setAuthType(newAuthType)
  }

  const ctxProps = {
    ...props,
    form,
    authType,
    ips,
    testing,
    loaddingSerials: props.loaddingSerials || false,
    trim,
    onSelectProxy,
    onChangeAuthType,
    handleBlur: onBlur,
    handlePaste: onPaste,
    useIp
  }

  const tabs = typeof config.tabs === 'function' ? (config.tabs() || []) : (config.tabs || [])
  let content = null

  if (tabs.length <= 1) {
    const fields = tabs.length === 1
      ? (tabs[0].fields || [])
      : (config.fields || [])
    content = (
      <div className='pd1x'>
        {renderFieldList(fields, config.layout, form, ctxProps)}
      </div>
    )
  } else {
    const items = (tabs || []).map(tab => ({
      key: tab.key,
      label: tab.label,
      forceRender: true,
      children: (
        <div className='pd1x'>
          {renderFieldList(tab.fields || [], config.layout, form, ctxProps)}
        </div>
      )
    }))
    content = <Tabs items={items} className='bookmark-form-tabs' />
  }
  const formName = `${config.key}-form`
  return (
    <Form
      form={form}
      layout='vertical'
      onFinish={handleFinish}
      initialValues={initialValues}
      name={formName}
      className='bookmark-form-scroll-wrap'
    >
      <div className='bookmark-form-scroll-body'>
        {content}
      </div>
      <SubmitButtons
        onSave={save}
        onSaveAndCreateNew={saveAndCreateNew}
        onConnect={connect}
        onTestConnection={testConnection}
      />
    </Form>
  )
}
