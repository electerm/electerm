/**
 * bookmark form
 */
import { useState } from 'react'
import {
  Radio
} from 'antd'
import {
  settingMap,
  connectionMap,
  terminalSerialType,
  newBookmarkIdPrefix
} from '../../common/constants'
import SshForm from './ssh-form'
import SerialForm from './serial-form'

const { prefix } = window
const c = prefix('common')
const m = prefix('menu')
const s = prefix('setting')

export default function BookmarkIndex (props) {
  const initType = props.formData.type === terminalSerialType
    ? terminalSerialType
    : 'ssh'
  const [bookmarkType, setBookmarkType] = useState(initType)
  const {
    id = ''
  } = props.formData
  const {
    type
  } = props
  if (type !== settingMap.bookmarks && type !== settingMap.history) {
    return null
  }
  return (
    <div className='form-wrap pd1x'>
      <div className='form-title pd1t pd1x pd2b'>
        {
          (!id.startsWith(newBookmarkIdPrefix)
            ? m('edit')
            : s('new')
          ) + ' ' + c(settingMap.bookmarks)
        }
        <Radio.Group
          buttonStyle='solid'
          className='mg1l'
          value={bookmarkType}
          onChange={e => setBookmarkType(e.target.value)}
        >
          {
            Object.keys(connectionMap).map(k => {
              return (
                <Radio.Button value={connectionMap[k]}>{connectionMap[k]}</Radio.Button>
              )
            })
          }
        </Radio.Group>
      </div>
      {
        bookmarkType === connectionMap.ssh
          ? <SshForm {...props} />
          : <SerialForm {...props} />
      }
    </div>
  )
}
