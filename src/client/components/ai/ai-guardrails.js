// Append mandatory guardrails (if configured via window.et.mandatoryGuardrails)
// to the AI system role as an extra layer of protection. This is typically set
// by enterprise deployments to enforce policies on every AI request.
export function appendMandatoryGuardrails (systemContent) {
  const guardrails = window.et && window.et.mandatoryGuardrails
  if (!guardrails) {
    return systemContent
  }
  return `${systemContent}\n\n${guardrails}`
}
