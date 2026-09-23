const { describe, it, before } = require('node:test')
const assert = require('node:assert/strict')
const path = require('node:path')

// "is this a .vv file?" exists twice, once per half of the app:
//
//   src/app/common/vv-file.js        CJS, main process (command line, open-file)
//   src/client/common/vv-to-tab.js   ESM, renderer (isVvFile)
//
// A module cannot be shared across the two (different module systems, and the
// renderer one must stay import-free so node can load it), so the duplication
// is deliberate and the last block here is what keeps it honest.

function runMainTests (getMod) {
  describe('isVvFile', () => {
    it('accepts a .vv path, in any casing', () => {
      const { isVvFile } = getMod()
      assert.strictEqual(isVvFile('/tmp/console.vv'), true)
      assert.strictEqual(isVvFile('console.VV'), true)
      assert.strictEqual(isVvFile('C:\\Users\\me\\Downloads\\vm.vV'), true)
      assert.strictEqual(isVvFile('  /tmp/console.vv  '), true)
    })

    it('rejects anything that is not a .vv path', () => {
      const { isVvFile } = getMod()
      assert.strictEqual(isVvFile('/tmp/console.vvx'), false)
      assert.strictEqual(isVvFile('/tmp/vv'), false)
      assert.strictEqual(isVvFile(''), false)
      assert.strictEqual(isVvFile(undefined), false)
      assert.strictEqual(isVvFile(null), false)
      assert.strictEqual(isVvFile(42), false)
      assert.strictEqual(isVvFile('user@host'), false)
    })

    it('rejects a deep link that happens to end in .vv', () => {
      const { isVvFile } = getMod()
      assert.strictEqual(isVvFile('spice://host/console.vv'), false)
      assert.strictEqual(isVvFile('electerm://host/x.vv'), false)
    })
  })

  describe('resolveVvFile', () => {
    it('absolutises against the current working directory', () => {
      const { resolveVvFile } = getMod()
      assert.strictEqual(resolveVvFile('console.vv'), path.resolve('console.vv'))
      assert.strictEqual(resolveVvFile('/a/b/console.vv'), '/a/b/console.vv')
    })

    it('returns null for anything that is not a .vv file', () => {
      const { resolveVvFile } = getMod()
      assert.strictEqual(resolveVvFile('spice://host/x.vv'), null)
      assert.strictEqual(resolveVvFile('notes.txt'), null)
      assert.strictEqual(resolveVvFile(undefined), null)
    })
  })

  describe('findVvFile', () => {
    it('finds the .vv argument wherever it sits', () => {
      const { findVvFile } = getMod()
      assert.strictEqual(
        findVvFile(['/electron', '/app/app.js', '/a/console.vv']),
        '/a/console.vv'
      )
      // the packaged layout has no script path, so the file is argv[1]
      assert.strictEqual(
        findVvFile(['/Applications/electerm', '/a/console.vv']),
        '/a/console.vv'
      )
      // flags before or after do not matter
      assert.strictEqual(
        findVvFile(['/e', '/a/console.vv', '--disable-gpu', '--no-sandbox']),
        '/a/console.vv'
      )
    })

    it('resolves a relative argument', () => {
      const { findVvFile } = getMod()
      assert.strictEqual(
        findVvFile(['/e', '../lab/vv/console.vv']),
        path.resolve('../lab/vv/console.vv')
      )
    })

    it('ignores option-looking arguments', () => {
      const { findVvFile } = getMod()
      assert.strictEqual(findVvFile(['/e', '--out=-x.vv']), null)
    })

    it('ignores a deep link', () => {
      const { findVvFile } = getMod()
      assert.strictEqual(findVvFile(['/e', 'spice://host/console.vv']), null)
    })

    it('returns null when there is no .vv argument', () => {
      const { findVvFile } = getMod()
      assert.strictEqual(findVvFile([]), null)
      assert.strictEqual(findVvFile(['/e', 'user@host', '-P', '22']), null)
      assert.strictEqual(findVvFile(undefined), null)
      assert.strictEqual(findVvFile('console.vv'), null)
    })

    it('takes the first match when several are given', () => {
      const { findVvFile } = getMod()
      assert.strictEqual(
        findVvFile(['/e', '/a/one.vv', '/b/two.vv']),
        '/a/one.vv'
      )
    })
  })
}

describe('vv-file — src/app/common/vv-file.js (CJS, main process)', () => {
  let mainMod
  let rendererMod

  before(async () => {
    mainMod = require('../../../src/app/common/vv-file.js')
    rendererMod = await import('../../../src/client/common/vv-to-tab.js')
  })

  runMainTests(() => mainMod)

  describe('the main-process and renderer copies agree', () => {
    const CORPUS = [
      '/a/console.vv',
      'console.vv',
      'console.VV',
      'console.vV',
      'C:\\Users\\me\\vm.vv',
      '  /a/console.vv  ',
      'console.vvx',
      'console.vv.bak',
      'vv',
      '.vv',
      'vvvv',
      '',
      ' ',
      'spice://host/console.vv',
      'electerm://host/x.vv',
      'https://example.com/x.vv',
      'user@host',
      '/a/b/notes.txt',
      '-x.vv',
      '--file=x.vv',
      'a b.vv'
    ]

    it('agrees on every entry of the corpus', () => {
      CORPUS.forEach(value => {
        assert.strictEqual(
          mainMod.isVvFile(value),
          rendererMod.isVvFile(value),
          `isVvFile disagrees for ${JSON.stringify(value)}: ` +
            `main=${mainMod.isVvFile(value)} renderer=${rendererMod.isVvFile(value)}`
        )
      })
    })

    it('rejects the same non-strings', () => {
      ;[undefined, null, 42, {}, [], true].forEach(value => {
        assert.strictEqual(mainMod.isVvFile(value), false)
        assert.strictEqual(rendererMod.isVvFile(value), false)
      })
    })

    it('uses the same extension pattern', () => {
      assert.strictEqual(
        String(mainMod.VV_EXT),
        String(rendererMod.VV_EXT)
      )
    })
  })
})
