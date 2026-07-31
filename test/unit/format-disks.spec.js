// format-disks.spec.js
const { describe, test } = require('node:test')
const assert = require('node:assert/strict')

let formatDisks

describe('formatDisks', () => {
  test('setup: import ESM module', async () => {
    const mod = await import('../../src/client/components/terminal-info/format-disks.js')
    formatDisks = mod.default
  })

  test('empty / falsy input returns empty disk list', () => {
    assert.deepStrictEqual(formatDisks(''), { disks: [] })
    assert.deepStrictEqual(formatDisks(undefined), { disks: [] })
    assert.deepStrictEqual(formatDisks(null), { disks: [] })
  })

  test('parses a normal df -hP output (one line per filesystem)', () => {
    const out = [
      'Filesystem      Size  Used Avail Use% Mounted on',
      'devtmpfs        4.0M     0  4.0M   0% /dev',
      '/dev/sda2        50G   20G   30G  40% /',
      'nfshost:/data    10T    8T    2T  80% /mnt/data'
    ].join('\n')
    const { disks } = formatDisks(out)
    assert.strictEqual(disks.length, 3)
    assert.deepStrictEqual(disks[2], {
      filesystem: 'nfshost:/data',
      size: '10T',
      used: '8T',
      avail: '2T',
      usedPercent: '80%',
      mount: '/mnt/data'
    })
  })

  test('lists an nfs disk whose long name wraps onto a continuation line', () => {
    // df wraps a long filesystem name (common with nfs) onto a second line that
    // starts with spaces and only holds the numeric columns + mount. Previously
    // this row was dropped because its filesystem field parsed as empty.
    const out = [
      'Filesystem      Size  Used Avail Use% Mounted on',
      'nfshost:/a/very/long/export/path/that/is/long',
      '                10T    8T    2T  80% /mnt/data',
      '/dev/sda2        50G   20G   30G  40% /'
    ].join('\n')
    const { disks } = formatDisks(out)
    const nfs = disks.find(d => d.mount === '/mnt/data')
    assert.ok(nfs, 'nfs disk should be listed')
    assert.strictEqual(nfs.filesystem, 'nfshost:/a/very/long/export/path/that/is/long')
    assert.strictEqual(nfs.size, '10T')
    assert.strictEqual(nfs.used, '8T')
    assert.strictEqual(nfs.avail, '2T')
    assert.strictEqual(nfs.usedPercent, '80%')
  })

  test('handles trailing newline / blank lines without dropping rows', () => {
    const out = [
      'Filesystem      Size  Used Avail Use% Mounted on',
      '/dev/sda2        50G   20G   30G  40% /',
      'nfshost:/data    10T    8T    2T  80% /mnt/data',
      ''
    ].join('\n')
    const { disks } = formatDisks(out)
    assert.strictEqual(disks.length, 2)
    assert.strictEqual(disks[1].mount, '/mnt/data')
  })

  test('drops incomplete rows (no mount) instead of listing garbage', () => {
    // a wrapped name-only line that never receives its data line
    const out = [
      'Filesystem      Size  Used Avail Use% Mounted on',
      'nfshost:/orphaned/long/name/with/no/data/line',
      '/dev/sda2        50G   20G   30G  40% /'
    ].join('\n')
    const { disks } = formatDisks(out)
    assert.strictEqual(disks.length, 1)
    assert.strictEqual(disks[0].mount, '/')
  })
})
