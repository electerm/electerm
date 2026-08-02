/**
 * AI-powered terminal theme generator.
 * Lets the user describe a theme in natural language, asks the configured AI
 * provider for a full color palette, and writes the result back into the
 * theme form as editable theme text.
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
import {
  requiredThemeProps,
  validThemeProps,
  convertTheme,
  convertThemeToText
} from '../../common/terminal-theme'

const STORAGE_KEY_DESC = 'ai_theme_description'
const STORAGE_KEY_HISTORY = 'ai_theme_history'
const EVENT_NAME_HISTORY = 'ai-theme-history-update'
const { TextArea } = Input
const e = window.translate

// Human readable description for every required theme prop, so the model knows
// exactly what each key controls and which format to use.
const themePropDescriptions = {
  main: 'main UI background color (hex #rrggbb)',
  'main-dark': 'darker variant of the main color (hex)',
  'main-light': 'lighter variant of the main color (hex)',
  text: 'main UI text color (hex)',
  'text-light': 'lighter variant of the text color (hex)',
  'text-dark': 'darker variant of the text color (hex)',
  'text-disabled': 'disabled text color (hex)',
  primary: 'primary accent color for buttons/links (hex)',
  info: 'info status color (hex)',
  success: 'success status color (hex)',
  error: 'error status color (hex)',
  warn: 'warning status color (hex)',
  'terminal:foreground': 'default terminal text color (hex or rgba)',
  'terminal:background': 'terminal background color, should relate to main (hex or rgba)',
  'terminal:cursor': 'terminal cursor color (hex or rgba)',
  'terminal:cursorAccent': 'terminal cursor accent color (hex or rgba)',
  'terminal:selectionBackground': 'terminal text selection background (rgba recommended)',
  'terminal:black': 'ANSI color 0 - black (hex)',
  'terminal:red': 'ANSI color 1 - red (hex)',
  'terminal:green': 'ANSI color 2 - green (hex)',
  'terminal:yellow': 'ANSI color 3 - yellow (hex)',
  'terminal:blue': 'ANSI color 4 - blue (hex)',
  'terminal:magenta': 'ANSI color 5 - magenta (hex)',
  'terminal:cyan': 'ANSI color 6 - cyan (hex)',
  'terminal:white': 'ANSI color 7 - white (hex)',
  'terminal:brightBlack': 'ANSI bright color 8 - bright black (hex)',
  'terminal:brightRed': 'ANSI bright color 9 - bright red (hex)',
  'terminal:brightGreen': 'ANSI bright color 10 - bright green (hex)',
  'terminal:brightYellow': 'ANSI bright color 11 - bright yellow (hex)',
  'terminal:brightBlue': 'ANSI bright color 12 - bright blue (hex)',
  'terminal:brightMagenta': 'ANSI bright color 13 - bright magenta (hex)',
  'terminal:brightCyan': 'ANSI bright color 14 - bright cyan (hex)',
  'terminal:brightWhite': 'ANSI bright color 15 - bright white (hex)'
}

/**
 * build the prompt that asks the AI for a complete theme
 * @param {string} description
 * @return {string}
 */
function buildThemePrompt (description) {
  const lang = window.store.config.languageAI || window.store.getLangName()
  const fieldList = requiredThemeProps
    .map(key => `  ${key}=${themePropDescriptions[key] || 'color value'}`)
    .join('\n')
  return `You are an electerm terminal theme color generator. Based on the user's natural language description, generate a complete and harmonious color palette by filling in EVERY color listed below.

The theme uses a key=value format (one per line). UI colors use hex (#rrggbb). Terminal colors use hex or rgba. The palette should be cohesive, readable and accessible (keep good contrast between foreground and background).

Required keys (you MUST fill ALL of them):
${fieldList}

Important rules:
1. Output ONLY the key=value lines, no markdown code fences, no comments, no extra text
2. Use exactly the key names listed above
3. terminal:background should match or relate to main
4. terminal:foreground must contrast well with terminal:background
5. Provide distinct, harmonious ANSI 16 colors for the terminal palette
6. If you include any description text, reply in ${lang} language (but prefer no extra text at all)

User description: ${description}

Generate the theme:`
}

/**
 * Normalize whatever the model returned into clean, valid theme text.
 * Strips markdown fences and drops any key that is not a supported theme prop.
 * @param {string|object} raw
 * @return {string}
 */
function normalizeGeneratedTheme (raw) {
  if (!raw) {
    return ''
  }
  let str = typeof raw === 'string' ? raw : JSON.stringify(raw)
  str = str.trim()
  if (str.startsWith('```theme')) {
    str = str.slice(8)
  } else if (str.startsWith('```')) {
    str = str.slice(3)
  }
  if (str.endsWith('```')) {
    str = str.slice(0, -3)
  }
  str = str.trim()
  const converted = convertTheme(str)
  const uiThemeConfig = {}
  const themeConfig = {}
  for (const [key, value] of Object.entries(converted.uiThemeConfig)) {
    if (validThemeProps.includes(key)) {
      uiThemeConfig[key] = value
    }
  }
  for (const [key, value] of Object.entries(converted.themeConfig)) {
    if (validThemeProps.includes('terminal:' + key)) {
      themeConfig[key] = value
    }
  }
  return convertThemeToText({ themeConfig, uiThemeConfig })
}

export default function ThemeAiEditor (props) {
  const { onChange, disabled } = props
  const [description, setDescription] = useState(() => getItem(STORAGE_KEY_DESC) || '')
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    setItem(STORAGE_KEY_DESC, description)
  }, [description])

  async function handleGenerate () {
    if (disabled) {
      return
    }
    if (window.store.aiConfigMissing()) {
      window.store.toggleAIConfig()
      return
    }
    if (!description.trim()) {
      return message.warning(e('description') + ' required')
    }
    setLoading(true)
    try {
      const config = window.store.config
      const prompt = buildThemePrompt(description)
      const aiResponse = await window.pre.runGlobalAsync(
        'AIchat',
        prompt,
        config.modelAI,
        appendMandatoryGuardrails('You are a helpful assistant that generates electerm terminal theme color palettes.'),
        config.baseURLAI,
        config.apiPathAI,
        config.apiKeyAI,
        config.proxyAI,
        false, // disable streaming for a structured response
        config.authHeaderNameAI
      )
      if (aiResponse && aiResponse.error) {
        throw new Error(aiResponse.error)
      }
      const text = normalizeGeneratedTheme(aiResponse && aiResponse.response)
      if (!text || !text.trim()) {
        throw new Error('empty response')
      }
      onChange(text)
      addHistoryItem(STORAGE_KEY_HISTORY, description, EVENT_NAME_HISTORY)
      message.success(e('Done'))
    } catch (err) {
      console.error('AI theme generation error:', err)
      message.error('Can not generate theme from AI response: ' + err.message)
    } finally {
      setLoading(false)
    }
  }

  const textAreaProps = {
    value: description,
    onChange: ev => setDescription(ev.target.value),
    placeholder: e('createThemeByAI'),
    autoSize: { minRows: 4, maxRows: 8 },
    disabled: loading || disabled
  }

  const generateBtnProps = {
    type: 'primary',
    onClick: handleGenerate,
    disabled: !description.trim() || disabled,
    icon: loading ? <LoadingOutlined /> : <RobotOutlined />,
    loading
  }

  return (
    <div className='theme-ai-editor'>
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
            {e('generate')}
          </Button>
          <HelpIcon link='https://github.com/electerm/electerm/wiki/Create-theme-by-AI' />
        </Space>
      </div>
    </div>
  )
}
