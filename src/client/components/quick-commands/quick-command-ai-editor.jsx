/**
 * AI-powered quick command generator.
 *
 * This is the "create with AI" tab of the quick command form: describe the
 * quick command in natural language, the configured AI provider returns the
 * quick command (name + sub commands in JSON), and the result is written back
 * into the very same form through `onChange`, so the user reviews/edits it in
 * the manual tab before saving.
 */
import { useState, useEffect } from 'react'
import { Button, Input, Space, Alert } from 'antd'
import {
  RobotOutlined,
  LoadingOutlined
} from '@ant-design/icons'
import message from '../common/message'
import { appendMandatoryGuardrails } from '../ai/ai-guardrails'
import AiHistory, { addHistoryItem } from '../ai/ai-history.jsx'
import HelpIcon from '../common/help-icon'
import { getItem, setItem } from '../../common/safe-local-storage'
import templates from './templates'
import './quick-command-ai-editor.styl'

const STORAGE_KEY_DESC = 'ai_quick_command_description'
const STORAGE_KEY_HISTORY = 'ai_quick_command_history'
const EVENT_NAME_HISTORY = 'ai-quick-command-history-update'
const defaultDelay = 100
const maxDelay = 65535
const maxNameLength = 60
const { TextArea } = Input
const e = window.translate

const wiki = 'https://github.com/electerm/electerm/wiki/Create-quick-command-by-AI'

/**
 * build the prompt that asks the AI for one quick command definition
 * @param {string} description
 * @return {string}
 */
export function buildPrompt (description) {
  const lang = window.store.config.languageAI || window.store.getLangName()
  const templateList = templates.map(t => `{{${t}}}`).join(', ')
  return `You are an electerm quick command generator. Based on the user's natural language description, generate ONE quick command definition in JSON format.

The quick command JSON shape:
{
  "name": "string (required) - short name of the quick command",
  "commands": [
    {
      "name": "string - short name of this step",
      "command": "string (required) - the exact shell command to send to the terminal",
      "delay": "number - milliseconds to wait before sending this step, 1-${maxDelay}, default ${defaultDelay}"
    }
  ],
  "inputOnly": "boolean - true means only type the command into the terminal without pressing enter, default false",
  "labels": "array of strings - optional tags used to group quick commands"
}

Important rules:
1. Respond with ONE quick command object, never an array of quick commands
2. Split a multi step operation into several "commands" items, one shell command per item, and give a later step a longer "delay" when the step before it takes time
3. "command" must be a plain shell command, no markdown, no code fence, no trailing newline
4. Keep "name" short (max ${maxNameLength} chars) and write it in ${lang} language, labels included
5. You may use the built in templates ${templateList} inside a command when the user asks for clipboard content, current time or current date
6. Never invent hosts, paths, ports or credentials the user did not mention
7. Respond ONLY with valid JSON, no markdown formatting and no extra explanation

User description: ${description}

Generate the quick command JSON:`
}

function stripFence (str) {
  let s = str.trim()
  if (s.startsWith('```json')) {
    s = s.slice(7)
  } else if (s.startsWith('```')) {
    s = s.slice(3)
  }
  if (s.endsWith('```')) {
    s = s.slice(0, -3)
  }
  return s.trim()
}

/**
 * Normalize whatever the model returned into a quick command definition the
 * quick command form can consume. Tolerates markdown fences, prose around the
 * JSON, an array payload and string commands.
 * @param {string|object} raw
 * @return {object|null} {name, commands, inputOnly, labels}
 */
