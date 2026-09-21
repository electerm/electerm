/**
 * bookmark form - load a .vv (virt-viewer) connection file
 *
 * Registered as field type 'vvFile' in ./fields.jsx and used by
 * ../config/spice.js. Fills host/port/password/title/proxy from the file and
 * reports anything it could not honour instead of dropping it silently.
 */
import { useState } from 'react'
import {
  Form,
  Button,
  Alert
} from 'antd'
import { FileAddOutlined } from '@ant-design/icons'
import fs from '../../../common/fs'
import { tailFormItemLayout } from '../../../common/form-layout'
import { parseVv, describeVv } from '../../../common/parse-vv'

const FormItem = Form.Item

/**
 * window.translate echoes an unknown key back capitalised, so an unmapped
 * 'loadVvFile' would render as "LoadVvFile". The key IS in
 * ~/dev/electerm-locales, but the app consumes the published
 * @electerm/electerm-locales, so it stays unknown until that ships and the dep
 * is bumped. Fall back to the literal, which is what en_us resolves to anyway
 * (capitalizeFirstLetter('load .vv file')), so nothing changes visually when
 * the translation does land.
 */
function vvLabel () {
  const t = window.translate('loadVvFile')
  return t === 'LoadVvFile' ? 'Load .vv file' : t
}

/**
 * Open the native file dialog, filtered to .vv files.
 * window.api.openDialog is dialog.showOpenDialogSync in the main process
 * (see src/app/lib/ipc.js), so the full Electron options object is accepted.
 * @returns {Promise<string|null>} selected path, or null when cancelled
 */
async function pickVvFile () {
  const files = await window.api.openDialog({
    title: 'Choose a .vv connection file',
    message: 'Choose a .vv connection file',
    properties: [
      'openFile',
      'showHiddenFiles',
      'noResolveAliases',
      'treatPackageAsDirectory',
      'dontAddToRecent'
    ],
    filters: [
      { name: 'Virt Viewer connection file', extensions: ['vv'] },
      { name: 'All files', extensions: ['*'] }
    ]
  }).catch(() => false)
  if (!files || !files.length) {
    return null
  }
  return files[0]
}

export default function VvFileField ({ form }) {
  const [hint, setHint] = useState(null)
  const [loading, setLoading] = useState(false)

  const load = async () => {
    setLoading(true)
    setHint(null)
    try {
      const filePath = await pickVvFile()
      if (!filePath) {
        return
      }
      // fs.readFile resolves the file as a utf8 string (src/app/lib/fs.js)
      const text = await fs.readFile(filePath)
      const parsed = parseVv(text)

      if (!parsed.ok) {
        setHint({ type: 'error', text: describeVv(parsed) })
        return
      }

      // Only push the keys the file actually defined, so loading a .vv on top
      // of a partly filled form does not wipe the other fields.
      form.setFieldsValue(parsed.fields)

      const notes = parsed.warnings.slice()
      if (parsed.ignored.length) {
        notes.push(
          'skipped: ' + parsed.ignored.map(d => d.key).join(', ')
        )
      }
      if (parsed.unknown.length) {
        notes.push(
          'unrecognised: ' + parsed.unknown.map(d => d.key).join(', ')
        )
      }

      const summary = describeVv(parsed)
      setHint({
        type: notes.length ? 'warning' : 'success',
        text: summary + (notes.length ? ' -- ' + notes.join('; ') : '')
      })
    } catch (err) {
      setHint({ type: 'error', text: 'cannot read file: ' + err.message })
    } finally {
      setLoading(false)
    }
  }

  return (
    <FormItem
      {...tailFormItemLayout}
    >
      <Button
        icon={<FileAddOutlined />}
        loading={loading}
        onClick={load}
      >
        {vvLabel()}
      </Button>
      {
        hint && (
          <Alert
            className='mg1t'
            type={hint.type}
            title={hint.text}
            showIcon
            closable
            onClose={() => setHint(null)}
          />
        )
      }
    </FormItem>
  )
}
