/**
 * Importing a widget from a git host: what a user pastes, how the tree is
 * downloaded, and how the widget folder inside a repo is found.
 *
 * No network here: `downloadSource` takes the http client, so the two hosts are
 * faked from a temp folder (a real tar.gz for GitHub's archive, a contents
 * listing for AtomGit's API).
 */

const { describe, it, before, after } = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const os = require('node:os')
const path = require('node:path')

const {
  parseWidgetSource,
  downloadSource,
  findWidgetRoot,
  fetchWidgetSource
} = require('../../app/widgets/widget-source')

let tmp

before(() => {
  tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'electerm-widget-source-'))
})

after(() => {
  fs.rmSync(tmp, { recursive: true, force: true })
})

function write (dir, files) {
  for (const [name, content] of Object.entries(files)) {
    const file = path.join(dir, name)
    fs.mkdirSync(path.dirname(file), { recursive: true })
    fs.writeFileSync(file, content)
  }
  return dir
}

function walk (dir, prefix = '') {
  return fs.readdirSync(dir).flatMap(name => {
    const file = path.join(dir, name)
    return fs.statSync(file).isDirectory()
      ? walk(file, `${prefix}${name}/`)
      : [`${prefix}${name}`]
  }).sort()
}

// A GitHub archive: one `<owner>-<repo>-<sha>/` wrapper around the tree, which
// is what `strip: 1` in fetchTarball assumes.
function tarballHttp (files) {
  const tar = require('tar')
  const src = path.join(tmp, 'archive-src')
  const wrapper = path.join(src, 'owner-repo-abc123')
  fs.rmSync(src, { recursive: true, force: true })
  write(wrapper, files)
  return {
    archiveRequests: [],
    async getStream (url) {
      this.archiveRequests.push(url)
      return tar.c({ gzip: true, cwd: src, portable: true }, ['owner-repo-abc123'])
    }
  }
}

// An AtomGit contents API: listings by folder, blobs by url.
function contentsHttp (tree, blobs) {
  return {
    requests: [],
    async getJSON (url) {
      this.requests.push(url)
      const match = /\/contents(\/[^?]*)?/.exec(url)
      const folder = match && match[1] ? match[1].slice(1) : ''
      if (!tree[folder]) {
        const err = new Error('HTTP 404')
        err.status = 404
        throw err
      }
      return tree[folder]
    },
    async getBuffer (url) {
      if (!(url in blobs)) {
        throw new Error(`unexpected blob ${url}`)
      }
      return Buffer.from(blobs[url])
    }
  }
}

const atomFile = (name, folder = '') => ({
  type: 'file',
  name,
  path: folder ? `${folder}/${name}` : name,
  download_url: `https://raw.atomgit.com/owner/repo/blobs/${name}/${name}`
})

const widgetPkg = JSON.stringify({
  name: 'demo-widget',
  version: '1.0.0',
  main: 'index.js',
  electerm: { id: 'demo-widget', name: 'Demo', type: 'once' }
})

