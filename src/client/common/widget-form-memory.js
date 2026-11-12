/**
 * Read and write what a widget form remembers between visits.
 *
 * The rules — which fields are remembered, and why a write merges — live in
 * ./widget-form-memory-utils.js; this file is only the local-storage half of it,
 * keyed `widget-config-<id>` and stored through safe-local-storage like the rest
 * of the app's per-widget state.
 */
import { safeGetItemJSON, safeSetItemJSON } from './safe-local-storage'
import {
  widgetConfigKey,
  pickRemembered,
  mergeRemembered
} from './widget-form-memory-utils'

function readStored (id) {
  const stored = safeGetItemJSON(widgetConfigKey(id), {})
  return stored && typeof stored === 'object' && !Array.isArray(stored) ? stored : {}
}

// The remembered subset only; the caller lays it over the manifest defaults.
export function rememberedValues (id, configs) {
  return pickRemembered(configs, readStored(id))
}

export function rememberValues (id, configs, values) {
  const next = mergeRemembered(configs, values, readStored(id))
  if (next) {
    safeSetItemJSON(widgetConfigKey(id), next)
  }
}
