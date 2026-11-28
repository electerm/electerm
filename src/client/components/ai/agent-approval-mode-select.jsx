import { useSyncExternalStore } from 'react'
import { Select } from 'antd'
import { agentPermissionLabel } from './agent-permissions'
import { readAgentApprovalMode, setAgentApprovalMode, subscribeAgentPermissions } from './agent-permission-preferences'

export default function AgentApprovalModeSelect ({ showLabel, id, ...props }) {
  const label = agentPermissionLabel('agentApprovalMode', 'Agent approval mode')
  const value = useSyncExternalStore(subscribeAgentPermissions, readAgentApprovalMode)
  return (
    <>
      {showLabel && <label className='inline-title mg1r' htmlFor={id}>{label}</label>}
      <Select
        {...props}
        id={id}
        aria-label={label}
        value={value}
        onChange={setAgentApprovalMode}
        popupMatchSelectWidth={false}
        options={[
          { value: 'manual', label: agentPermissionLabel('agentManualApproval', 'Manual approval') },
          { value: 'auto', label: agentPermissionLabel('agentAutoApproval', 'Auto approval') }
        ]}
      />
    </>
  )
}
