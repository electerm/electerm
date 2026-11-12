/**
 * The pure half of what a widget form remembers between visits — no storage, no
 * window, so `node --test` can load it (see test/unit-ci/widget-form-memory.spec.js).
 * The local-storage glue is in ./widget-form-memory.js.
 *
 * Two forms ask for widget configs — the generated form of a config-mode user
 * widget (components/widgets/custom-widget-form.jsx) and the run form of a
 * built-in widget (components/widgets/widget-form.jsx). Both keep the values the
 * user last ran a widget with, under `widget-config-<id>`, so a widget that is
 * always started with the same host / port / directory does not have to be
 * filled in again. A user widget can opt out with `electerm.persist: false`
 * (see app/widgets/user-widget.js).
 *
 * Never remembered, and never restored: a `password` field and a generated
 * secret (`showGenerator` — the API-key fields that already have their own store
 * in common/widget-api-key.js). A credential belongs in one place, not two, and
 * a field that used to be a plain string but is now a password must not come
 * back with its old value.
 *
 * Only keys the manifest still declares are kept: local storage outlives widget
 * versions, and a stale row must not become a ghost form value.
 */

// The one key a widget's config lives under: the form memory writes it, and a
// UI widget reads the same object through getConfig
// (components/widgets/custom-widget-panel.jsx).
export function widgetConfigKey (id) {
  return `widget-config-${id}`
}

export function isRemembered (config) {
  return !!config && config.type !== 'password' && !config.showGenerator
}

function has (obj, key) {
  return Object.prototype.hasOwnProperty.call(obj, key)
}

// The remembered subset of `stored`, for the caller to lay over the manifest
// defaults.
export function pickRemembered (configs, stored) {
  const res = {}
  if (!stored || typeof stored !== 'object') {
    return res
  }
  const list = configs || []
  list.forEach(config => {
    if (isRemembered(config) && has(stored, config.name)) {
      res[config.name] = stored[config.name]
    }
  })
  return res
}

// `stored` with the memorable values of `values` written over it, or null when
// nothing in `values` is worth keeping. A merge, not a replace: the same key is
// the config store a UI widget reads through getConfig
// (components/widgets/custom-widget-panel.jsx), so its own state must survive.
export function mergeRemembered (configs, values, stored) {
  if (!values || typeof values !== 'object') {
    return null
  }
  const next = { ...(stored && typeof stored === 'object' ? stored : {}) }
  let touched = false
  const list = configs || []
  list.forEach(config => {
    if (!isRemembered(config) || !has(values, config.name)) {
      return
    }
    next[config.name] = values[config.name]
    touched = true
  })
  return touched ? next : null
}
