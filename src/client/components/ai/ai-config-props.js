export const aiConfigsArr = [
  'nameAI',
  'baseURLAI',
  'modelAI',
  'roleAI',
  'apiKeyAI',
  'authHeaderNameAI',
  'apiPathAI',
  'languageAI',
  'proxyAI',
  'contextLengthAI'
]

// Keys that may legitimately be empty. `aiConfigMissing` only forces the
// config modal open when one of the *other* keys is unset, so anything
// optional has to be listed here or the modal would pop up forever.
export const optionalAIConfigsArr = [
  'apiKeyAI',
  'proxyAI',
  'nameAI',
  'contextLengthAI'
]

export {
  defaultAIPresets,
  getAIPresets
} from './ai-presets'
