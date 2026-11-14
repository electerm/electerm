/**
 * Online widgets tab: the widgets.electerm.org index.
 *
 * Browsing is read-only and best-effort — if the site is down the installed
 * widgets tab still works. Installing is deliberately two steps: this list
 * shows what a widget is and where its code lives, then a confirm dialog spells
 * out that main.js runs with full Node privileges. Only after that does the
 * main process fetch the pinned commit and verify every file.
 *
 * Everything here is laid out by antd (Space/Typography/Alert/Spin) plus the
 * shared utility classes; the row chrome is the `.ow-item` rules in
 * widgets.styl. antd 6 deprecated `List`, so the rows are plain markup.
 */
import React, { useEffect, useState } from 'react'
import {
  Alert,
  Button,
  Input,
  Space,
  Spin,
  Typography
} from 'antd'
import Modal from '../common/modal'
import message from '../common/message'
import {
  loadWidgetRegistry,
  installRegistryWidget,
  registrySourceUrl
} from '../../common/widget-registry'

const e = window.translate
const { Link, Paragraph, Text } = Typography
const REGISTRY_SITE = 'https://widgets.electerm.org'

function formatSize (size) {
  if (!size || size < 1024) {
    return `${size} B`
  }
  return `${(size / 1024).toFixed(size < 1024 * 1024 ? 0 : 1)} KB`
}

export default function OnlineWidgets ({ installed, onInstalled }) {
  const [records, setRecords] = useState([])
  const [revocations, setRevocations] = useState([])
  const [keyword, setKeyword] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [busyId, setBusyId] = useState('')

  const load = async () => {
    setLoading(true)
    setError('')
    try {
      const res = await loadWidgetRegistry()
      setRecords(res.widgets)
      setRevocations(res.revocations)
    } catch (err) {
      setError((err && err.message) || String(err))
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
  }, [])

  const install = async (record, overwrite = false) => {
    setBusyId(record.id)
    try {
      const result = await installRegistryWidget(record.id, overwrite)
      if (result && result.needOverwrite) {
        Modal.confirm({
          title: 'Replace installed widget?',
          content: `"${record.name}" is already installed. Replace it with ${result.source || 'the registry version'}?`,
          okText: e('import'),
          cancelText: e('cancel'),
          onOk: () => install(record, true)
        })
        return
      }
      onInstalled(result)
    } catch (err) {
      console.error('install registry widget error', err)
      message.error((err && err.message) || String(err))
    } finally {
      setBusyId('')
    }
  }

  const confirmInstall = (record) => {
    Modal.confirm({
      title: `Install ${record.name}?`,
      width: 520,
      okText: e('import'),
      cancelText: e('cancel'),
      content: (
        <div>
          <Alert
            type='warning'
            showIcon
            className='mg1b'
            title="A widget's main.js runs inside electerm's main process with full Node permissions — it can read files and run commands. Install only widgets whose source you trust."
          />
          <Space orientation='vertical' size={4} className='width-100'>
            <p className='mg0 wordbreak'>Version: {record.version}</p>
            <p className='mg0 wordbreak'>Author: {record.author || 'unknown'}</p>
            <p className='mg0 wordbreak'>Repository: {record.host}/{record.owner}/{record.repo}</p>
            <p className='mg0 wordbreak'>Commit: {record.ref}</p>
            <p className='mg0 wordbreak'>
              Files: {record.fileCount} ({formatSize(record.totalSize)}), pinned and verified
            </p>
            <Link onClick={() => window.pre.openExternal(registrySourceUrl(record))}>
              View source at this commit
            </Link>
          </Space>
        </div>
      ),
      onOk: () => install(record, false)
    })
  }

  const installedIds = new Set(
    (installed || []).filter(w => w.builtin === false).map(w => w.id)
  )
  const revokedIds = new Set(revocations.map(r => r.id))
  const filtered = keyword
    ? records.filter(record => {
      const haystack = `${record.name} ${record.description} ${record.author} ${record.repo}`.toLowerCase()
      return haystack.includes(keyword.toLowerCase())
    })
    : records

  const renderItem = (record) => {
    const isInstalled = installedIds.has(record.id)
    const revoked = revokedIds.has(record.id)
    const busy = busyId === record.id
    return (
      <div key={record.id} className='ow-item'>
        <div className='ow-item-head'>
          <span className='wordbreak'>{record.name}</span>
          <Text type='secondary'>{record.version}</Text>
          {isInstalled ? <Text type='secondary'>installed</Text> : null}
        </div>
        <Space orientation='vertical' size={2} className='width-100'>
          <span className='wordbreak'>{record.description}</span>
          <Text type='secondary' className='wordbreak'>
            {record.author || 'unknown'} · {record.host}/{record.owner}/{record.repo} · {record.license || 'no license'}
          </Text>
          <Text type='secondary' className='wordbreak'>
            {record.fileCount} files · {formatSize(record.totalSize)} · {record.ref.slice(0, 7)}
          </Text>
          {revoked
            ? <Text type='danger'>This widget was removed from the registry. Do not reinstall it.</Text>
            : null}
          <Space size={4}>
            <Button
              size='small'
              type='primary'
              disabled={revoked || busy}
              loading={busy}
              onClick={() => confirmInstall(record)}
            >
              {isInstalled ? 'Update' : 'Install'}
            </Button>
            <Button
              type='link'
              size='small'
              onClick={() => window.pre.openExternal(registrySourceUrl(record))}
            >
              Source
            </Button>
          </Space>
        </Space>
      </div>
    )
  }

  return (
    <div className='item-list'>
      <div className='pd1y'>
        <Input.Search
          type='text'
          placeholder='Search online widgets...'
          value={keyword}
          onChange={ev => setKeyword(ev.target.value)}
          className='form-control'
        />
      </div>
      {error
        ? <Alert
            type='error'
            showIcon
            title={`Could not load the registry: ${error}`}
            action={<Button type='link' size='small' onClick={load}>Retry</Button>}
          />
        : null}
      <Paragraph type='secondary'>
        Community widgets are indexed at{' '}
        <Link onClick={() => window.pre.openExternal(REGISTRY_SITE)}>
          widgets.electerm.org
        </Link>. Nothing is installed until you confirm.
      </Paragraph>
      <Spin spinning={loading}>
        {!loading && !error && !filtered.length
          ? <Text type='secondary'>No widgets found.</Text>
          : filtered.map(renderItem)}
      </Spin>
    </div>
  )
}
