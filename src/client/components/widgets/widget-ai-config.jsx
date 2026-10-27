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

function inUse (config, aiConfig) {
  const keys = Object.keys(aiConfig)
  return keys.length > 0 && keys.every(key => (config[key] || '') === aiConfig[key])
}

function Secret ({ value }) {
  const [revealed, setRevealed] = useState(false)
  return (
    <span className='wac-secret'>
      <span className='wac-secret-text elli' title={revealed ? value : ''}>
        {revealed ? value : '•'.repeat(Math.min(value.length || 8, 12))}
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

export default auto(function WidgetAIConfig ({ aiConfig, store }) {
  if (!aiConfig) {
    return null
  }
  const config = store.config
  const applied = inUse(config, aiConfig)

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
        This widget can point electerm's AI panel at itself. Nothing changes until you press the
        button; the values below are exactly what gets written to Settings → AI.
      </p>
      <div className='wac-rows'>
        {ROWS.filter(([key]) => aiConfig[key]).map(([key, label, secret]) => (
          <div className='wac-row' key={key}>
            <span className='wac-label'>{label}</span>
            <span className='wac-value'>
              {secret
                ? <Secret value={aiConfig[key]} />
                : (
                  <>
                    <span className='elli' title={aiConfig[key]}>{aiConfig[key]}</span>
                    <Button
                      size='small'
                      type='text'
                      icon={<CopyOutlined />}
                      onClick={() => {
                        copy(aiConfig[key])
                        message.success(e('copied'))
                      }}
                    />
                  </>
                  )}
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
