/**
 * Unit tests for the MCP transfer guard.
 *
 * GHSA-vw4q-c6px-w5p3: the SFTP transfer tools took a caller-supplied
 * `localPath` and the renderer force-set a global conflict policy, so an MCP
 * client (or an AI steered by injected content) could write `~/.bashrc` or read
 * `~/.ssh/id_rsa` with no dialog. What is pinned here is the screening half of
 * the fix: which paths must ask the human, and which conflict policies a client
 * is actually allowed to name.
 *
 * The wiring half (no global policy, per-transfer resolvePolicy, write tools
 * opt-in) is asserted from the source below, because a behavioural test needs a
 * live renderer — see src/test/integration/mcp.spec.js for that.
 */

const { test, describe, before } = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')

let guard

before(async () => {
  guard = await import('../../../src/client/common/mcp-transfer-guard.js')
})

const HOME = '/Users/tester'

describe('normalizeLocalPath', () => {
  test('expands a leading ~ and folds windows separators', () => {
    assert.equal(guard.normalizeLocalPath('~/a/b.txt', HOME), '/Users/tester/a/b.txt')
    assert.equal(guard.normalizeLocalPath('~', HOME), HOME)
    assert.equal(
      guard.normalizeLocalPath('C:\\Users\\tester\\a.txt', HOME),
      'C:/Users/tester/a.txt'
    )
  })

  test('collapses . and .. so a traversal cannot hide the real target', () => {
    assert.equal(
      guard.normalizeLocalPath('~/Downloads/../.ssh/id_rsa', HOME),
      '/Users/tester/.ssh/id_rsa'
    )
    assert.equal(guard.normalizeLocalPath('/tmp/./a/../b', HOME), '/tmp/b')
  })

  test('is empty for a missing or non-string path', () => {
    assert.equal(guard.normalizeLocalPath('', HOME), '')
    assert.equal(guard.normalizeLocalPath('   ', HOME), '')
    assert.equal(guard.normalizeLocalPath(null, HOME), '')
    assert.equal(guard.normalizeLocalPath(42, HOME), '')
  })
})

describe('sensitiveWritePath', () => {
  test('flags paths the host executes on the next shell or login', () => {
    const paths = [
      '~/.bashrc',
      '~/.zshrc',
      '~/.bash_profile',
      '~/.config/fish/config.fish',
      '~/.ssh/authorized_keys',
      '~/.ssh/config',
      '~/.config/autostart/evil.desktop',
      '~/.config/systemd/user/evil.service',
      '~/Library/LaunchAgents/evil.plist',
      '/Users/tester/Library/LaunchDaemons/evil.plist',
      '~/.gitconfig',
      '~/.config/git/config',
      '~/appdata/Roaming/Microsoft/Windows/Start Menu/Programs/Startup/evil.exe'
    ]
    for (const p of paths) {
      assert.ok(guard.sensitiveWritePath(p, HOME), `expected sensitive: ${p}`)
    }
  })

  test('does not flag an ordinary download destination', () => {
    const paths = [
      '~/Downloads/report.txt',
      '/tmp/out.tar.gz',
      '~/Documents/notes/.ssh-notes.md',
      '~/projects/app/.envrc.example',
      '~/.bashrc-backup'
    ]
    for (const p of paths) {
      assert.equal(guard.sensitiveWritePath(p, HOME), '', `expected clean: ${p}`)
    }
  })

  test('sees through a traversal and through a windows separator', () => {
    assert.ok(guard.sensitiveWritePath('~/Downloads/../../.ssh/id_rsa', HOME))
    assert.ok(guard.sensitiveWritePath('C:\\Users\\tester\\.bashrc', HOME))
    assert.ok(guard.sensitiveWritePath('/Users/tester/.SSH/authorized_keys', HOME))
  })
})

describe('sensitiveReadPath', () => {
  test('flags credential stores and private keys', () => {
    const paths = [
      '~/.ssh/id_rsa',
      '~/.ssh/config',
      '~/.aws/credentials',
      '~/.kube/config',
      '~/.docker/config.json',
      '~/.netrc',
      '~/.npmrc',
      '~/.git-credentials',
      '~/.config/gcloud/application_default_credentials.json',
      '~/projects/app/.env'
    ]
    for (const p of paths) {
      assert.ok(guard.sensitiveReadPath(p, HOME), `expected sensitive: ${p}`)
    }
  })

  test('does not flag an ordinary document', () => {
    for (const p of ['~/Downloads/report.txt', '~/projects/app/README.md']) {
      assert.equal(guard.sensitiveReadPath(p, HOME), '', `expected clean: ${p}`)
    }
  })
})

