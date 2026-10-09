// Runs quick command steps against one terminal. The caller binds `send`
// and `isAlive` to the tab the run started in, so the run never follows
// the user to another tab and ends when its tab closes.
//
// Step shapes:
//   { type: 'text', value: 'show run', enter: true, delay: 100 }
//   { type: 'key', value: 'Ctrl+C', repeat: 1, delay: 0 }
// `delay` is the wait in milliseconds before the step is sent.
import { keySequence } from './key-sequences.js'

function toCount (n, fallback) {
  const v = Math.floor(Number(n))
  return Number.isFinite(v) && v > 0 ? v : fallback
}

export function runSteps (steps, {
  send,
  isAlive = () => true,
  resolveText = text => text,
  getKeyOptions = () => ({}),
  onStep
} = {}) {
  let stopped = false
  let wake = null

  function sleep (ms) {
    return new Promise(resolve => {
      const timer = setTimeout(done, ms)
      function done () {
        clearTimeout(timer)
        wake = null
        resolve()
      }
      wake = done
    })
  }

  function stateAt (index) {
    if (stopped) {
      return { status: 'stopped', index }
    }
    if (!isAlive()) {
      return { status: 'closed', index }
    }
    return null
  }

  async function runStep (step) {
    if (step.type === 'text') {
      const text = await resolveText(step.value || '')
      // resolving templates can be async (clipboard), recheck before sending
      if (stopped || !isAlive()) {
        return false
      }
      const data = text + (step.enter ? '\r' : '')
      if (data) {
        send(data)
      }
    } else if (step.type === 'key') {
      const seq = keySequence(step.value, getKeyOptions())
      if (seq) {
        send(seq.repeat(toCount(step.repeat, 1)))
      }
    }
    return true
  }

  async function run () {
    const list = steps || []
    for (let i = 0; i < list.length; i++) {
      const step = list[i] || {}
      const ms = toCount(step.delay, 0)
      if (ms) {
        await sleep(ms)
      }
      const before = stateAt(i)
      if (before) {
        return before
      }
      if (onStep) {
        onStep(i, step)
      }
      try {
        if (!await runStep(step)) {
          return stateAt(i)
        }
      } catch (error) {
        return { status: 'error', index: i, error }
      }
    }
    return stateAt(list.length) || { status: 'done', index: list.length }
  }

  return {
    stop () {
      stopped = true
      if (wake) {
        wake()
      }
    },
    // start on a microtask so a stop() right after runSteps() sends nothing
    done: Promise.resolve().then(run)
  }
}
