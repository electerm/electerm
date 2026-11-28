// Leave room for tail -f implementations that deliver a batch once a second.
const idleAfterMs = 1500
const busyAfterMs = 750

export const idleActivity = Object.freeze({ first: 0, last: 0, writes: 0, busy: false })

export function remainingIdleMs (last, now) {
  return Math.max(0, last + idleAfterMs - now)
}

export function recordOutput (previous, now, lastInput, length) {
  // Small replies immediately after typing are usually keystroke echoes.
  if (length < 64 && now - lastInput < 300) return previous
  const continuing = previous.writes > 0 && remainingIdleMs(previous.last, now) > 0
  const first = continuing ? previous.first : now
  const writes = continuing ? previous.writes + 1 : 1
  return { first, last: now, writes, busy: writes >= 3 && now - first >= busyAfterMs }
}

// Observe only the active pane. Its coalesced write already has a timestamp.
// One timer checks the idle deadline without resetting it on every batch.
export function observeOutputActivity (pane, onChange) {
  let activity = idleActivity
  let timer

  function checkIdle () {
    const remaining = remainingIdleMs(activity.last, Date.now())
    if (remaining) {
      timer = setTimeout(checkIdle, remaining)
    } else {
      activity = idleActivity
      onChange(false)
    }
  }

  pane.onOutputActivity = (now, lastInput, length) => {
    const wasBusy = activity.busy
    activity = recordOutput(activity, now, lastInput, length)
    if (activity.busy === wasBusy) return
    onChange(activity.busy)
    clearTimeout(timer)
    if (activity.busy) timer = setTimeout(checkIdle, idleAfterMs)
  }
  return () => {
    delete pane.onOutputActivity
    clearTimeout(timer)
  }
}
