// A quick command run in several tabs asks each question once and sends the
// same answer to every tab. `open(step)` shows the question and returns
// { answer, cancel }. The question closes only when every tab waiting on it
// has stopped waiting.
export function sharedAsk (open) {
  const shared = new Map()
  return (step, index) => {
    let p = shared.get(index)
    if (!p) {
      p = { ...open(step), users: 0 }
      shared.set(index, p)
    }
    p.users++
    let left = false
    return {
      answer: p.answer,
      cancel () {
        if (left) {
          return
        }
        left = true
        p.users--
        if (!p.users) {
          p.cancel()
        }
      }
    }
  }
}
