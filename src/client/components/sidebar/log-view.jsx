/**
 * log view and export
 */

import { useState } from 'react'
import { Button, Input } from 'antd'
import fs from '../../common/fs'

const TextArea = Input.TextArea
const { prefix } = window
const m = prefix('menu')
const { oldLogPath, logPath } = window.getGlobal('logPaths')

export default function LogView () {
  const [log, setLog] = useState('')
  async function onClick () {
    const str = await fs.readFile(logPath)
      .catch(() => '')
    const strOld = await fs.readFile(oldLogPath)
      .catch(() => '')
    setLog(`${str}\n${strOld}`)
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
