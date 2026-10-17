/**
 * Turns a saved quick command into steps for the step runner.
 *
 * A step with no `type` is a command step, so quick commands saved before
 * step types existed run as before. A command step sends Enter unless
 * `enter` is false. Steps saved before `enter` existed follow the quick
 * command's old `inputOnly` setting. A missing delay is 100 ms, as before,
 * and 0 is allowed.
 */

export const defaultStepDelay = 100

export function stepDelay (step) {
  const v = Number(step.delay)
  return step.delay === undefined || step.delay === null || step.delay === '' || !Number.isFinite(v)
    ? defaultStepDelay
    : Math.max(0, Math.floor(v))
}

export function stepSendsEnter (step, qm = {}) {
  return typeof step.enter === 'boolean' ? step.enter : !qm.inputOnly
}

export function quickCommandSteps (qm, { isWin = false } = {}) {
  if (!qm) {
    return []
  }
  const list = qm.commands && qm.commands.length
    ? qm.commands
    : (qm.command ? [{ command: qm.command }] : [])
  return list.filter(Boolean).map(step => {
    if (step.type === 'key') {
      return {
        type: 'key',
        value: step.key || '',
        repeat: step.repeat,
        delay: stepDelay(step)
      }
    }
    const command = step.command || ''
    return {
      type: 'text',
      value: isWin ? command.replace(/\n/g, '\n\r') : command,
      enter: stepSendsEnter(step, qm),
      delay: stepDelay(step)
    }
  })
}
