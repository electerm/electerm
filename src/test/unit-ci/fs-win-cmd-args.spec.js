// runtime-constants (via ../common/log) can only load its package.json with the
// dev flag outside a packaged app -- see log-debug-level.spec.js
process.env.NODE_ENV = 'development'

const { describe, test } = require('node:test')
const assert = require('node:assert/strict')

const { buildWinCmdArgs, buildFolderSizeWinScript } = require('../../app/lib/fs')

// GHSA-h4v2-5hq4-wc2g: the local folder-size script used to interpolate the
// folder path into a PowerShell single-quoted literal and escape only the ASCII
// apostrophe. PowerShell also treats the typographic quotes U+2018/U+2019/
// U+201A/U+201B as single-quote delimiters, and U+201C..U+201F as double-quote
// delimiters, so a folder name holding one of them closed the literal and the
// rest of the name ran as code -- with `-EncodedCommand` or without it, since
// that only removes the cmd.exe layer.
//
// The path is now base64-encoded and decoded inside the script: the base64
// alphabet carries no quote and no PowerShell metacharacter, so nothing in the
// folder name reaches the parser. These tests pin that, and pin the argv shape
// from the previous fix (GHSA-ph25-cg2g-62cf / GHSA-ch82-q8wq-2gfv).
const decode = (arg) => Buffer.from(arg, 'base64').toString('utf16le')

// how the script receives the path, mirrors buildFolderSizeWinScript
const PATH_RE = /\$p=\[System\.Text\.Encoding\]::UTF8\.GetString\(\[System\.Convert\]::FromBase64String\('([A-Za-z0-9+/=]*)'\)\)/

const pathArgOf = (script) => {
  const m = script.match(PATH_RE)
  assert.ok(m, `no base64 path argument in script: ${script}`)
  return Buffer.from(m[1], 'base64').toString('utf8')
}

// both delivery techniques from the advisories, plus the PowerShell smart
// quotes, plus generic cmd.exe soup
const hostileNames = [
  'project" & calc & rem \'',
  'test%CMDCMDLINE%end & calc & rem',
  'a & calc & "',
  'x" | calc',
  '$(calc)',
  'a\u2019;Set-Content PWNED x;#',
  'a\u2018;Set-Content PWNED x;#',
  'a\u201A;Set-Content PWNED x;#',
  'a\u201B;Set-Content PWNED x;#',
  'a\u201C;Set-Content PWNED x;\u201D',
  'a\u201D & calc & rem'
]

describe('buildWinCmdArgs', () => {
  test('passes the script as a single base64 argv entry', () => {
    const script = buildFolderSizeWinScript('C:\\Users\\zx\\dev')
    const args = buildWinCmdArgs(script)
    assert.deepEqual(
      args.slice(0, 4),
      ['-NoLogo', '-NonInteractive', '-NoProfile', '-EncodedCommand']
    )
    assert.equal(args.length, 5)
    assert.equal(decode(args[4]), script)
  })

  test('no argv entry carries a cmd.exe or shell metacharacter', () => {
    for (const name of hostileNames) {
      const args = buildWinCmdArgs(buildFolderSizeWinScript(name))
      for (const arg of args) {
        assert.doesNotMatch(arg, /["&|<>^%'`$;]/, `metacharacter leaked for ${name}`)
      }
    }
  })
})

describe('buildFolderSizeWinScript', () => {
  test('keeps a plain path out of the PowerShell source', () => {
    const script = buildFolderSizeWinScript('C:\\Users\\zx\\dev')
    assert.equal(pathArgOf(script), 'C:\\Users\\zx\\dev')
    assert.equal(script.split('\u0027').length - 1, 2, 'exactly one quoted literal')
  })

  test('hostile folder names reach the script only as base64', () => {
    // everything outside the base64 blob, i.e. what the parser actually sees
    const shape = (script) => script.replace(PATH_RE, '<b64>')
    const baseline = shape(buildFolderSizeWinScript('plain'))
    for (const name of hostileNames) {
      const script = buildFolderSizeWinScript(name)
      // the name round-trips byte for byte, nothing is normalised away
      assert.equal(pathArgOf(script), name)
      // ...and the script is byte-identical to the baseline once the base64
      // blob is masked out, so no character of the name leaks into the source
      assert.equal(shape(script), baseline, `script shape changed for ${JSON.stringify(name)}`)
      assert.equal(script.split('\u0027').length - 1, 2, 'exactly one quoted literal')
    }
  })

  test('uses -LiteralPath so wildcard characters in the name stay literal', () => {
    const script = buildFolderSizeWinScript('C:\\a[1]\\b')
    assert.ok(script.includes('Get-ChildItem -LiteralPath $p'))
    assert.equal(pathArgOf(script), 'C:\\a[1]\\b')
  })
})
