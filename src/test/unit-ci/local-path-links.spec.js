const { describe, test } = require('node:test')
const assert = require('node:assert/strict')

const load = () => import('../../client/components/terminal/local-path-links.js')

const win = { isWin: true }
const posix = { isWin: false }

describe('local path candidates', () => {
  test('finds Windows absolute paths and relative paths with a separator', async () => {
    const { findPathCandidates } = await load()
    const line = 'Mode  Name        D:\\work\\project\\a.ts  src\\b.js  c.ts'
    assert.deepEqual(
      findPathCandidates(line, win).map(d => d.text),
      ['D:\\work\\project\\a.ts', 'src\\b.js']
    )
  })

  test('keeps the offsets pointing at the token inside the line', async () => {
    const { findPathCandidates } = await load()
    const line = 'see src\\a.ts here'
    const [candidate] = findPathCandidates(line, win)
    assert.equal(candidate.start, 4)
    assert.equal(line.slice(candidate.start, candidate.end), 'src\\a.ts')
  })

  test('drops the punctuation a terminal glues onto a path', async () => {
    const { findPathCandidates } = await load()
    assert.deepEqual(
      findPathCandidates('(D:\\work\\a.ts),', win).map(d => d.text),
      ['D:\\work\\a.ts']
    )
    assert.deepEqual(
      findPathCandidates('[D:\\work\\a.ts]', win).map(d => d.text),
      ['D:\\work\\a.ts']
    )
  })

  // A directory may really be named that: only a *balanced* closing bracket is
  // part of the path, so the unbalanced one from the surrounding text goes.
  test('keeps a balanced bracket inside a directory name', async () => {
    const { findPathCandidates } = await load()
    assert.deepEqual(
      findPathCandidates('(D:\\work(x86))', win).map(d => d.text),
      ['D:\\work(x86)']
    )
    assert.deepEqual(
      findPathCandidates('"C:\\Program Files (x86)"', win).map(d => d.text),
      ['C:\\Program Files (x86)']
    )
  })

  // A quoted path is one token, spaces and all. An unquoted path with a space
  // is ambiguous (`C:\Program` + `Files`), so it is deliberately not guessed.
  test('accepts a quoted path with spaces', async () => {
    const { findPathCandidates } = await load()
    const line = 'cannot open "C:\\Program Files\\app.exe" now'
    const [candidate] = findPathCandidates(line, win)
    assert.equal(candidate.text, 'C:\\Program Files\\app.exe')
    assert.equal(
      line.slice(candidate.start, candidate.end),
      'C:\\Program Files\\app.exe'
    )
  })

  test('ignores urls, bare words, flags and home-relative paths', async () => {
    const { findPathCandidates } = await load()
    const line = 'https://example.com/a/b a.ts --flag=1/2 ~/notes.txt ./x'
    assert.deepEqual(
      findPathCandidates(line, win).map(d => d.text),
      ['./x']
    )
    assert.deepEqual(
      findPathCandidates(line, posix).map(d => d.text),
      ['./x']
    )
  })

  // `and/or` *is* a candidate: there is no syntax that tells a sentence slash
  // from a directory one, so the caller's existence check is what drops it.
  test('offers a slashed word as a candidate for the existence check to reject', async () => {
    const { findPathCandidates } = await load()
    assert.deepEqual(
      findPathCandidates('and/or', posix).map(d => d.text),
      ['and/or']
    )
  })

  test('finds posix paths but not Windows drive paths on posix', async () => {
    const { findPathCandidates } = await load()
    assert.deepEqual(
      findPathCandidates('/var/log/syslog and ./src/a.ts', posix).map(d => d.text),
      ['/var/log/syslog', './src/a.ts']
    )
    assert.deepEqual(findPathCandidates('D:\\work\\a.ts', posix).map(d => d.text), [])
  })

  test('finds UNC paths on Windows', async () => {
    const { findPathCandidates } = await load()
    assert.deepEqual(
      findPathCandidates('copy \\\\server\\share\\a.txt', win).map(d => d.text),
      ['\\\\server\\share\\a.txt']
    )
  })
})

