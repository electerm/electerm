const axios = require('axios')
const log = require('../common/log')
const defaultSettings = require('../common/config-default')

const createAIClient = (baseURL, apiKey) => {
  return axios.create({
    baseURL,
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`
    }
  })
}

exports.AIchat = async (
  prompt,
  model = defaultSettings.modelAI,
  role = defaultSettings.roleAI,
  baseURL = defaultSettings.baseURLAI,
  path = defaultSettings.apiPathAI,
  apiKey
) => {
  try {
    const client = createAIClient(baseURL, apiKey)
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
