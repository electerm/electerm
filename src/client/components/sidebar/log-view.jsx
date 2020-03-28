/**
 * log view and export
 */

import { useState } from 'react'
import { Button, Input } from 'antd'
import fs from '../../common/fs'

const TextArea = Input.TextArea
const { prefix } = window
const m = prefix('menu')

export default function LogView () {
  const [log, setLog] = useState('')
  async function onClick () {
    const logPath = window.log.transports.file.getFile().path
    const str = await fs.readFile(logPath)
      .catch(() => '')
    setLog(`${str}\n`)
  }
  return (
    <div>
      <div className='pd1b'>
        <Button
          onClick={onClick}
        >
          {m('reload') + ' log'}
        </Button>
      </div>
      {
        log
          ? (
            <TextArea value={log} rows={10} />
          )
          : null
      }
    </div>
  )
}
