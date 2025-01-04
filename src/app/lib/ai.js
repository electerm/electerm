/**
 * AI integration with DeepSeek API
 */
const OpenAI = require('openai')
const { getConfig } = require('./get-config')
const log = require('../common/log')

const DEFAULT_SYSTEM_ROLE = `You are a terminal command expert.
- Provide clear, safe, and efficient shell commands
- Always explain what each command does
- Warn about potentially dangerous operations
- Format command output with markdown code blocks
- If multiple steps are needed, number them
- Mention any prerequisites or dependencies
- Include common flags and options
- Specify which OS (Linux/Mac/Windows) the command is for`

// Initialize OpenAI with DeepSeek configuration
const initAIClient = async () => {
  try {
    const { config } = await getConfig()
    const { apiKey } = config

    if (!apiKey) {
      return null
    }

    return new OpenAI({
      baseURL: 'https://api.deepseek.com',
      apiKey
    })
  } catch (e) {
    log.error('AI client init error')
    log.error(e)
    return null
  }
}

exports.chat = async (
  prompt,
  model = 'deepseek-chat',
  role = 'You are a helpful assistant.'
) => {
  try {
    const client = await initAIClient()
    if (!client) {
      return {
        error: 'AI not configured. Please set API key in settings.'
      }
    }

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
      error: e.message
    }
  }
}
