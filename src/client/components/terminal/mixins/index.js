/**
 * Terminal mixins.
 *
 * `Term` (terminal.jsx) owns a lot of imperative xterm.js wiring. Instead of
 * one 2000+ line file, its methods are grouped here by concern. Mixin members
 * are plain functions (not arrow class fields) so they can live in their own
 * module, and `applyMixins` binds them onto the instance in the constructor.
 *
 * Binding matters: these methods are handed out as callbacks (xterm event
 * listeners, React props, antd menu onClick) and must therefore keep the
 * "always bound to the instance" behaviour React class fields give.
 *
 * A mixin may only export functions. Per-instance mutable state would be
 * shared by every terminal, so it stays a class field in terminal.jsx.
 */

export function applyMixins (instance, mixins) {
  for (const mixin of mixins) {
    for (const name of Object.keys(mixin)) {
      const fn = mixin[name]
      if (typeof fn !== 'function') {
        throw new Error(`terminal mixin member "${name}" must be a function`)
      }
      instance[name] = fn.bind(instance)
    }
  }
}