describe('parseWidgetSource', () => {
  const cases = [
    ['owner/repo', 'github.com', 'owner', 'repo', '', ''],
    ['  owner/repo  ', 'github.com', 'owner', 'repo', '', ''],
    ['owner/repo#dev', 'github.com', 'owner', 'repo', 'dev', ''],
    ['owner/repo/widgets/foo', 'github.com', 'owner', 'repo', '', 'widgets/foo'],
    ['owner/repo/widgets/foo#dev', 'github.com', 'owner', 'repo', 'dev', 'widgets/foo'],
    ['https://github.com/owner/repo', 'github.com', 'owner', 'repo', '', ''],
    ['https://github.com/owner/repo.git', 'github.com', 'owner', 'repo', '', ''],
    ['https://www.github.com/owner/repo/', 'github.com', 'owner', 'repo', '', ''],
    ['github.com/owner/repo', 'github.com', 'owner', 'repo', '', ''],
    ['https://github.com/owner/repo/tree/main/widgets/foo', 'github.com', 'owner', 'repo', 'main', 'widgets/foo'],
    // a link to a file: the widget is the folder holding it
    ['https://github.com/owner/repo/blob/main/widgets/foo/package.json', 'github.com', 'owner', 'repo', 'main', 'widgets/foo'],
    ['git@github.com:owner/repo.git', 'github.com', 'owner', 'repo', '', ''],
    ['https://atomgit.com/owner/repo', 'atomgit.com', 'owner', 'repo', '', ''],
    ['atomgit.com/owner/repo/tree/dev', 'atomgit.com', 'owner', 'repo', 'dev', '']
  ]
  for (const [input, host, owner, repo, ref, subdir] of cases) {
    it(`reads ${JSON.stringify(input)}`, () => {
      const source = parseWidgetSource(input)
      assert.equal(source.host, host)
      assert.equal(source.owner, owner)
      assert.equal(source.repo, repo)
      assert.equal(source.ref, ref)
      assert.equal(source.subdir, subdir)
      assert.ok(source.label.startsWith(host))
    })
  }

  it('rejects what it cannot import, with a readable message', () => {
    const bad = [
      ['', /give a repository/],
      ['   ', /give a repository/],
      ['owner', /owner\/repo/],
      ['https://github.com/owner', /does not name a repository/],
      ['https://gitlab.com/owner/repo', /only github\.com and atomgit\.com/],
      ['owner/../repo', /not a usable repository name/],
      ['owner/repo#../main', /not a usable branch or tag/],
      ['owner/repo#-x', /not a usable branch or tag/],
      ['owner/repo/../etc', /not a usable folder/]
    ]
    for (const [input, expected] of bad) {
      assert.throws(() => parseWidgetSource(input), expected, input)
    }
  })

  it('carries the ref and folder into the label', () => {
    assert.equal(
      parseWidgetSource('owner/repo/widgets/foo#dev').label,
      'github.com/owner/repo#dev/widgets/foo'
    )
  })
})

describe('downloadSource', () => {
  it('unwraps a github archive and drops .git', async () => {
    const http = tarballHttp({
      'package.json': widgetPkg,
      'index.js': 'module.exports = {}\n',
      'lib/helper.js': 'module.exports = 1\n',
      '.git/config': 'nope\n'
    })
    const dir = path.join(tmp, 'gh')
    await downloadSource(parseWidgetSource('owner/repo'), dir, http)
    assert.deepEqual(walk(dir), [
      'index.js',
      'lib/helper.js',
      'package.json'
    ])
    assert.equal(http.archiveRequests.length, 1)
    assert.match(http.archiveRequests[0], /codeload\.github\.com\/owner\/repo\/tar\.gz\/HEAD$/)
  })

  it('asks for the named branch', async () => {
    const http = tarballHttp({ 'package.json': widgetPkg })
    await downloadSource(parseWidgetSource('owner/repo#dev'), path.join(tmp, 'gh-ref'), http)
    assert.match(http.archiveRequests[0], /tar\.gz\/dev$/)
  })

  it('walks an atomgit repo through the contents api', async () => {
    const http = contentsHttp({
      '': [atomFile('package.json'), { type: 'dir', name: 'lib', path: 'lib' }, atomFile('.gitignore')],
      lib: [atomFile('a.js', 'lib')]
    }, {
      'https://raw.atomgit.com/owner/repo/blobs/package.json/package.json': widgetPkg,
      'https://raw.atomgit.com/owner/repo/blobs/a.js/a.js': 'module.exports = 1\n'
    })
    const dir = path.join(tmp, 'ag')
    await downloadSource(parseWidgetSource('https://atomgit.com/owner/repo'), dir, http)
    assert.deepEqual(walk(dir), ['lib/a.js', 'package.json'])
    assert.equal(http.requests[0], 'https://atomgit.com/api/v5/repos/owner/repo/contents')
  })

  it('walks the folder named in the source, and asks for its ref', async () => {
    const http = contentsHttp({
      'widgets/foo': [atomFile('package.json', 'widgets/foo')]
    }, {
      'https://raw.atomgit.com/owner/repo/blobs/package.json/package.json': widgetPkg
    })
    const dir = path.join(tmp, 'ag-sub')
    await downloadSource(
      parseWidgetSource('https://atomgit.com/owner/repo/tree/dev/widgets/foo'),
      dir,
      http
    )
    assert.deepEqual(walk(dir), ['package.json'])
    assert.equal(
      http.requests[0],
      'https://atomgit.com/api/v5/repos/owner/repo/contents/widgets/foo?ref=dev'
    )
  })

  it('refuses a download link outside the host', async () => {
    const http = contentsHttp({
      '': [{
        type: 'file',
        name: 'package.json',
        path: 'package.json',
        download_url: 'https://evil.example.com/package.json'
      }]
    }, {})
    await assert.rejects(
      downloadSource(parseWidgetSource('https://atomgit.com/owner/repo'), path.join(tmp, 'ag-evil'), http),
      /refusing to download from evil\.example\.com/
    )
  })

  it('skips names that would escape the folder', async () => {
    const http = contentsHttp({
      '': [{ type: 'file', name: '../../escape', path: '../../escape', download_url: 'x' }]
    }, {})
    const dir = path.join(tmp, 'ag-escape')
    await downloadSource(parseWidgetSource('https://atomgit.com/owner/repo'), dir, http)
    assert.deepEqual(walk(dir), [])
  })
})

