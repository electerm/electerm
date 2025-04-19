// components instance reference holder
window.refs = new Map()
window.refsStatic = new Map()
window.refsTransfers = new Map()

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

export const refs = new Ref('refs')
export const refsTransfers = new Ref('refsTransfers')
export const refsStatic = new Ref('refsStatic')
