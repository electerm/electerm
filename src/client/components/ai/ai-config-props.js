export const aiConfigsArr = [
  'nameAI',
  'baseURLAI',
  'modelAI',
  'roleAI',
  'apiKeyAI',
  'authHeaderNameAI',
  'apiPathAI',
  'languageAI',
  'proxyAI'
]

export const defaultAIPresets = [
  {
    id: 'atlascloud',
    nameAI: 'AtlasCloud',
    baseURLAI: 'https://api.atlascloud.ai/v1',
    apiPathAI: '/chat/completions',
    modelAI: 'deepseek-ai/deepseek-v4-flash',
    authHeaderNameAI: 'Authorization: Bearer'
  },
  {
    id: 'deepseek',
    nameAI: 'DeepSeek',
    baseURLAI: 'https://api.deepseek.com/v1',
    apiPathAI: '/chat/completions',
    modelAI: 'deepseek-chat',
    authHeaderNameAI: 'Authorization: Bearer'
  },
  {
    id: 'openai',
    nameAI: 'OpenAI',
    baseURLAI: 'https://api.openai.com/v1',
    apiPathAI: '/chat/completions',
    modelAI: 'gpt-4o',
    authHeaderNameAI: 'Authorization: Bearer'
  },
  {
    id: 'openrouter',
    nameAI: 'OpenRouter',
    baseURLAI: 'https://openrouter.ai/api/v1',
    apiPathAI: '/chat/completions',
    modelAI: 'openai/gpt-4o-mini',
    authHeaderNameAI: 'Authorization: Bearer'
  },
  {
    id: 'google',
    nameAI: 'Google Gemini',
    baseURLAI: 'https://generativelanguage.googleapis.com/v1beta/openai',
    apiPathAI: '/chat/completions',
    modelAI: 'gemini-2.0-flash',
    authHeaderNameAI: 'Authorization: Bearer'
  },
  {
    id: 'groq',
    nameAI: 'Groq',
    baseURLAI: 'https://api.groq.com/openai/v1',
    apiPathAI: '/chat/completions',
    modelAI: 'llama-3.3-70b-versatile',
    authHeaderNameAI: 'Authorization: Bearer'
  },
  {
    id: 'together',
    nameAI: 'Together AI',
    baseURLAI: 'https://api.together.xyz/v1',
    apiPathAI: '/chat/completions',
    modelAI: 'meta-llama/Llama-3.3-70B-Instruct-Turbo',
    authHeaderNameAI: 'Authorization: Bearer'
  },
  {
    id: 'mistral',
    nameAI: 'Mistral AI',
    baseURLAI: 'https://api.mistral.ai/v1',
    apiPathAI: '/chat/completions',
    modelAI: 'mistral-large-latest',
    authHeaderNameAI: 'Authorization: Bearer'
  },
  {
    id: 'xai',
    nameAI: 'xAI (Grok)',
    baseURLAI: 'https://api.x.ai/v1',
    apiPathAI: '/chat/completions',
    modelAI: 'grok-3-mini',
    authHeaderNameAI: 'Authorization: Bearer'
  },
  {
    id: 'perplexity',
    nameAI: 'Perplexity',
    baseURLAI: 'https://api.perplexity.ai',
    apiPathAI: '/chat/completions',
    modelAI: 'sonar',
    authHeaderNameAI: 'Authorization: Bearer'
  },
  {
    id: 'moonshot',
    nameAI: 'Moonshot (Kimi)',
    baseURLAI: 'https://api.moonshot.cn/v1',
    apiPathAI: '/chat/completions',
    modelAI: 'moonshot-v1-8k',
    authHeaderNameAI: 'Authorization: Bearer'
  },
  {
    id: 'siliconflow',
    nameAI: 'SiliconFlow',
    baseURLAI: 'https://api.siliconflow.cn/v1',
    apiPathAI: '/chat/completions',
    modelAI: 'deepseek-ai/DeepSeek-V3',
    authHeaderNameAI: 'Authorization: Bearer'
  }
]

export function getAIPresets () {
  const presets = [...defaultAIPresets]
  if (window.et?.defaultAIPreset) {
    presets.unshift(window.et.defaultAIPreset)
  }
  return presets
}
