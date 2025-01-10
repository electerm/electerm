/**
 * AI integration with DeepSeek API
 */
const OpenAI = require('openai')
const log = require('../common/log')
const defaultSettings = require('../common/config-default')

// Initialize OpenAI with DeepSeek configuration
const initAIClient = async (config) => {
  return new OpenAI(config)
}

exports.AIchat = async (
  prompt,
  model = defaultSettings.modelAI,
  role = defaultSettings.roleAI,
  baseURL = defaultSettings.baseURLAI,
  apiKey
) => {
  try {
    const client = await initAIClient({
      baseURL,
      apiKey
    })
    const completion = await client.chat.completions.create({
      messages: [
        {
          role: 'system',
          content: role
        },
        {
          role: 'user',
          content: prompt
        }
      ],
      model
    })

    return {
      response: completion.choices[0].message.content
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
