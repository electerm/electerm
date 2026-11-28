import { defaultAIPresets, requiresAIKey } from './ai-presets.js'

const { nameAI, baseURLAI, modelAI, apiPathAI, authHeaderNameAI } = defaultAIPresets[0]

// The renderer and the Electron backend also ship as standalone packages.
export const aiConfigDefaults = {
  nameAI,
  baseURLAI,
  modelAI,
  apiPathAI,
  authHeaderNameAI,
  roleAI: '终端专家,提供不同系统下命令,简要解释用法,用markdown格式',
  apiKeyAI: '',
  proxyAI: '',
  languageAI: '',
  contextLengthAI: null
}

export function isAIConfigMissing (config) {
  if (!config) return true
  const required = ['baseURLAI', 'apiPathAI', 'modelAI', 'roleAI', 'authHeaderNameAI', 'languageAI']
  if (requiresAIKey(config.baseURLAI)) required.push('apiKeyAI')
  return required.some(key => typeof config[key] !== 'string' || !config[key].trim())
}

// Keep the original provider label even after a config is renamed or removed.
export function getAIHistoryConfig (config) {
  if (!config) return {}
  const { id, nameAI, modelAI, roleAI, baseURLAI } = config
  return { aiConfigId: id, nameAI, modelAI, roleAI, baseURLAI }
}
