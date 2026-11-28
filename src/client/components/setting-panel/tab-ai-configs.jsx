import { auto } from 'manate/react'
import deepCopy from 'json-deep-copy'
import { getAIConfigName, getAIConfigsLabel } from '../../common/ai-feature'
import AIConfigForm from '../ai/ai-config'
import AIConfigList from '../ai/ai-config-list'
import message from '../common/message'
import SettingCol from './col'

const e = window.translate

export default auto(function TabAIConfigs ({ store, settingItem, listProps }) {
  const appliedId = store.activeAIConfig?.id
  // The selected item is a snapshot. Sync can replace or delete its table row
  // while this editor is open.
  const config = settingItem.id
    ? listProps.list.find(item => item.id === settingItem.id) || store.newAIConfig()
    : settingItem
  function save (values, apply) {
    const saved = store.saveAIConfig({ ...values, id: config.id })
    if (apply) store.applyAIConfig(saved.id)
    store.setSettingItem(deepCopy(saved))
    message.success(e('saved'))
  }

  return (
    <div className='setting-tabs-ai-configs'>
      <SettingCol
        parentLabel={getAIConfigsLabel()}
        currentLabel={config.id ? getAIConfigName(config) : e('new')}
      >
        <AIConfigList {...listProps} activeItemId={config.id} appliedId={appliedId} />
        <AIConfigForm
          key={config.id || 'new'}
          initialValues={config}
          onSubmit={save}
          applied={!!config.id && config.id === appliedId}
          onApply={() => store.applyAIConfig(config.id)}
        />
      </SettingCol>
    </div>
  )
})
