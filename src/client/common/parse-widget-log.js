/**
 * Parse a widget log file into the two streams the widget panel shows.
 *
 * The writer is src/app/widgets/instance-log.js; the format is one entry per
 * line, pipe separated:
 *   <iso time>|log|<level>|<message>
 *   <iso time>|conn|<ok|fail|info>|<type>|<from>|<message>
 * A message may contain pipes, so everything after the last known separator is
 * taken as the message.
 */

const CONN_STATE = {
  ok: true,
  fail: false,
  info: null
}

export function parseWidgetLog (text) {
  const logs = []
  const events = []
  for (const line of String(text || '').split('\n')) {
    if (!line) {
      continue
    }
    const parts = line.split('|')
    if (parts.length < 4) {
      continue
    }
    const ts = Date.parse(parts[0])
    if (!ts) {
      continue
    }
    if (parts[1] === 'conn') {
      if (parts.length < 6) {
        continue
      }
      events.push({
        ts,
        ok: Object.prototype.hasOwnProperty.call(CONN_STATE, parts[2])
          ? CONN_STATE[parts[2]]
          : null,
        type: parts[3],
        from: parts[4] === '-' ? '' : parts[4],
        msg: parts.slice(5).join('|')
      })
    } else {
      logs.push({
        ts,
        level: parts[2],
        msg: parts.slice(3).join('|')
      })
    }
  }
  return { logs, events }
}

export default parseWidgetLog
