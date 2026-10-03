/**
 * press-and-hold auto-repeat for the touch shortcut bar.
 *
 * Why: the bar's buttons sent their key from `click` alone, so a touch user
 * had to tap over and over for anything that repeats — holding Bksp to erase
 * a word, holding ↓ to walk back through the scrollback. A physical key
 * repeats while it is held, so the bar does the same: press, wait out the
 * initial delay, then send the key at a steady interval until the finger (or
 * mouse button) lifts.
 *
 * Deliberately free of React and of the DOM — shortcut-bar.jsx owns the
 * wiring, this owns the timing, so the timing can be unit-tested on its own
 * (src/test/unit-ci/shortcut-bar-press.spec.js).
 *
 * Two movement tolerances, because the two phases want opposite things:
 *   - before the repeat begins, ANY movement means the finger is scrolling
 *     the bar rather than pressing a key, so a tight tolerance cancels —
 *     a press that slides off must never send a repeat;
 *   - once the key is repeating, a held finger always drifts a little, so it
 *     has to travel much further before it counts as a scroll. With one
 *     tolerance, holding Bksp for two seconds would either stop halfway (too
 *     tight) or keep erasing while the bar slides sideways (too loose).
 *
 * Only one press is ever in flight. A second pointerdown takes over (a second
 * finger on another key is a deliberate change of target, and two repeating
 * keys at once helps nobody), and any event from a different pointerId is
 * ignored, so a stray move from a finger already lifted cannot stop or
 * corrupt the live repeat.
 *
 * `up()` / `cancel()` report whether the gesture had become a long press, and
 * both report the same value — a release can be caught by the component's own
 * handler or by the window-level safety net (the pointer may be released
 * anywhere, even outside the window), so the answer must not depend on which
 * one runs first. The caller uses it to swallow the `click` the browser
 * synthesizes after a long press, which would otherwise send one extra key.
 */

export const longPressDelay = 400

// ~16 sends/sec once repeating: fast enough to clear a long line or scroll
// back through history, slow enough that the remote end can keep up.
export const repeatInterval = 60

// pre-repeat: a press that moves this much is a scroll, not a tap
export const moveTolerance = 10

// while repeating: how far a held finger may drift before it is a scroll
export const repeatMoveTolerance = 32

export function createKeyRepeat (opts = {}) {
  const {
    send = () => {},
    onRepeatChange = () => {},
    delay = longPressDelay,
    interval = repeatInterval,
    tolerance = moveTolerance,
    repeatTolerance = repeatMoveTolerance
  } = opts

  let holdTimer = null
  let tickTimer = null
  let payload = null
  let startX = 0
  let startY = 0
  let pointerId = null
  let inFlight = false
  let repeating = false
  // sticky for the whole gesture: set when the long press begins, cleared only
  // by the next press, so it survives any release path
  let longFired = false

  function stopTimers () {
    if (holdTimer) {
      clearTimeout(holdTimer)
      holdTimer = null
    }
    if (tickTimer) {
      clearInterval(tickTimer)
      tickTimer = null
    }
  }

  function setRepeating (on) {
    if (repeating === on) {
      return
    }
    repeating = on
    onRepeatChange(on ? payload : null)
  }

  // leave the gesture, keeping `longFired` for the caller's click decision
  function release () {
    stopTimers()
    if (inFlight) {
      setRepeating(false)
    }
    inFlight = false
    payload = null
    pointerId = null
    return longFired
  }

  function beginRepeat () {
    holdTimer = null
    longFired = true
    setRepeating(true)
    // send the first repeat immediately: holding a key should not wait out
    // the delay twice
    send(payload)
    tickTimer = setInterval(() => send(payload), interval)
  }

  // an event only counts while it belongs to the press in flight. Events
  // synthesized in tests (or by a browser that omits pointerId) always match.
  function owns (ev) {
    return inFlight &&
      (pointerId === null || !ev || ev.pointerId == null || ev.pointerId === pointerId)
  }

  return {
    get repeating () {
      return repeating
    },

    get longFired () {
      return longFired
    },

    /**
     * A press starts. `p` is whatever should be handed back to `send` — the
     * bar passes the whole button so it can also read the id for its visual
     * state. A second press cancels the first.
     */
    down (p, ev) {
      release()
      payload = p
      pointerId = ev && ev.pointerId != null ? ev.pointerId : null
      startX = ev ? ev.clientX || 0 : 0
      startY = ev ? ev.clientY || 0 : 0
      longFired = false
      inFlight = true
      holdTimer = setTimeout(beginRepeat, delay)
    },

    move (ev) {
      if (!owns(ev)) {
        return
      }
      const x = ev ? ev.clientX || 0 : 0
      const y = ev ? ev.clientY || 0 : 0
      const dx = x - startX
      const dy = y - startY
      const moved = Math.sqrt(dx * dx + dy * dy)
      if (repeating) {
        if (moved > repeatTolerance) {
          release()
        }
      } else if (moved > tolerance) {
        // the press turned into a scroll of the bar: drop it before it can
        // fire, and let the scroll happen
        release()
      }
    },

    /** the pointer lifted. Returns true if this gesture was a long press. */
    up (ev) {
      if (!owns(ev)) {
        return false
      }
      return release()
    },

    /**
     * The gesture was aborted (pointercancel, a second finger, the bar being
     * hidden, unmount). Never sends anything, so a scroll that turns into a
     * cancel cannot leak a key.
     */
    cancel (ev) {
      if (ev && !owns(ev)) {
        return false
      }
      const wasLong = inFlight ? longFired : false
      release()
      return wasLong
    },

    dispose () {
      release()
      longFired = false
    }
  }
}
