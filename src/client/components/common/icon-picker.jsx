/**
 * Icon panel of the appearance picker: built-in icons, a local file, or a URL
 * that gets downloaded into the data dir first.
 *
 * Content only, the shell (trigger, popover/modal, tabs) belongs to
 * appearance-picker.jsx, which is shared by the bookmark form and the bookmark
 * group editor.
 */

import { useMemo, useState } from 'react'
import {
  Button,
  Input,
  message
} from 'antd'
import {
  BgColorsOutlined,
  DownloadOutlined,
  FolderOpenOutlined
} from '@ant-design/icons'
import { connectionIcons, findConnectionIcons } from 'electerm-icons'
import { builtinIconUrl, forgetFileIcon } from '../../common/icon-assets'
import {
  builtinIconValue,
  iconFileExtensions,
  normalizeIcon
} from '../../common/icon-value'
import './icon-picker.styl'

const e = window.translate

function searchIcons (keyword) {
  const kw = keyword.trim()
  if (!kw) {
    return connectionIcons
  }
  return findConnectionIcons(kw)
}

async function pickLocalIcon () {
  const openDialog = window.api && window.api.openDialog
  if (!openDialog) {
    return null
  }
  const files = await openDialog({
    title: e('icon'),
    properties: [
      'openFile',
      'showHiddenFiles',
      'dontAddToRecent'
    ],
    filters: [
      { name: e('icon'), extensions: iconFileExtensions },
      { name: 'All files', extensions: ['*'] }
    ]
  }).catch(() => false)
  if (!files || !files.length) {
    return null
  }
  return files[0]
}

export default function IconPicker ({ icon, onChange }) {
  const [keyword, setKeyword] = useState('')
  const [url, setUrl] = useState('')
  const [downloading, setDownloading] = useState(false)
  const icons = useMemo(() => searchIcons(keyword), [keyword])
  const canPickFile = Boolean(window.api && window.api.openDialog)
  const current = normalizeIcon(icon)

  const apply = value => {
    onChange(normalizeIcon(value))
  }

  const onPickFile = async () => {
    const filePath = await pickLocalIcon()
    if (!filePath) {
      return
    }
    // a previous failed read may be cached, the user just told us the file is there
    forgetFileIcon(filePath)
    apply(filePath)
  }

  const onDownload = async () => {
    const value = url.trim()
    if (!value || downloading) {
      return
    }
    setDownloading(true)
    try {
      const filePath = await window.fs.saveIconFromUrl(value)
      if (!filePath) {
        throw new Error(e('error'))
      }
      setUrl('')
      apply(filePath)
    } catch (err) {
      message.error(err && err.message ? err.message : e('error'))
    } finally {
      setDownloading(false)
    }
  }

  return (
    <div className='icon-picker'>
      <Input
        className='icon-picker-search'
        value={keyword}
        allowClear
        placeholder={e('search')}
        onChange={ev => setKeyword(ev.target.value)}
      />
      <div className='icon-picker-grid'>
        {
          icons.length
            ? icons.map(item => (
              <button
                key={item.name}
                type='button'
                className={
                  current === builtinIconValue(item.name)
                    ? 'icon-picker-item is-active'
                    : 'icon-picker-item'
                }
                title={item.label}
                aria-label={item.label}
                onClick={() => apply(builtinIconValue(item.name))}
              >
                <img
                  src={builtinIconUrl(item.name)}
                  width={22}
                  height={22}
                  alt=''
                  draggable={false}
                />
              </button>
            ))
            : <div className='icon-picker-empty'>{e('notFoundContent')}</div>
        }
      </div>
      <div className='icon-picker-actions'>
        {
          canPickFile && (
            <Button
              size='small'
              icon={<FolderOpenOutlined />}
              onClick={onPickFile}
            >
              {e('chooseFile')}
            </Button>
          )
        }
        <Button
          size='small'
          icon={<BgColorsOutlined />}
          disabled={!current}
          onClick={() => apply('')}
        >
          {e('default')}
        </Button>
      </div>
      <div className='icon-picker-url'>
        <Input
          size='small'
          value={url}
          placeholder='https://example.com/icon.svg'
          onChange={ev => setUrl(ev.target.value)}
          onPressEnter={onDownload}
        />
        <Button
          size='small'
          type='primary'
          icon={<DownloadOutlined />}
          loading={downloading}
          disabled={!url.trim()}
          onClick={onDownload}
        >
          {e('download')}
        </Button>
      </div>
    </div>
  )
}
