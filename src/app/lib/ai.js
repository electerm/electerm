const axios = require('axios')
const log = require('../common/log')
const defaultSettings = require('../common/config-default')
const { createProxyAgent } = require('./proxy-agent')

const createAIClient = (baseURL, apiKey, proxy) => {
  const config = {
    baseURL,
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`
    }
  }

  // Add proxy agent if proxy is provided
  const agent = proxy ? createProxyAgent(proxy) : null
  if (agent) {
    config.httpsAgent = agent
    config.proxy = false // Disable default proxy behavior when using agent
  }

  return axios.create(config)
}

exports.AIchat = async (
  prompt,
  model = defaultSettings.modelAI,
  role = defaultSettings.roleAI,
  baseURL = defaultSettings.baseURLAI,
  path = defaultSettings.apiPathAI,
  apiKey,
  proxy = defaultSettings.proxyAI
) => {
  try {
    const client = createAIClient(baseURL, apiKey, proxy)
    const response = await client.post(path, {
      model,
      messages: [
        {
          role: 'system',
          content: role
        },
        {
          role: 'user',
          content: prompt
        }
      ]
    })

    return {
      response: response.data.choices[0].message.content
    }
  } catch (e) {
    log.error('AI chat error')
    log.error(e)
    return {
      error: e.message,
      stack: e.stack
    }
  }
}