export function normalizeQuickCommand (raw) {
  if (!raw) {
    return null
  }
  let data = raw
  if (typeof data === 'string') {
    const txt = stripFence(data)
    try {
      data = JSON.parse(txt)
    } catch (err) {
      // the model sometimes wraps the JSON in explanation text
      const match = txt.match(/[{[][\s\S]*[}\]]/)
      if (!match) {
        return null
      }
      try {
        data = JSON.parse(match[0])
      } catch (err2) {
        return null
      }
    }
  }
  if (Array.isArray(data)) {
    data = data[0]
  }
  if (!data || typeof data !== 'object') {
    return null
  }
  const rawCommands = Array.isArray(data.commands)
    ? data.commands
    : (data.command ? [data] : [])
  const commands = rawCommands.map(c => {
    if (typeof c === 'string') {
      return {
        name: '',
        command: c,
        delay: defaultDelay
      }
    }
    const delay = Number(c.delay)
    return {
      name: (c.name || '').toString(),
      command: (c.command || c.cmd || '').toString(),
      delay: delay >= 1 ? Math.min(Math.round(delay), maxDelay) : defaultDelay
    }
  }).filter(c => c.command.trim())
  if (!commands.length) {
    return null
  }
  const name = (data.name || data.title || '').toString().trim()
  return {
    name: name || commands[0].command.slice(0, maxNameLength),
    commands,
    inputOnly: !!data.inputOnly,
    labels: Array.isArray(data.labels)
      ? data.labels.map(l => l.toString()).filter(Boolean)
      : []
  }
}

export default function QuickCommandAiEditor (props) {
  const { onChange } = props
  const [description, setDescription] = useState(() => getItem(STORAGE_KEY_DESC) || '')
  const [loading, setLoading] = useState(false)
  const [preview, setPreview] = useState('')

  useEffect(() => {
    setItem(STORAGE_KEY_DESC, description)
  }, [description])

  async function handleGenerate () {
    if (window.store.aiConfigMissing()) {
      window.store.toggleAIConfig()
      return
    }
    if (!description.trim()) {
      return message.warning(e('description') + ' ' + e('required'))
    }
    setLoading(true)
    try {
      const config = window.store.config
      const aiResponse = await window.pre.runGlobalAsync(
        'AIchat',
        buildPrompt(description),
        config.modelAI,
        appendMandatoryGuardrails('You are a helpful assistant that generates electerm quick commands.'),
        config.baseURLAI,
        config.apiPathAI,
        config.apiKeyAI,
        config.proxyAI,
        false, // disable streaming, we need the whole JSON at once
        config.authHeaderNameAI
      )
      if (aiResponse && aiResponse.error) {
        throw new Error(aiResponse.error)
      }
      const data = normalizeQuickCommand(aiResponse && aiResponse.response)
      if (!data) {
        throw new Error('no quick command found in AI response')
      }
      setPreview(JSON.stringify(data, null, 2))
      addHistoryItem(STORAGE_KEY_HISTORY, description, EVENT_NAME_HISTORY)
      onChange(data)
      message.success(e('Done'))
    } catch (err) {
      console.error('AI quick command generation error:', err)
      message.error('Can not generate quick command from AI response: ' + err.message)
    } finally {
      setLoading(false)
    }
  }

  const textAreaProps = {
    value: description,
    onChange: ev => setDescription(ev.target.value),
    placeholder: e('description'),
    autoSize: { minRows: 4, maxRows: 8 },
    disabled: loading
  }

  const generateBtnProps = {
    type: 'primary',
    onClick: handleGenerate,
    disabled: !description.trim(),
    icon: loading ? <LoadingOutlined /> : <RobotOutlined />,
    loading
  }

  return (
    <div className='qm-ai-editor'>
      <div className='pd1b'>
        <Alert
          type='info'
          showIcon
          title={e('aiSecurityNotice')}
        />
      </div>
      <div className='pd1b'>
        <TextArea {...textAreaProps} />
      </div>
      <AiHistory
        storageKey={STORAGE_KEY_HISTORY}
        eventName={EVENT_NAME_HISTORY}
        onSelect={setDescription}
      />
      <div className='pd1t'>
        <Space>
          <Button {...generateBtnProps}>
            {e('submit')}
          </Button>
          <HelpIcon link={wiki} />
        </Space>
      </div>
      {
        !!preview && (
          <div className='pd1t'>
            <pre className='qm-ai-preview'>{preview}</pre>
          </div>
        )
      }
    </div>
  )
}
