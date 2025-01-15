// components instance reference holder
window.refs = new Map()

export default class Ref {
  static add (key, inst) {
    window.refs.set(key, inst)
  }

  static get (key) {
    return window.refs.get(key)
  }

  static remove (key) {
    window.refs.delete(key)
  }
}
