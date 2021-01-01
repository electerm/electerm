/**
 * bookmark form
 */
import { useState, memo } from 'react'
import {
  Radio
} from 'antd'
import {
  settingMap,
  connectionMap,
  terminalSerialType,
  terminalLocalType,
  newBookmarkIdPrefix,
  isWin
} from '../../common/constants'
import SshForm from './ssh-form'
import SerialForm from './serial-form'
import LocalForm from './local-form'

const { prefix } = window
const c = prefix('common')
const m = prefix('menu')
const s = prefix('setting')
const p = prefix('sftp')

export default memo(function BookmarkIndex (props) {
  let initType = props.formData.type
  if (initType === terminalSerialType) {
    initType = terminalSerialType
  } else if (initType === terminalLocalType) {
    initType = terminalLocalType
  } else {
    initType = connectionMap.ssh
  }
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
  function handleChange (e) {
    setBookmarkType(e.target.value)
  }
  const mapper = {
    [connectionMap.ssh]: SshForm,
    [connectionMap.serial]: SerialForm,
    [connectionMap.local]: LocalForm
  }
  const Form = mapper[bookmarkType]
  const isNew = id.startsWith(newBookmarkIdPrefix)
  let keys = Object.keys(connectionMap)
  if (isWin) {
    keys = keys.filter(k => k !== connectionMap.serial)
  }
  return (
    <div className='form-wrap pd1x'>
      <div className='form-title pd1t pd1x pd2b'>
        {
          (!isNew
            ? m('edit')
            : s('new')
          ) + ' ' + c(settingMap.bookmarks)
        }
        <Radio.Group
          buttonStyle='solid'
          size='small'
          className='mg1l'
          value={bookmarkType}
          disabled={!isNew}
          onChange={handleChange}
        >
          {
            keys.map(k => {
              const v = connectionMap[k]
              return (
                <Radio.Button key={v} value={v}>{p(v)}</Radio.Button>
              )
            })
          }
        </Radio.Group>
      </div>
      <Form {...props} />
    </div>
  )
})
