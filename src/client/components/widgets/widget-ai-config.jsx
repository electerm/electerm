/**
 * "This widget can configure electerm's AI settings" block.
 *
 * Shown when a widget result carries an `aiConfig` (a run result, so it travels
 * with the instance, or an action result in the config-mode panel). The widget
 * only proposes: the values are listed here and the user applies them. Pointing
 * electerm's AI panel at an endpoint is never something that happened behind
 * their back — which is the whole reason this is a button and not a side effect
 * of starting a widget.
 *
 * The values arrive already whitelisted and trimmed by the main process
 * (app/widgets/ai-config.js), so this file only has to show them.
 */
import React, { useState } from 'react'
import { Button, Tag, Tooltip } from 'antd'
import {
  CopyOutlined,
  EyeInvisibleOutlined,
  EyeOutlined
} from '@ant-design/icons'
import { auto } from 'manate/react'
import { copy } from '../../common/clipboard'
import message from '../common/message'
import { matchesWidgetAIConfig } from '../../common/ai-feature'

const e = window.translate

const ROWS = [
  ['nameAI', 'Name'],
  ['baseURLAI', 'API URL'],
  ['apiPathAI', 'API PATH'],
  ['apiKeyAI', 'API key', true],
  ['authHeaderNameAI', 'Auth header'],
  ['modelAI', 'Model'],
  ['proxyAI', 'Proxy']
]

function Secret ({ value }) {
  const [revealed, setRevealed] = useState(false)
  return (
    <span className='wac-secret'>
      <span className='wac-secret-text elli' title={revealed ? value : ''}>
        {revealed ? value : '•'.repeat(Math.min(value.length, 12))}
      </span>
      <Button
        size='small'
        type='text'
        icon={revealed ? <EyeInvisibleOutlined /> : <EyeOutlined />}
        onClick={() => setRevealed(v => !v)}
      />
      <Button
        size='small'
        type='text'
        icon={<CopyOutlined />}
        onClick={() => {
          copy(value)
          message.success(e('copied'))
        }}
      />
    </span>
  )
}

function WidgetConfigValue ({ value, secret }) {
  if (!value) return e('notSet')
  if (secret) return <Secret value={value} />
  return (
    <>
      <span className='elli' title={value}>{value}</span>
      <Button
        size='small'
        type='text'
        icon={<CopyOutlined />}
        onClick={() => {
          copy(value)
          message.success(e('copied'))
        }}
      />
    </>
  )
}

export default auto(function WidgetAIConfig ({ aiConfig, store }) {
  if (!aiConfig) {
    return null
  }
  const config = store.activeAIConfig || {}
  const applied = matchesWidgetAIConfig(config, aiConfig)

  const apply = () => {
    store.applyWidgetAIConfig(aiConfig)
  }

  return (
    <div className='wac'>
      <div className='wac-head'>
        <span className='wac-title'>Electerm AI settings</span>
        {applied ? <Tag color='green'>in use</Tag> : null}
      </div>
      <p className='wac-desc'>
        Apply a matching saved AI configuration or create one from these settings.
      </p>
      <div className='wac-rows'>
        {ROWS.filter(([key]) => key in aiConfig || key === 'apiKeyAI' || key === 'proxyAI').map(([key, label, secret]) => (
          <div className='wac-row' key={key}>
            <span className='wac-label'>{label}</span>
            <span className='wac-value'>
              <WidgetConfigValue value={aiConfig[key]} secret={secret} />
            </span>
          </div>
        ))}
      </div>
      <Tooltip title={applied ? 'Already applied' : ''}>
        <Button
          type='primary'
          size='small'
          disabled={applied}
          onClick={apply}
        >
          {applied ? 'Applied' : 'Use these settings'}
        </Button>
      </Tooltip>
    </div>
  )
})
