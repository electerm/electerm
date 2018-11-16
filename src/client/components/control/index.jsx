
import {memo} from 'react'
import Tabs from '../tabs'
import Btns from './btns'
import SettingModal from '../setting-panel/setting-modal'
import TransferHistoryModal from './transfer-history-modal'
import './control.styl'

export default memo(props => {
  return (
    <div>
      <SettingModal
        {...props}
      />
      <TransferHistoryModal
        {...props}
      />
      <Btns
        {...props}
      />
      <Tabs
        {...props}
      />
    </div>
  )
})


