const { StringDecoder } = require('node:string_decoder')
const { buildRequest, FORMAT_OPENAI_RESPONSES } = require('./ai-format')

const PROVIDER_URLS = {
  chatgpt: 'https://api.openai.com/v1/responses',
  supergrok: 'https://api.x.ai/v1/responses'
}
const chatgptErrors = {
  subscription_sharing_user_not_eligible: 'This ChatGPT account is not eligible for subscription usage.',
  subscription_sharing_usage_limit_exceeded: 'The ChatGPT subscription usage limit has been reached.',
  subscription_sharing_usage_unavailable: 'ChatGPT subscription usage is temporarily unavailable.',
  subscription_sharing_unsupported_capability: 'This feature is not available through ChatGPT subscription usage.',
  subscription_sharing_route_not_supported: 'This request route is not supported for ChatGPT subscription usage.'
}

function usageFromResponse (response) {
  const usage = response && response.usage
  if (!usage) return null
  const promptTokens = Number(usage.input_tokens) || 0
  const completionTokens = Number(usage.output_tokens) || 0
  const totalTokens = Number(usage.total_tokens) || promptTokens + completionTokens
  return totalTokens ? { promptTokens, completionTokens, totalTokens } : null
}

function createSubscriptionProvider ({ http = require('axios'), getAccessToken, createProxyAgent }) {
  const controllers = new Map()

  async function consume (stream, providerAI, onContent) {
    const decoder = new StringDecoder('utf8')
    let buffer = ''
    let content = ''
    let completedResponse
    let error
    const calls = new Map()

    function event (data) {
      if (!data || typeof data !== 'object') throw new Error('Malformed Responses event')
      if (data.type === 'response.output_text.delta') content += data.delta || ''
      if (data.type === 'response.output_text.delta' && onContent) onContent(content)
      if (data.type === 'response.output_item.added' || data.type === 'response.output_item.done') {
        const item = data.item
        if (item && item.type === 'function_call') {
          const call = calls.get(item.id) || calls.get(item.call_id) || {
            id: item.call_id || item.id,
            type: 'function',
            function: { name: '', arguments: '' }
          }
          call.id = item.call_id || item.id
          call.function.name = item.name || call.function.name
          if (item.arguments) call.function.arguments = item.arguments
          calls.set(item.id, call)
          if (item.call_id) calls.set(item.call_id, call)
        }
      }
      if (data.type === 'response.function_call_arguments.delta') {
        const id = data.call_id || data.item_id || ''
        let call = calls.get(id)
        if (!call) {
          call = { id, type: 'function', function: { name: data.name || '', arguments: '' } }
          calls.set(id, call)
        }
        call.function.arguments += data.delta || ''
      }
      if (data.type === 'response.completed') completedResponse = data.response || data
      if (data.type === 'response.failed' || data.type === 'error') {
        const providerError = (data.response && data.response.error) || data.error || {}
        error = providerAI === 'chatgpt'
          ? (chatgptErrors[providerError.code] || 'ChatGPT subscription request failed')
          : 'SuperGrok request failed'
      }
    }

    for await (const chunk of stream) {
      buffer += decoder.write(chunk)
      const lines = buffer.split(/\r?\n/)
      buffer = lines.pop() || ''
      for (const line of lines) {
        const trimmed = line.trim()
        if (!trimmed.startsWith('data:')) continue
        const payload = trimmed.slice(5).trim()
        if (!payload || payload === '[DONE]') continue
        try { event(JSON.parse(payload)) } catch (e) { error = 'Malformed Responses event' }
      }
    }
    buffer += decoder.end()
    if (buffer.trim().startsWith('data:')) {
      try { event(JSON.parse(buffer.trim().slice(5).trim())) } catch (_) { error = 'Malformed Responses event' }
    }
    if (error) throw new Error(error)
    if (!completedResponse) throw new Error('Responses stream ended before response.completed')
    if (completedResponse.status && completedResponse.status !== 'completed') throw new Error('Responses stream did not complete successfully')
    const text = content || completedResponse.output_text || ''
    const toolCalls = Array.from(new Set(calls.values()))
    if (!text && !toolCalls.length) throw new Error('Completed Responses stream contained no output')
    const message = { role: 'assistant', content: text || null }
    if (toolCalls.length) message.tool_calls = toolCalls
    return { message, usage: usageFromResponse(completedResponse) }
  }

  return {
    async chat ({ providerAI, messages, model, tools, proxy, requestId, onContent }) {
      const url = PROVIDER_URLS[providerAI]
      if (!url) return { error: 'Unsupported subscription provider' }
      const controller = new AbortController()
      if (requestId) controllers.set(requestId, controller)
      try {
        const token = await getAccessToken(providerAI, proxy)
        const body = buildRequest(FORMAT_OPENAI_RESPONSES, { model, messages, tools, stream: true })
        body.store = false
        const options = {
          headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
          responseType: 'stream',
          signal: controller.signal,
          timeout: 0
        }
        const agent = proxy && createProxyAgent ? createProxyAgent(proxy) : null
        if (agent) {
          options.httpAgent = agent
          options.httpsAgent = agent
          options.proxy = false
        }
        const response = await http.post(url, body, options)
        return await consume(response.data, providerAI, onContent)
      } catch (error) {
        if (controller.signal.aborted) return { aborted: true }
        const status = error.response && error.response.status
        return { error: status ? `Subscription request failed (${status})` : (error.message || 'Subscription request failed') }
      } finally {
        if (requestId) controllers.delete(requestId)
      }
    },
    abort (requestId) {
      const controller = controllers.get(requestId)
      if (!controller) return { error: 'Request not found' }
      controller.abort()
      return { aborted: true }
    }
  }
}

module.exports = { createSubscriptionProvider, PROVIDER_URLS, usageFromResponse }