describe('decideTransferApproval', () => {
  const decide = spec => guard.decideTransferApproval({ homeDir: HOME, ...spec })

  test('a download is screened by its local destination', () => {
    const hit = decide({
      direction: 'download',
      fromPath: '/remote/x.txt',
      toPath: '~/.bashrc'
    })
    assert.equal(hit.requireApproval, true)
    assert.deepEqual(hit.reasons.map(r => r.code), ['sensitive-write'])
    assert.equal(hit.reasons[0].path, '/Users/tester/.bashrc')
  })

  test('an upload is screened by its local source', () => {
    const hit = decide({
      direction: 'upload',
      fromPath: '~/.ssh/id_rsa',
      toPath: '/tmp/loot'
    })
    assert.equal(hit.requireApproval, true)
    assert.deepEqual(hit.reasons.map(r => r.code), ['sensitive-read'])
  })

  test('the direction decides which side is local', () => {
    // uploading FROM a shell rc is odd but harmless; downloading TO it is not
    assert.equal(decide({
      direction: 'upload',
      fromPath: '~/.bashrc',
      toPath: '/tmp/x'
    }).requireApproval, false)
    assert.equal(decide({
      direction: 'download',
      fromPath: '/remote/id_rsa',
      toPath: '~/Downloads/id_rsa_loot'
    }).requireApproval, false)
  })

  test('whitelist mode asks for every transfer', () => {
    const hit = decide({
      direction: 'download',
      fromPath: '/remote/x.txt',
      toPath: '~/Downloads/x.txt',
      strict: true
    })
    assert.equal(hit.requireApproval, true)
    assert.deepEqual(hit.reasons.map(r => r.code), ['strict-mode'])
  })

  test('an ordinary transfer in the default mode is not gated', () => {
    const hit = decide({
      direction: 'download',
      fromPath: '/remote/x.txt',
      toPath: '~/Downloads/x.txt'
    })
    assert.equal(hit.requireApproval, false)
    assert.deepEqual(hit.reasons, [])
  })

  test('garbage input does not throw', () => {
    assert.equal(guard.decideTransferApproval().requireApproval, false)
    assert.equal(decide({ direction: 'download', toPath: null }).requireApproval, false)
  })
})

describe('normalizeConflictPolicy', () => {
  test('keeps the real fileActions values', () => {
    assert.equal(guard.normalizeConflictPolicy('mergeOrOverwriteAll'), 'mergeOrOverwriteAll')
    assert.equal(guard.normalizeConflictPolicy('renameAll'), 'renameAll')
  })

  test('maps the aliases the old schemas advertised', () => {
    assert.equal(guard.normalizeConflictPolicy('overwrite'), 'mergeOrOverwriteAll')
    assert.equal(guard.normalizeConflictPolicy('rename'), 'renameAll')
  })

  test('rejects anything else', () => {
    for (const p of ['skip', 'cancel', 'MergeOrOverwriteAll', '', null, 1]) {
      assert.equal(guard.normalizeConflictPolicy(p), null, `expected null: ${p}`)
    }
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// Wiring regressions: the pieces a unit test cannot exercise without a renderer
// ─────────────────────────────────────────────────────────────────────────────

const root = path.join(__dirname, '../../..')
const read = rel => fs.readFileSync(path.join(root, rel), 'utf8')

describe('transfer wiring', () => {
  test('the global conflict policy side channel is gone', () => {
    for (const rel of [
      'src/client/store/mcp-handler.js',
      'src/client/components/file-transfer/conflict-resolve.jsx'
    ]) {
      assert.ok(
        !read(rel).includes('_transferConflictPolicy'),
        `${rel} must not use the global transfer conflict policy`
      )
    }
  })

  test('MCP transfers resolve per transfer, and only through the guard', () => {
    const src = read('src/client/store/mcp-handler.js')
    assert.ok(src.includes('transferItem.resolvePolicy = resolvePolicy'))
    assert.ok(src.includes('mcpApproveTransfer'))
    assert.ok(src.includes('decideTransferApproval'))
  })

  test('the write tools are opt-in and default to off', () => {
    const src = read('src/app/widgets/widget-mcp-server.js')
    assert.ok(/name: 'enableSftpWrite',\s+type: 'boolean',\s+default: false/.test(src))
    assert.ok(/name: 'autoConfirmTransfers',\s+type: 'boolean',\s+default: false/.test(src))
    assert.ok(src.includes('if (this.config.enableSftpWrite) {'))
  })

  test('the transfer policy the widget sends is strict-aware', () => {
    const src = read('src/app/widgets/widget-mcp-server.js')
    assert.ok(src.includes('getTransferPolicy ()'))
    assert.ok(src.includes("mode === 'whitelist'"))
    assert.ok(src.includes('transferPolicy: self.getTransferPolicy()'))
  })
})
