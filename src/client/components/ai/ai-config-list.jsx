import { CheckCircleFilled, CheckCircleOutlined, PlusOutlined } from '@ant-design/icons'
import classnames from 'classnames'
import { getAIConfigName } from '../../common/ai-feature'
import highlight from '../common/highlight'
import ListItemActions from '../common/list-item-actions'
import List from '../setting-panel/list'

const e = window.translate

export default class AIConfigList extends List {
  del = (item, evt) => {
    evt.stopPropagation()
    const { store } = this.props
    store.deleteAIConfig(item.id)
    if (item.id === store.settingItem.id) store.setSettingItem(store.newAIConfig())
  }

  filter = list => {
    const query = this.state.keyword.trim().toLowerCase()
    return list.filter(item => getAIConfigName(item).toLowerCase().includes(query))
  }

  renderItem = item => {
    const { appliedId, activeItemId, onClickItem, store } = this.props
    const { id } = item
    const applied = !!id && id === appliedId
    const name = id ? getAIConfigName(item) : e('new')
    return (
      <div key={id || 'new'} className={classnames('item-list-unit', { active: id === activeItemId, current: applied })}>
        <button type='button' className='elli pd1y pd2x list-item-title' aria-current={applied || undefined} title={name} onClick={() => onClickItem(item)}>
          {!id && <PlusOutlined aria-hidden className='mg1r' />}
          {applied && <CheckCircleFilled aria-hidden className='mg1r' />}
          {highlight(name, this.state.keyword)}
        </button>
        <ListItemActions>
          {id && !applied && (
            <button type='button' title={e('apply')} onClick={() => store.applyAIConfig(id)}>
              <CheckCircleOutlined aria-hidden />
            </button>
          )}
          {this.renderDelBtn(item)}
        </ListItemActions>
      </div>
    )
  }
}