describe('local path resolution', () => {
  test('resolves a relative Windows path against the shell cwd', async () => {
    const { resolveLocalPath } = await load()
    assert.equal(
      resolveLocalPath('src\\a.ts', 'D:\\work\\project', win),
      'D:\\work\\project\\src\\a.ts'
    )
    assert.equal(
      resolveLocalPath('.\\a.ts', 'D:\\work\\project\\', win),
      'D:\\work\\project\\a.ts'
    )
    assert.equal(
      resolveLocalPath('..\\a.ts', 'D:\\work\\project', win),
      'D:\\work\\a.ts'
    )
  })

  test('resolves mixed separators and keeps the drive', async () => {
    const { resolveLocalPath } = await load()
    assert.equal(
      resolveLocalPath('src/a.ts', 'D:\\work', win),
      'D:\\work\\src\\a.ts'
    )
    assert.equal(
      resolveLocalPath('/src/a.ts', 'D:\\work', win),
      '\\src\\a.ts'
    )
  })

  test('resolves a relative posix path against the shell cwd', async () => {
    const { resolveLocalPath } = await load()
    assert.equal(resolveLocalPath('./a.ts', '/home/me', posix), '/home/me/a.ts')
    assert.equal(resolveLocalPath('../a.ts', '/home/me/sub', posix), '/home/me/a.ts')
    assert.equal(resolveLocalPath('src/a.ts', '/home/me', posix), '/home/me/src/a.ts')
  })

  test('cannot resolve a relative path without a cwd', async () => {
    const { resolveLocalPath } = await load()
    assert.equal(resolveLocalPath('src/a.ts', '', posix), '')
    assert.equal(resolveLocalPath('src\\a.ts', '', win), '')
    // an absolute path needs no cwd
    assert.equal(resolveLocalPath('/etc/hosts', '', posix), '/etc/hosts')
  })

  test('never escapes the root while collapsing ..', async () => {
    const { normalizeLocalPath } = await load()
    assert.equal(normalizeLocalPath('/../etc/hosts', posix), '/etc/hosts')
    assert.equal(normalizeLocalPath('D:\\..\\..\\a', win), 'D:\\a')
  })
})

describe('file:// urls (OSC 8)', () => {
  test('converts a Windows file url to a path', async () => {
    const { fileUrlToPath } = await load()
    assert.equal(fileUrlToPath('file:///D:/work/a%20b.ts', win), 'D:\\work\\a b.ts')
    assert.equal(fileUrlToPath('file://server/share/a.ts', win), '\\\\server\\share\\a.ts')
  })

  test('converts a posix file url to a path', async () => {
    const { fileUrlToPath } = await load()
    assert.equal(fileUrlToPath('file:///home/me/a.ts', posix), '/home/me/a.ts')
    assert.equal(fileUrlToPath('file:///home/me/a.ts#L12', posix), '/home/me/a.ts')
  })

  test('refuses every other scheme', async () => {
    const { fileUrlToPath } = await load()
    for (const url of ['https://a/b', 'javascript:alert(1)', 'smb://s/x', '', 'file.txt']) {
      assert.equal(fileUrlToPath(url, win), '', url)
    }
  })
})

describe('terminal line cells', () => {
  // A wide character occupies two cells but one string character, so a link
  // range computed from string offsets would drift on a CJK line.
  const makeLine = (chars) => ({
    length: chars.reduce((n, c) => n + (c.wide ? 2 : 1), 0),
    getCell: (x) => {
      if (x >= chars.reduce((n, c) => n + (c.wide ? 2 : 1), 0)) {
        return null
      }
      let cursor = 0
      for (const c of chars) {
        const width = c.wide ? 2 : 1
        if (x >= cursor && x < cursor + width) {
          if (width === 2 && x === cursor + 1) {
            return { getWidth: () => 0, getChars: () => '' }
          }
          return { getWidth: () => width, getChars: () => c.text }
        }
        cursor += width
      }
      return null
    }
  })

  test('maps a character index back to its cell column', async () => {
    const { readLineCells } = await load()
    const line = makeLine([
      { text: '中', wide: true },
      { text: '文', wide: true },
      { text: ' ' },
      { text: 'a' },
      { text: 'b' }
    ])
    const { text, cells } = readLineCells(line)
    assert.equal(text, '中文 ab')
    // both CJK characters take two cells each, then the space
    assert.deepEqual(cells, [0, 2, 4, 5, 6])
  })
})
