// Questions from prompt steps, for one run of a quick command in one or
// more terminals. With "send to all terminals" on, the default, each
// question is asked once and the answer goes to every terminal waiting on
// it. Turned off, each terminal gets its own question. Turning it back on
// folds them into one again. The setting holds for the rest of the run.
//
// A question per terminal means one entry per terminal here; the footer
// shows them one at a time, so answering feels like a short queue.
//
// open({ step, tabId, shared }) shows a dialog and returns { answer, close }.
// `answer` resolves with what the user typed, or null on cancel. `tabId` is
// null for a dialog shared by all terminals. close() removes the dialog
// without answering it.
export function createAskGroup (open) {
  let shared = true
  // index => answer given for all terminals
  const answers = new Map()
  // index => { step, waiting: Map(tabId => resolve), dialogs: Map(tabId => dialog) }
  const questions = new Map()

  function settle (index, q, tabIds, value) {
    for (const tabId of tabIds) {
      const resolve = q.waiting.get(tabId)
      if (resolve) {
        q.waiting.delete(tabId)
        resolve(value)
      }
    }
    if (!q.waiting.size) {
      closeAll(q)
      questions.delete(index)
    }
  }

  function closeAll (q) {
    for (const d of q.dialogs.values()) {
      d.close()
    }
    q.dialogs.clear()
  }

  function openDialog (index, q, tabId) {
    const dialog = open({ step: q.step, tabId, shared: tabId === null })
    q.dialogs.set(tabId, dialog)
    dialog.answer.then(value => {
      if (q.dialogs.get(tabId) !== dialog) {
        return
      }
      q.dialogs.delete(tabId)
      if (tabId !== null) {
        settle(index, q, [tabId], value)
        return
      }
      if (value !== null) {
        answers.set(index, value)
      }
      settle(index, q, [...q.waiting.keys()], value)
    })
  }

  function show (index, q) {
    closeAll(q)
    if (shared) {
      openDialog(index, q, null)
    } else {
      for (const tabId of q.waiting.keys()) {
        openDialog(index, q, tabId)
      }
    }
  }

  function setShared (value) {
    if (shared === value) {
      return
    }
    shared = value
    for (const [index, q] of questions) {
      show(index, q)
    }
  }

  function ask (step, index, tabId) {
    if (shared && answers.has(index)) {
      return { answer: Promise.resolve(answers.get(index)), cancel () {} }
    }
    let q = questions.get(index)
    if (!q) {
      q = { step, waiting: new Map(), dialogs: new Map() }
      questions.set(index, q)
    }
    const answer = new Promise(resolve => q.waiting.set(tabId, resolve))
    if (!shared) {
      openDialog(index, q, tabId)
    } else if (!q.dialogs.has(null)) {
      openDialog(index, q, null)
    }
    return {
      answer,
      // this terminal stops waiting: its own dialog closes, a shared one
      // stays open while other terminals still wait on it
      cancel () {
        if (!q.waiting.has(tabId)) {
          return
        }
        q.waiting.delete(tabId)
        const own = q.dialogs.get(tabId)
        if (own) {
          q.dialogs.delete(tabId)
          own.close()
        }
        if (!q.waiting.size) {
          closeAll(q)
          questions.delete(index)
        }
      }
    }
  }

  return { ask, setShared }
}
