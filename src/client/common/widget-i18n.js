/**
 * Display strings a widget translates in its own package.json
 * (`electerm.i18n.<locale>`). English in the manifest is the base; the renderer
 * owns the current language (window.store.config.language) and applies the
 * right strings to the installed-widget list, its forms and the online list.
 *
 * Dependency-free on purpose: unit-ci loads client modules with ESM import, so
 * an extensionless relative import would fail there.
 */

const LOCALE_RE = /^[a-z]{2}_[a-z]{2}$/
const TEXT_KEYS = ['name', 'description', 'submitLabel']
const CONFIG_KEYS = ['label', 'description', 'placeholder']

function clipped (value, max) {
  return typeof value === 'string' && value ? value.slice(0, max) : ''
}

export function normalizeLang (lang) {
  const value = typeof lang === 'string' ? lang.trim().toLowerCase().replace(/-/g, '_') : ''
  return LOCALE_RE.test(value) ? value : 'en_us'
}

export function currentLang () {
  return normalizeLang(
    (typeof window !== 'undefined' && window.store && window.store.config && window.store.config.language) ||
    'en_us'
  )
}

function textOf (dict, key, fallback) {
  const value = dict && dict[key]
  return typeof value === 'string' && value ? value : fallback
}

/**
 * The registry is untrusted input: keep only the fields the host actually
 * renders, with the same limits the main process uses for local manifests.
 */
export function sanitizeWidgetI18n (value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return {}
  }
  const out = {}
  for (const lang of Object.keys(value)) {
    const raw = value[lang]
    if (!LOCALE_RE.test(lang) || !raw || typeof raw !== 'object' || Array.isArray(raw)) {
      continue
    }
    const item = {}
    for (const key of TEXT_KEYS) {
      const text = clipped(raw[key], key === 'description' ? 2000 : 300)
      if (text) {
        item[key] = text
      }
    }
    if (raw.configs && typeof raw.configs === 'object' && !Array.isArray(raw.configs)) {
      const configs = {}
      for (const name of Object.keys(raw.configs)) {
        const conf = raw.configs[name]
        if (!conf || typeof conf !== 'object' || Array.isArray(conf)) {
          continue
        }
        const patch = {}
        for (const key of CONFIG_KEYS) {
          const text = clipped(conf[key], 2000)
          if (text) {
            patch[key] = text
          }
        }
        if (conf.choices && typeof conf.choices === 'object' && !Array.isArray(conf.choices)) {
          const choices = {}
          for (const val of Object.keys(conf.choices)) {
            const label = clipped(conf.choices[val], 200)
            if (label) {
              choices[val] = label
            }
          }
          if (Object.keys(choices).length) {
            patch.choices = choices
          }
        }
        if (Object.keys(patch).length) {
          configs[name] = patch
        }
      }
      if (Object.keys(configs).length) {
        item.configs = configs
      }
    }
    if (Object.keys(item).length) {
      out[lang] = item
    }
  }
  return out
}

function translationFor (i18n, lang) {
  if (!i18n || typeof i18n !== 'object') {
    return null
  }
  const item = i18n[normalizeLang(lang)]
  return item && typeof item === 'object' && !Array.isArray(item) ? item : null
}

/** A copy: mutating a widget returned by the host would mutate the store. */
export function localizeWidgetInfo (info, lang = currentLang()) {
  if (!info || typeof info !== 'object') {
    return info
  }
  const patch = translationFor(info.i18n, lang)
  if (!patch) {
    return info
  }
  const res = { ...info }
  for (const key of TEXT_KEYS) {
    res[key] = textOf(patch, key, info[key])
  }
  if (Array.isArray(info.configs) && patch.configs && typeof patch.configs === 'object') {
    res.configs = info.configs.map(config => {
      const tr = patch.configs[config.name]
      if (!tr || typeof tr !== 'object') {
        return config
      }
      const next = { ...config }
      for (const key of CONFIG_KEYS) {
        next[key] = textOf(tr, key, config[key])
      }
      if (Array.isArray(config.choices) && tr.choices && typeof tr.choices === 'object') {
        next.choices = config.choices.map(choice => ({
          ...choice,
          label: textOf(tr.choices, choice.value, choice.label)
        }))
      }
      return next
    })
  }
  return res
}

/** Registry rows only show name and description, not the config form. */
export function localizeRegistryWidget (record, lang = currentLang()) {
  if (!record || typeof record !== 'object') {
    return record
  }
  const patch = translationFor(record.i18n, lang)
  if (!patch) {
    return record
  }
  return {
    ...record,
    name: textOf(patch, 'name', record.name),
    description: textOf(patch, 'description', record.description)
  }
}
