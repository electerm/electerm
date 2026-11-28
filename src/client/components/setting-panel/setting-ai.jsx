import { useSyncExternalStore } from 'react'
import { Button, Flex } from 'antd'
import { getAIConfigsLabel } from '../../common/ai-feature'
import AgentApprovalModeSelect from '../ai/agent-approval-mode-select'
import ActiveAIConfigSelect from '../ai/active-ai-config-select'
import { agentCommandLimit, parseAgentCommandLines } from '../ai/agent-permissions'
import {
  permissionSaveError,
  readAgentCommandAllowlist,
  setAgentCommandAllowlist,
  subscribeAgentPermissions
} from '../ai/agent-permission-preferences'
import message from '../common/message'
import SwitchLabel from '../common/switch'
import TextareaConfirm from '../common/textarea-confirm'

const e = window.translate

function readCommandLines () {
  return readAgentCommandAllowlist().join('\n')
}

export default function SettingAI ({ autoCompress }) {
  const commands = useSyncExternalStore(subscribeAgentPermissions, readCommandLines)
  return (
    <div className='form-wrap pd1y pd2x'>
      <h2>AI</h2>
      <Flex className='pd2b' align='center' gap={8} wrap>
        <ActiveAIConfigSelect />
        <Button onClick={() => window.store.toggleAIConfig()}>
          {getAIConfigsLabel()}
        </Button>
      </Flex>
      <div className='pd2b'>
        <SwitchLabel
          label={e('autoCompress')}
          aria-label={e('autoCompress')}
          checked={autoCompress}
          onChange={checked => window.store.setAiAutoCompress(checked)}
        />
      </div>
      <div className='pd2b'>
        <AgentApprovalModeSelect id='agentApprovalMode' />
      </div>
      <div className='pd2b'>
        <label htmlFor='agentCommandAllowlist' className='inline-title'>
          {e('agentCommandAllowlist')}
        </label>
        <small id='agentCommandCount' className='pd1l'>
          {commands ? commands.split('\n').length : 0} / {agentCommandLimit}
        </small>
        <TextareaConfirm
          id='agentCommandAllowlist'
          aria-describedby='agentCommandCount'
          getConfirmedValue={readCommandLines}
          rows={3}
          spellCheck={false}
          value={commands}
          onChange={value => {
            if (!setAgentCommandAllowlist(parseAgentCommandLines(value))) {
              message.error(permissionSaveError)
            }
          }}
        />
      </div>
    </div>
  )
}
