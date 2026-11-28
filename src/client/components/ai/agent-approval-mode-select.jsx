import { useSyncExternalStore } from 'react'
import { Select } from 'antd'
import message from '../common/message'
import { readAgentApprovalMode, setAgentApprovalMode, subscribeAgentPermissions } from './agent-permission-preferences'

const e = window.translate

export default function AgentApprovalModeSelect (props) {
  const value = useSyncExternalStore(subscribeAgentPermissions, readAgentApprovalMode)
  return (
    <Select
      {...props}
      aria-label={e('permission')}
      value={value}
      onChange={next => {
        if (!setAgentApprovalMode(next)) message.error(e('agentPermissionSaveFailed'))
      }}
      popupMatchSelectWidth={false}
      options={[
        { value: 'manual', label: e('agentManualApproval') },
        { value: 'auto', label: e('agentAutoApproval') }
      ]}
    />
  )
}
