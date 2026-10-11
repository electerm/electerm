// Runs quick command steps against one terminal. The caller binds `send`
// and `isAlive` to the tab the run started in, so the run never follows
// the user to another tab and ends when its tab closes.
//
// Step shapes:
//   { type: 'text', value: 'show run', enter: true, delay: 100 }
//   { type: 'key', value: 'Ctrl+C', repeat: 1, delay: 0 }
//   { type: 'wait', value: 'Password:', timeout: 10000, delay: 0 }
//   { type: 'prompt', value: 'Password', hidden: true, enter: true, delay: 0 }
// `delay` is the wait in milliseconds before the step is sent. A wait step
// sends nothing. It waits until `watchText(value)` finds the text, and ends
// the run with status 'timeout' when `timeout` ms pass first. A timeout of
// 0 waits until the text shows up, the run is stopped or the tab closes.
// A prompt step asks the user for a value with `askInput(step, index)` and
// sends it. Cancelling the question ends the run with status 'cancelled'.
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
  watchText,
  askInput,
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

  // resolves true when the text shows up, false on timeout, stop or close
  function waitText (text, timeout) {
    return new Promise(resolve => {
      const w = watchText(text)
      const timer = timeout ? setTimeout(() => done(false), timeout) : null
      const alive = setInterval(() => {
        if (!isAlive()) {
          done(false)
        }
      }, 1000)
      function done (found) {
        clearTimeout(timer)
        clearInterval(alive)
        w.cancel()
        wake = null
        resolve(found)
      }
      w.found.then(() => done(true))
      wake = () => done(false)
    })
  }

  // resolves with the answer, or null on cancel, stop or close
  function ask (step, index) {
    return new Promise(resolve => {
      const a = askInput(step, index)
      let finished = false
      const alive = setInterval(() => {
        if (!isAlive()) {
          done(null)
        }
      }, 1000)
      function done (value) {
        if (finished) {
          return
        }
        finished = true
        clearInterval(alive)
        a.cancel()
        wake = null
        resolve(value)
      }
      a.answer.then(done)
      wake = () => done(null)
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

  // returns why the run has to end, or nothing to go on
  async function runStep (step, index) {
    if (step.type === 'text') {
      const text = await resolveText(step.value || '')
      // resolving templates can be async (clipboard), recheck before sending
      if (stopped || !isAlive()) {
        return 'stopped'
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
    } else if (step.type === 'wait' && watchText) {
      const timeout = Math.max(0, Math.floor(Number(step.timeout)) || 0)
      if (!await waitText(step.value || '', timeout)) {
        return 'timeout'
      }
    } else if (step.type === 'prompt' && askInput) {
      const value = await ask(step, index)
      if (value === null || stopped || !isAlive()) {
        return 'cancelled'
      }
      const data = value + (step.enter ? '\r' : '')
      if (data) {
        send(data)
      }
    }
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
        const failed = await runStep(step, i)
        if (failed) {
          return stateAt(i) || { status: failed, index: i }
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