describe('findWidgetRoot', () => {
  it('takes a repo whose own package.json is the widget', () => {
    const dir = write(path.join(tmp, 'root-pkg'), { 'package.json': widgetPkg })
    assert.equal(findWidgetRoot(dir), dir)
  })

  it('finds the widget folder in a monorepo', () => {
    const dir = write(path.join(tmp, 'mono'), {
      'package.json': JSON.stringify({ name: 'mono', private: true }),
      'widgets/foo/package.json': widgetPkg,
      'widgets/foo/index.js': ''
    })
    assert.equal(findWidgetRoot(dir), path.join(dir, 'widgets', 'foo'))
  })

  it('prefers the shallowest widget', () => {
    const dir = write(path.join(tmp, 'nested'), {
      'package.json': widgetPkg,
      'examples/other/package.json': widgetPkg
    })
    assert.equal(findWidgetRoot(dir), dir)
  })

  it('stops on a repo with several widgets instead of picking one', () => {
    const dir = write(path.join(tmp, 'many'), {
      'widgets/a/package.json': widgetPkg,
      'widgets/b/package.json': widgetPkg
    })
    assert.throws(() => findWidgetRoot(dir), /holds 2 widgets \(widgets\/a, widgets\/b\)/)
  })

  it('does not look into node_modules or hidden folders', () => {
    const dir = write(path.join(tmp, 'ignored'), {
      'package.json': JSON.stringify({ name: 'plain' }),
      'node_modules/dep/package.json': widgetPkg,
      '.hidden/package.json': widgetPkg
    })
    // falls back to the root manifest, which the loader then rejects
    assert.equal(findWidgetRoot(dir), dir)
  })

  it('rejects a repo with no manifest at all', () => {
    const dir = write(path.join(tmp, 'empty-repo'), { 'README.md': 'hi' })
    assert.throws(() => findWidgetRoot(dir, 'github.com/o/r'), /has no package\.json/)
  })
})

describe('fetchWidgetSource', () => {
  it('resolves the widget folder and cleans up on failure', async () => {
    const http = contentsHttp({
      '': [atomFile('README.md')]
    }, {
      'https://raw.atomgit.com/owner/repo/blobs/README.md/README.md': 'hi'
    })
    const roots = []
    const realMkdtemp = fs.mkdtempSync
    fs.mkdtempSync = (prefix) => {
      const dir = realMkdtemp(prefix)
      roots.push(dir)
      return dir
    }
    try {
      await assert.rejects(
        fetchWidgetSource('https://atomgit.com/owner/repo', { http }),
        /has no package\.json/
      )
    } finally {
      fs.mkdtempSync = realMkdtemp
    }
    assert.equal(roots.length, 1)
    assert.equal(fs.existsSync(roots[0]), false, 'the temp folder is removed')
  })

  it('returns the widget folder inside the download and cleans it up on request', async () => {
    const http = tarballHttp({
      'widgets/foo/package.json': widgetPkg,
      'widgets/foo/index.js': ''
    })
    const result = await fetchWidgetSource('owner/repo', { http })
    assert.equal(path.basename(result.dir), 'foo')
    assert.equal(result.source.label, 'github.com/owner/repo')
    assert.ok(fs.existsSync(result.dir))
    result.cleanup()
    assert.equal(fs.existsSync(result.root), false)
  })
})
