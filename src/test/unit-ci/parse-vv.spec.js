const { describe, it, before } = require('node:test')
const assert = require('node:assert/strict')

// Client-side (ESM) only. .vv files are loaded by the bookmark form
// (src/client/components/bookmark-form/common/vv-file-field.jsx), so
// src/client/common/parse-vv.js is the sole implementation -- there is no
// server-side (CJS) twin to keep in sync with.

function runTests (getMod) {
  it('parses the four-line minimum', () => {
    const { parseVv } = getMod()
    const r = parseVv('[virt-viewer]\ntype=spice\nhost=127.0.0.1\nport=5930\n')
    assert.strictEqual(r.ok, true, r.error)
    assert.strictEqual(r.type, 'spice')
    assert.deepStrictEqual(r.fields, { host: '127.0.0.1', port: 5930 })
    assert.deepStrictEqual(r.warnings, [])
    assert.deepStrictEqual(r.ignored, [])
    assert.deepStrictEqual(r.unknown, [])
  })

  // rejection rules must match virt_viewer_file_new()
  it('rejects a file with no [virt-viewer] group', () => {
    const { parseVv } = getMod()
    const r = parseVv('[ovirt]\nhost=x\n')
    assert.strictEqual(r.ok, false)
    assert.match(r.error, /missing \[virt-viewer\]/)
  })

  it('rejects a file with no type key', () => {
    const { parseVv } = getMod()
    const r = parseVv('[virt-viewer]\nhost=127.0.0.1\nport=5930\n')
    assert.strictEqual(r.ok, false)
    assert.match(r.error, /missing "type"/)
  })

  it('rejects a non-spice session type', () => {
    const { parseVv } = getMod()
    const r = parseVv('[virt-viewer]\ntype=vnc\nhost=a\nport=5900\n')
    assert.strictEqual(r.ok, false)
    assert.match(r.error, /spice only/)
  })

  it('rejects a file whose host is present but empty', () => {
    const { parseVv } = getMod()
    const r = parseVv('[virt-viewer]\ntype=spice\nhost=\nport=5900\n')
    assert.strictEqual(r.ok, false)
    assert.match(r.error, /no usable host/)
  })

  it('rejects empty and non-string input', () => {
    const { parseVv } = getMod()
    assert.strictEqual(parseVv('').ok, false)
    assert.strictEqual(parseVv(null).ok, false)
    assert.strictEqual(parseVv(undefined).ok, false)
  })

  it('strips a UTF-8 BOM', () => {
    const { parseVv } = getMod()
    const r = parseVv('\uFEFF[virt-viewer]\ntype=spice\nhost=a\nport=5900\n')
    assert.strictEqual(r.ok, true, r.error)
    assert.strictEqual(r.fields.host, 'a')
  })

  it('handles CRLF line endings', () => {
    const { parseVv } = getMod()
    const r = parseVv('[virt-viewer]\r\ntype=spice\r\nhost=a\r\nport=5900\r\n')
    assert.strictEqual(r.fields.port, 5900)
  })

  it('ignores # and ; comments', () => {
    const { parseVv } = getMod()
    const r = parseVv(
      '# leading\n; another\n[virt-viewer]\n# inner\ntype=spice\nhost=a\nport=5900\n'
    )
    assert.strictEqual(r.ok, true, r.error)
    assert.strictEqual(r.fields.host, 'a')
  })

  it('is case-insensitive about group and key names', () => {
    const { parseVv } = getMod()
    const r = parseVv('[Virt-Viewer]\nType=Spice\nHOST=a\nPort=5900\n')
    assert.strictEqual(r.ok, true, r.error)
    assert.strictEqual(r.fields.host, 'a')
  })

  it('joins backslash line continuations', () => {
    const { parseVv } = getMod()
    const r = parseVv(
      '[virt-viewer]\ntype=spice\nhost=a\nport=5900\ntitle=my \\\nlong title\n'
    )
    assert.strictEqual(r.fields.title, 'my long title')
  })

  it('preserves a trailing space in a password', () => {
    const { parseVv } = getMod()
    const r = parseVv('[virt-viewer]\ntype=spice\nhost=a\nport=1\npassword=pw \n')
    assert.strictEqual(r.fields.password, 'pw ')
  })

  it('keeps = inside a value', () => {
    const { parseVv } = getMod()
    const r = parseVv('[virt-viewer]\ntype=spice\nhost=a\nport=1\npassword=a=b=c\n')
    assert.strictEqual(r.fields.password, 'a=b=c')
  })

  it('coerces port to a number', () => {
    const { parseVv } = getMod()
    const r = parseVv('[virt-viewer]\ntype=spice\nhost=a\nport=5930\n')
    assert.strictEqual(typeof r.fields.port, 'number')
    assert.strictEqual(r.fields.port, 5930)
  })

  it('warns and drops an out-of-range port', () => {
    const { parseVv } = getMod()
    const r = parseVv('[virt-viewer]\ntype=spice\nhost=a\nport=99999\n')
    assert.strictEqual(r.ok, true)
    assert.strictEqual(r.fields.port, undefined)
    assert.match(r.warnings.join('\n'), /invalid port/)
  })

  it('maps proxy straight through', () => {
    const { parseVv } = getMod()
    const r = parseVv(
      '[virt-viewer]\ntype=spice\nhost=a\nport=1\nproxy=http://10.0.15.50:3128\n'
    )
    assert.strictEqual(r.fields.proxy, 'http://10.0.15.50:3128')
  })

  it('warns when only tls-port is offered', () => {
    const { parseVv } = getMod()
    const r = parseVv('[virt-viewer]\ntype=spice\nhost=a\ntls-port=5901\n')
    assert.strictEqual(r.ok, true)
    assert.strictEqual(r.fields.port, undefined)
    assert.match(r.warnings.join('\n'), /only tls-port/)
  })

  it('uses port and notes tls-port when both are present', () => {
    const { parseVv } = getMod()
    const r = parseVv('[virt-viewer]\ntype=spice\nhost=a\nport=5900\ntls-port=5901\n')
    assert.strictEqual(r.fields.port, 5900)
    assert.strictEqual(r.ignored.length, 1)
    assert.strictEqual(r.ignored[0].key, 'tls-port')
  })

  it('reports an unknown key without failing', () => {
    const { parseVv } = getMod()
    const r = parseVv('[virt-viewer]\ntype=spice\nhost=a\nport=1\nfoo=bar\n')
    assert.strictEqual(r.ok, true)
    assert.deepStrictEqual(r.unknown, [{ key: 'foo', value: 'bar' }])
  })

  it('treats x- prefixed keys as unknown extensions', () => {
    const { parseVv } = getMod()
    const r = parseVv('[virt-viewer]\ntype=spice\nhost=a\nport=1\nx-a=b\n')
    assert.strictEqual(r.unknown[0].key, 'x-a')
  })

  it('flags delete-this-file without deleting anything', () => {
    const { parseVv } = getMod()
    const r = parseVv(
      '[virt-viewer]\ntype=spice\nhost=a\nport=1\ndelete-this-file=1\n'
    )
    assert.strictEqual(r.deleteThisFile, true)
    assert.match(r.warnings.join('\n'), /NOT deleted/)
  })

  it('reports the [ovirt] group as unsupported', () => {
    const { parseVv } = getMod()
    const r = parseVv(
      '[virt-viewer]\ntype=spice\nhost=a\nport=1\n[ovirt]\nhost=e\nvm-guid=g\n'
    )
    const keys = r.ignored.map(d => d.key)
    assert.ok(keys.includes('[ovirt]'), 'expected [ovirt] in ' + keys)
  })

  it('summarises a good file', () => {
    const { parseVv, describeVv } = getMod()
    const r = parseVv('[virt-viewer]\ntype=spice\nhost=127.0.0.1\nport=5930\ntitle=T\n')
    assert.strictEqual(describeVv(r), 'spice://127.0.0.1:5930 "T"')
  })

  it('summarises a bad file', () => {
    const { parseVv, describeVv } = getMod()
    assert.match(describeVv(parseVv('nope')), /missing \[virt-viewer\]/)
  })

  it('parseIni keeps unknown groups', () => {
    const { parseIni } = getMod()
    const groups = parseIni('[virt-viewer]\ntype=spice\n[x-thing]\na=b\n')
    assert.strictEqual(groups['virt-viewer'].type, 'spice')
    assert.strictEqual(groups['x-thing'].a, 'b')
  })

  it('handles a realistic oVirt-style file', () => {
    const { parseVv } = getMod()
    const r = parseVv([
      '[virt-viewer]',
      'type=spice',
      'host=10.0.0.42',
      'port=5900',
      'tls-port=5901',
      'password=sup3rs3cret ',
      'title=prod-db-01',
      'fullscreen=1',
      'delete-this-file=1',
      'ca=-----BEGIN CERTIFICATE-----\\nMIIB\\n-----END CERTIFICATE-----',
      'host-subject=O=Red Hat,CN=prod-db-01',
      'enable-smartcard=0',
      'color-depth=16',
      'disable-effects=wallpaper,font-smooth',
      'secure-channels=main,display,inputs',
      'proxy=http://10.0.15.50:3128',
      'x-custom-thing=whatever',
      '',
      '[ovirt]',
      'host=engine.example.com',
      'vm-guid=1b2c3d4e-5f60-7182-93a4-b5c6d7e8f901'
    ].join('\n'))
    assert.strictEqual(r.ok, true, r.error)
    assert.strictEqual(r.fields.host, '10.0.0.42')
    assert.strictEqual(r.fields.port, 5900)
    assert.strictEqual(r.fields.title, 'prod-db-01')
    assert.strictEqual(r.fields.proxy, 'http://10.0.15.50:3128')
    assert.strictEqual(r.fields.password, 'sup3rs3cret ')
    assert.strictEqual(r.deleteThisFile, true)
    const keys = r.ignored.map(d => d.key)
    ;[
      'tls-port',
      'ca',
      'host-subject',
      'enable-smartcard',
      'color-depth',
      'disable-effects',
      'secure-channels',
      '[ovirt]'
    ].forEach(k => {
      assert.ok(keys.includes(k), 'expected ' + k + ' in ' + keys)
    })
    assert.deepStrictEqual(r.unknown, [
      { key: 'x-custom-thing', value: 'whatever' }
    ])
  })
}

describe('parse-vv — src/client/common/parse-vv.js (ESM)', () => {
  let parseMod
  before(async () => {
    parseMod = await import('../../../src/client/common/parse-vv.js')
  })

  runTests(() => parseMod)
})
