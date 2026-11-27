import { defaultAIPresets } from './ai-presets.js'

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

// Keep the original provider label even after a config is renamed or removed.
export function getAIHistoryConfig ({ id, nameAI, modelAI, roleAI, baseURLAI }) {
  return { aiConfigId: id, nameAI, modelAI, roleAI, baseURLAI }
}
