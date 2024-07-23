import {
  syncDataMaps
} from '../../common/constants'
import DataSelectItem from './data-select-item'

const { prefix } = window
const e = prefix('common')
const f = prefix('config')
const t = prefix('terminalThemes')
const p = prefix('form')
const q = prefix('quickCommands')

const translateMap = {
  settings: f,
  terminalThemes: t,
  quickCommands: q,
  bookmarks: e,
  profiles: p,
  addressBookmarks: e
}

export default function DataSelect (props) {
  const {
    dataSyncSelected
  } = props
  function onChange (e) {
    const key = e.target['data-key']
    window.store.toggleDataSyncSelected(key)
  }
  return (
    <div className='pd2y pd1x'>
      {
        Object.keys(syncDataMaps)
          .map(d => {
            const checked = dataSyncSelected.includes(d)
            const title = translateMap[d](d)
            const boxProps = {
              checked,
              onChange,
              title,
              value: d
            }
            return (
              <DataSelectItem
                key={d}
                {...boxProps}
              />
            )
          })
      }
    </div>
  )
}
