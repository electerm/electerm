// components instance reference holder
window.refs = new Map()
window.refsStatic = new Map()
window.refsTransfers = new Map()
window.refsTabs = new Map()
window.filesRef = new Map()

class Ref {
  constructor (key) {
    this.key = key
  }

  add (key, inst) {
    window[this.key].set(key, inst)
  }

  get (key) {
    return window[this.key].get(key)
  }

  remove (key) {
    window[this.key].delete(key)
  }
}

class TabsRef extends Ref {
  constructor (key) {
    super(key)
    // Map to track add count for each key: key -> number
    this.addCounts = new Map()
  }

  add (key, inst) {
    // Increment add count
    const currentCount = this.addCounts.get(key) || 0
    this.addCounts.set(key, currentCount + 1)

    // Add/update the ref
    window[this.key].set(key, inst)
  }

  remove (key) {
    const currentCount = this.addCounts.get(key) || 0

    if (currentCount <= 0) {
      return
    }

    const newCount = currentCount - 1
    if (newCount === 0) {
      window[this.key].delete(key)
      this.addCounts.delete(key)
    } else {
      this.addCounts.set(key, newCount)
    }
  }
}

export const refs = new Ref('refs')
export const refsTransfers = new Ref('refsTransfers')
export const refsStatic = new Ref('refsStatic')
export const refsTabs = new TabsRef('refsTabs')
export const filesRef = new Ref('filesRef')
