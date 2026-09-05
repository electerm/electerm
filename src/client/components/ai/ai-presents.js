export const defaultAIPresets = [
  {
    id: 'atlascloud',
    nameAI: 'AtlasCloud',
    baseURLAI: 'https://api.atlascloud.ai/v1',
    apiPathAI: '/chat/completions',
    modelAI: 'deepseek-ai/deepseek-v4-flash',
    authHeaderNameAI: 'Authorization: Bearer',
    siteUrl: 'https://www.atlascloud.ai?ref=PCAEL2',
    modelAIs: [
      { value: 'deepseek-ai/deepseek-v4-flash' },
      { value: 'zai-org/GLM-5.3' },
      { value: 'moonshotai/Kimi-K3' }
    ]
  },
  {
    id: 'siliconflow',
    nameAI: 'SiliconFlow',
    baseURLAI: 'https://api.siliconflow.cn/v1',
    apiPathAI: '/chat/completions',
    modelAI: 'deepseek-ai/DeepSeek-V4-Flash',
    authHeaderNameAI: 'Authorization: Bearer',
    siteUrl: 'https://cloud.siliconflow.cn/i/Xa85Yz6R'
  },
  {
    id: 'ApiSmart',
    nameAI: 'ApiSmart',
    baseURLAI: 'https://api.apismart.ai/v1',
    apiPathAI: '/chat/completions',
    modelAI: 'DEEPSEEK_V4_FLASH',
    authHeaderNameAI: 'Authorization: Bearer',
    siteUrl: 'https://apismart.ai/?utm_source=electerm_app&utm_medium=link&utm_campaign=electerm'
  },
  {
    id: 'apimart',
    nameAI: 'ApiMart',
    baseURLAI: 'https://api.apimart.ai/v1',
    apiPathAI: '/chat/completions',
    modelAI: 'deepseek-v4-flash',
    authHeaderNameAI: 'Authorization: Bearer',
    siteUrl: 'https://go.apimart.ai/gh-electerm'
  },
  {
    id: 'deepseek',
    nameAI: 'DeepSeek',
    baseURLAI: 'https://api.deepseek.com/v1',
    apiPathAI: '/chat/completions',
    modelAI: 'deepseek-chat',
    authHeaderNameAI: 'Authorization: Bearer',
    siteUrl: 'https://platform.deepseek.com/api_keys?utm_source=electerm_app&utm_medium=link&utm_campaign=electerm'
  },
  {
    id: 'openai',
    nameAI: 'OpenAI',
    baseURLAI: 'https://api.openai.com/v1',
    apiPathAI: '/chat/completions',
    modelAI: 'gpt-4o',
    authHeaderNameAI: 'Authorization: Bearer',
    siteUrl: 'https://platform.openai.com/api-keys?utm_source=electerm_app&utm_medium=link&utm_campaign=electerm'
  },
  {
    id: 'openrouter',
    nameAI: 'OpenRouter',
    baseURLAI: 'https://openrouter.ai/api/v1',
    apiPathAI: '/chat/completions',
    modelAI: 'openai/gpt-4o-mini',
    authHeaderNameAI: 'Authorization: Bearer',
    siteUrl: 'https://openrouter.ai/keys?utm_source=electerm_app&utm_medium=link&utm_campaign=electerm'
  },
  {
    id: 'orcarouter',
    nameAI: 'OrcaRouter',
    baseURLAI: 'https://api.orcarouter.ai/v1',
    apiPathAI: '/chat/completions',
    modelAI: 'orcarouter/free',
    authHeaderNameAI: 'Authorization: Bearer',
    siteUrl: 'https://www.orcarouter.ai/ref/ref_2c4884ca28b88a82593f'
  },
  {
    id: 'google',
    nameAI: 'Google Gemini',
    baseURLAI: 'https://generativelanguage.googleapis.com/v1beta/openai',
    apiPathAI: '/chat/completions',
    modelAI: 'gemini-2.0-flash',
    authHeaderNameAI: 'Authorization: Bearer',
    siteUrl: 'https://aistudio.google.com/apikey'
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
  }
]

export function getAIPresets () {
  const presets = [...defaultAIPresets]
  if (window.et?.defaultAIPreset) {
    presets.unshift(window.et.defaultAIPreset)
  }
  return presets
}
