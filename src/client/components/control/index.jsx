
import {Component} from '../common/react-subx'
import Tabs from '../tabs'
import Btns from './btns'
import './control.styl'
import SettingModal from '../setting-panel/setting-modal'
import TransferHistoryModal from './transfer-history-modal'
import store from '../../store'

export default class IndexControl extends Component {

  render() {
    return (
      <div>
        <SettingModal
          store={store}
        />
        <TransferHistoryModal
          store={store}
        />
        <Btns
          store={store}
        />
        <Tabs
          store={store}
        />
      </div>
    )
  }

}
