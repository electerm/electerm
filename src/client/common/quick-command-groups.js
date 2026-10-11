/**
 * Groups quick commands under their labels, for the quick command panel and
 * the settings list. A quick command with several labels shows in each of
 * its groups. Labels sort by name, and quick commands with no label come
 * last, under the label ''. With `labels`, only those groups are kept.
 */

export const noLabel = ''

const byName = (a, b) => a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' })

export function hasLabels (list) {
  return list.some(qm => (qm.labels || []).some(Boolean))
}

export function groupByLabel (list, labels = []) {
  const groups = new Map()
  const rest = []
  for (const qm of list) {
    const own = [...new Set((qm.labels || []).filter(Boolean))]
    if (!own.length) {
      rest.push(qm)
    }
    for (const label of own) {
      if (!groups.has(label)) {
        groups.set(label, [])
      }
      groups.get(label).push(qm)
    }
  }
  const out = [...groups.keys()]
    .filter(label => !labels.length || labels.includes(label))
    .sort(byName)
    .map(label => ({ label, items: groups.get(label) }))
  if (rest.length && !labels.length) {
    out.push({ label: noLabel, items: rest })
  }
  return out
}
