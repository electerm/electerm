const { test } = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const os = require('node:os')
const { execFileSync } = require('node:child_process')
const { getCommandTarget } = require('../../app/lib/install-command')

test('Linux archive updates and CLI shortcuts target the launcher', () => {
  assert.equal(getCommandTarget({ platform: 'linux', execPath: '/tmp/extracted/electerm-bin' }), '/tmp/extracted/electerm')
})

test('only the archive gets the launcher, which reuses sandbox setup after updating', { skip: process.platform !== 'linux' }, async t => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'linux-tar-sandbox-'))
  t.after(() => fs.rmSync(root, { recursive: true, force: true }))
  const name = 'electerm-1.2.3-linux-x64'
  const original = path.join(root, name)
  const target = path.join(root, 'extracted app')
  const bin = path.join(root, 'bin')
  const cache = path.join(root, 'cache')
  for (const dir of [original, target, bin, cache]) fs.mkdirSync(dir)
  const write = (file, body) => fs.writeFileSync(file, '#!/bin/sh\nset -eu\n' + body + '\n', { mode: 0o755 })
  write(path.join(original, 'electerm'), 'printf "%s\\n" "$@" > "$LOG"')
  fs.writeFileSync(path.join(original, 'chrome-sandbox'), 'fixture helper')
  const build = path.resolve(__dirname, '../../build/bin/pack-cross-linux-tar.sh')
  execFileSync('sh', [build, root, name])
  assert.equal(fs.existsSync(path.join(original, 'electerm-bin')), false)
  const extract = dir => {
    execFileSync('tar', ['-xzf', path.join(root, name + '.tar.gz'), '--strip-components=1', '-C', dir])
    // Isolate the privileged cache and simulate PolicyKit approval in user CI.
    const launcher = path.join(dir, 'electerm')
    fs.writeFileSync(launcher, fs.readFileSync(launcher, 'utf8').replaceAll('/var/lib/electerm-sandbox', cache))
  }
  extract(target)
  const env = {
    ...process.env,
    PATH: bin + ':' + process.env.PATH,
    LOG: path.join(root, 'launch.log'),
    CACHE: cache,
    USERNS_STATUS: '0',
    DENY_SETUP: '0'
  }
  write(path.join(bin, 'unshare'), 'exit "$USERNS_STATUS"')
  write(path.join(bin, 'stat'), 'if [ "$3" = "$CACHE/x64" ]; then echo 0:4755; else /usr/bin/stat "$@"; fi')
  write(path.join(bin, 'pkexec'), `[ "$DENY_SETUP" = 0 ] || exit 126
echo approved >> "$CACHE/prompts"
cat > "$CACHE/x64"
chmod 755 "$CACHE/x64"`)
  const launch = () => execFileSync('./electerm', ['two words'], { cwd: target, env, stdio: 'pipe' })
  launch()
  assert.equal(fs.existsSync(path.join(cache, 'prompts')), false)
  env.USERNS_STATUS = '1'
  fs.unlinkSync(env.LOG)
  env.DENY_SETUP = '1'
  assert.throws(launch, { status: 126 })
  assert.equal(fs.existsSync(env.LOG), false)
  env.DENY_SETUP = '0'
  launch()
  assert.equal(fs.readFileSync(env.LOG, 'utf8'), 'two words\n')
  assert.equal(fs.readlinkSync(path.join(target, 'chrome-sandbox')), path.join(cache, 'x64'))

  const job = fs.mkdtempSync(path.join(root, 'electerm-update-'))
  const payload = path.join(job, 'unpacked')
  fs.mkdirSync(payload)
  extract(payload)
  const installer = path.join(job, 'install.sh')
  fs.copyFileSync(require.resolve('@electerm/updater/install.sh'), installer)
  fs.unlinkSync(env.LOG)
  execFileSync('sh', [installer, 'tar.gz', payload, target, '0'], { env })
  for (let i = 0; i < 100 && !fs.existsSync(env.LOG); i++) await new Promise(resolve => setTimeout(resolve, 50))
  assert.equal(fs.readFileSync(env.LOG, 'utf8'), '\n')
  assert.equal(fs.readFileSync(path.join(cache, 'prompts'), 'utf8'), 'approved\n')
})
