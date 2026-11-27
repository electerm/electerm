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
  function save (values, apply) {
    const saved = store.saveAIConfig({ ...values, id: settingItem.id })
    if (apply) store.applyAIConfig(saved.id)
    store.setSettingItem(deepCopy(saved))
    message.success(e('saved'))
  }

  return (
    <div className='setting-tabs-ai-configs'>
      <SettingCol
        parentLabel={getAIConfigsLabel()}
        currentLabel={settingItem.id ? getAIConfigName(settingItem) : e('new')}
      >
        <AIConfigList {...listProps} appliedId={appliedId} />
        <AIConfigForm
          key={settingItem.id || 'new'}
          initialValues={settingItem}
          onSubmit={save}
          applied={!!settingItem.id && settingItem.id === appliedId}
          onApply={() => store.applyAIConfig(settingItem.id)}
        />
      </SettingCol>
    </div>
  )
})
