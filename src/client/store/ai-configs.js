import { aiConfigDefaults as defaults } from '../components/ai/ai-config-props'
import uid from '../common/uid'
import { safeGetItemJSON } from '../common/safe-local-storage'

const fields = Object.keys(defaults)
const historyKey = 'ai_config_history'

// Older versions also wrote the shipped defaults to general settings on a
// fresh install. Only an actual configuration should skip first-time setup.
function hasLegacyConfig (values) {
  return fields.some(key => values[key] != null && values[key] !== defaults[key])
}

function configValues (values, language) {
  const initial = { ...defaults, languageAI: language }
  if (values.baseURLAI && values.baseURLAI !== defaults.baseURLAI) initial.nameAI = ''
  return Object.fromEntries(fields.map(key => [key, values[key] ?? initial[key]]))
}

function findOrAdd (configs, values, language) {
  const candidate = configValues(values, language)
  const existing = configs.find(conf => fields.every(key => conf[key] === candidate[key]))
  if (existing) return existing
  const record = { ...candidate, id: uid() }
  configs.push(record)
  return record
}

function migrateSettings (settings, configs, language, existing) {
  const clean = { ...settings }
  if (!clean.activeAIConfigId && hasLegacyConfig(clean)) {
    const profile = existing || findOrAdd(configs, clean, language)
    clean.activeAIConfigId = profile.id
  }
  for (const key of fields) delete clean[key]
  return clean
}

export default Store => {
  Store.prototype.newAIConfig = function () {
    return { ...defaults, languageAI: window.store.getLangName() }
  }

  Store.prototype.aiConfigMissing = function () {
    const config = window.store.activeAIConfig
    return !config || ['baseURLAI', 'apiPathAI', 'modelAI', 'roleAI', 'authHeaderNameAI', 'languageAI']
      .some(key => !config[key])
  }

  Store.prototype.applyAIConfig = function (id) {
    const { store } = window
    if (store.aiConfigs.some(conf => conf.id === id)) {
      store.setConfig({ activeAIConfigId: id })
    }
  }

  Store.prototype.saveAIConfig = function (values) {
    const { store } = window
    const record = { ...configValues(values, store.getLangName()), id: values.id || uid() }
    const first = !store.aiConfigs.length
    if (store.aiConfigs.some(conf => conf.id === record.id)) {
      store.editItem(record.id, record, 'aiConfigs')
    } else {
      store.addItem(record, 'aiConfigs')
    }
    if (first) store.applyAIConfig(record.id)
    return record
  }

  Store.prototype.deleteAIConfig = function (id) {
    const { store } = window
    const wasActive = store.activeAIConfig?.id === id
    store.delItem({ id }, 'aiConfigs')
    if (wasActive) {
      store.setConfig({ activeAIConfigId: store.aiConfigs[0]?.id || '' })
    }
  }

  Store.prototype.importLegacyAIConfig = function (settings) {
    const { store } = window
    // Old sync files omitted credentials and several provider fields.
    // Reuse a local account only when the endpoint and supplied fields match.
    if (!settings.baseURLAI || !settings.modelAI) {
      return migrateSettings(settings, store.aiConfigs, store.getLangName())
    }
    const matches = store.aiConfigs.filter(conf =>
      fields.every(key => !(key in settings) || settings[key] === conf[key])
    )
    const existing = matches.length === 1
      ? matches[0]
      : matches.find(conf => conf.id === store._config.activeAIConfigId)
    return migrateSettings(settings, store.aiConfigs, store.getLangName(), existing)
  }

  Store.prototype.migrateAIConfigs = async function (ext) {
    const { store } = window
    const history = safeGetItemJSON(historyKey)
    const settings = store.config
    const language = store.getLangName()
    const configs = [...ext.aiConfigs]
    const clean = migrateSettings(settings, configs, language)
    if (Array.isArray(history)) {
      for (const entry of history) {
        if (entry?.baseURLAI) findOrAdd(configs, entry, language)
      }
    }
    // The ordinary store watcher is asynchronous. Persist the new records
    // before removing either legacy source so a failed write can be retried.
    const added = configs.slice(ext.aiConfigs.length)
    if (added.length) {
      const rows = added.map(({ id, ...values }) => ({ _id: id, ...values }))
      const saved = await window.pre.runGlobalAsync('dbAction', 'aiConfigs', 'insert', rows)
      if (!saved) throw new Error('Could not migrate saved AI configurations')
    }
    ext.aiConfigs = configs
    if (fields.some(key => key in settings) || Array.isArray(history)) {
      clean.activeAIConfigId ||= configs[0]?.id || ''
      await window.pre.runGlobalAsync('saveUserConfig', clean)
      store._config = clean
      if (Array.isArray(history)) window.localStorage.removeItem(historyKey)
    }

    // A historical turn used to keep its own copy of the key and proxy.
    // Replace the whole row so both database adapters drop the old fields.
    let changed = false
    for (const entry of ext.aiChatHistory) {
      if (!('apiKeyAI' in entry || 'proxyAI' in entry)) continue
      const { id, apiKeyAI, proxyAI, ...turn } = entry
      const config = configs.find(conf =>
        conf.baseURLAI === turn.baseURLAI && conf.apiPathAI === turn.apiPathAI &&
        conf.modelAI === turn.modelAI && conf.apiKeyAI === (apiKeyAI || '') &&
        conf.proxyAI === (proxyAI || '')
      )
      if (config) turn.aiConfigId = config.id
      await window.pre.runGlobalAsync('dbAction', 'aiChatHistory', 'update', { _id: id }, turn)
      delete entry.apiKeyAI
      delete entry.proxyAI
      Object.assign(entry, turn)
      changed = true
    }
    if (changed) {
      await window.pre.runGlobalAsync('dbAction', 'aiChatHistory', 'compactDatafile')
    }
  }
}
