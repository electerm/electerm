/**
 * log view and export
 */

import { useState } from 'react'
import { Button, Input } from 'antd'
import fs from '../../common/fs'

const TextArea = Input.TextArea
const { prefix } = window
const m = prefix('menu')
let { oldLogPath, logPath } = window.getGlobal('logPaths')

export default function LogView () {
  let [log, setLog] = useState('')
  async function onClick () {
    let str = await fs.readFile(logPath)
      .catch(() => '')
    let strOld = await fs.readFile(oldLogPath)
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
