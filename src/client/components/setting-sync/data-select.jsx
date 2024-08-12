import {
  syncDataMaps
} from '../../common/constants'
import DataSelectItem from './data-select-item'

const e = window.translate

export default function DataSelect (props) {
  const {
    dataSyncSelected
  } = props
  function onChange (evt) {
    const key = evt.target['data-key']
    window.store.toggleDataSyncSelected(key)
  }
  return (
    <div className='pd2y pd1x'>
      {
        Object.keys(syncDataMaps)
          .map(d => {
            const checked = dataSyncSelected.includes(d)
            const title = e(d)
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
