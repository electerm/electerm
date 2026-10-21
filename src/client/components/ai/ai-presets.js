export const defaultAIPresets = [
  {
    id: 'packycode',
    nameAI: 'PackyCode',
    baseURLAI: 'https://cf.api.fan/v1',
    apiPathAI: '/chat/completions',
    modelAI: 'deepseek-flash',
    authHeaderNameAI: 'Authorization: Bearer',
    siteUrl: 'https://www.packyapi.ai/register?aff=DOZI',
    modelAIs: [
      { value: 'deepseek-flash' },
      { value: 'deepseek-v4-pro' }
    ]
  },
  {
    id: 'fluxionai',
    nameAI: 'Sidrune',
    baseURLAI: 'https://sidrune.ai/v1',
    apiPathAI: '/chat/completions',
    modelAI: 'deepseek-v4-flash-0731',
    authHeaderNameAI: 'Authorization: Bearer',
    siteUrl: 'https://fluxionai.space/register?source=github&campaign=github-sidrune-electerm&promo=SDRELECTERM&aff=7H7DERHU3GFF'
  },
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
    id: 'anthropic',
    nameAI: 'Anthropic Claude',
    baseURLAI: 'https://api.anthropic.com/v1',
    apiPathAI: '/messages',
    modelAI: 'claude-sonnet-4-5',
    authHeaderNameAI: 'x-api-key',
    modelAIs: [
      { value: 'claude-sonnet-4-5' },
      { value: 'claude-opus-4-1' },
      { value: 'claude-haiku-4-5' }
    ],
    siteUrl: 'https://console.anthropic.com/settings/keys?utm_source=electerm_app&utm_medium=link&utm_campaign=electerm'
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
    id: 'minimax-global',
    nameAI: 'MiniMax (Global)',
    baseURLAI: 'https://api.minimax.io/v1',
    apiPathAI: '/chat/completions',
    modelAI: 'MiniMax-M3.1-Flash',
    authHeaderNameAI: 'Authorization: Bearer',
    // MiniMax returns retired models next to the current ones, so the preset
    // keeps its own suggestions instead of the fetched/cached list.
    ignoreCachedModels: true,
    modelAIs: [
      { value: 'MiniMax-M3.1-Flash' },
      { value: 'MiniMax-M3' }
    ],
    siteUrl: 'https://platform.minimax.io/user-center/basic-information/interface-key?utm_source=electerm_app&utm_medium=link&utm_campaign=electerm'
  },
  {
    id: 'minimax-cn',
    nameAI: 'MiniMax (China)',
    baseURLAI: 'https://api.minimax.cn/v1',
    // The same endpoint is documented under the older minimaxi.com host.
    aliasURLs: ['https://api.minimaxi.com/v1'],
    apiPathAI: '/chat/completions',
    modelAI: 'MiniMax-M3.1-Flash',
    authHeaderNameAI: 'Authorization: Bearer',
    ignoreCachedModels: true,
    modelAIs: [
      { value: 'MiniMax-M3.1-Flash' },
      { value: 'MiniMax-M3' }
    ],
    siteUrl: 'https://platform.minimaxi.com/user-center/basic-information/interface-key?utm_source=electerm_app&utm_medium=link&utm_campaign=electerm'
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

export function normalizeAIBaseURL (url) {
  return (url || '').trim().replace(/\/+$/, '')
}

function presetForURL (url) {
  return defaultAIPresets.find(p =>
    p.baseURLAI === url || (p.aliasURLs || []).includes(url))
}

// Suggestions do not constrain the editable model value or saved configurations.
// `fetched` marks a list that just came back from the API: an explicit refresh
// is the user asking for the real list, so it is merged even for presets that
// ignore cached lists. A cached list is not trusted the same way, because it can
// still hold models the provider retired since it was saved.
export function getAIModelOptions (baseURL, preset, cachedModels = [], fetched = false) {
  const target = presetForURL(normalizeAIBaseURL(baseURL)) || preset
  const presetModels = (target?.modelAIs || [])
    .map(o => (typeof o === 'string' ? o : o.value))
  const values = target?.ignoreCachedModels && !fetched
    ? presetModels
    : [...presetModels, ...cachedModels]
  return [...new Set(values.filter(Boolean))].map(value => ({ value }))
}

export function getAIPresets () {
  const presets = [...defaultAIPresets]
  const customPreset = window.et?.defaultAIPreset
  if (customPreset) {
    // keep the first preset (sponsor) on top, insert after it
    presets.splice(1, 0, customPreset)
  }
  return presets
}
