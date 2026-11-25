/**
 * Load system-trusted CA certificates into Node.js TLS store.
 * Node.js uses its own bundled CA store and does not trust OS-level
 * certificates by default. This module exports those certs so they
 * can be passed to https.Agent as additional trusted CAs.
 */

const { promisify } = require('util')
const { execFile, execFileSync } = require('child_process')
const { existsSync, readdirSync, readFileSync } = require('fs')
const { join } = require('path')
const os = require('os')

// A certificate store dump is a few hundred KB on a stock system and grows with
// every CA the user adds (163 certs / 244KB on a default macOS install), so the
// 1MB default is too close for comfort.
const MAX_BUFFER = 64 * 1024 * 1024

let _certs = null

/**
 * Keychains to read on macOS. Every entry is its own argv element and the
 * command never goes through a shell: the login keychain path used to be
 * concatenated into a shell command line, so a home directory containing a
 * space (`/Users/john doe`) made `security` fail and this function returned ''
 * — silently, because the failure is swallowed below. The CA store then held
 * nothing from the OS and every sync to a server with an internal CA failed
 * with "unable to get local issuer certificate" no matter what the user
 * installed.
 * @param {string} home
 * @returns {string[]}
 */
function buildMacArgs (home) {
  return [
    'find-certificate',
    '-a',
    '-p',
    '/System/Library/Keychains/SystemRootCertificates.keychain',
    '/Library/Keychains/System.keychain',
    join(home, 'Library/Keychains/login.keychain-db')
  ]
}

// The script has no interpolation, but it is still handed over as
// -EncodedCommand: through `powershell -Command "<script>"` the quoting is
// re-parsed by console applications, which is the trap described in
// buildWinCmdArgs() in lib/fs.js.
const WIN_CA_SCRIPT =
  'Get-ChildItem -Path Cert:\\LocalMachine\\Root, Cert:\\LocalMachine\\CA, ' +
  'Cert:\\CurrentUser\\Root, Cert:\\CurrentUser\\CA ' +
  '| Where-Object { $_.NotAfter -gt (Get-Date) } ' +
  '| ForEach-Object { \'-----BEGIN CERTIFICATE-----\'; ' +
  '[System.Convert]::ToBase64String($_.RawData, \'InsertLineBreaks\'); ' +
  '\'-----END CERTIFICATE-----\' }'

/**
 * @returns {string[]}
 */
function buildWinArgs (script = WIN_CA_SCRIPT) {
  return [
    '-NoLogo',
    '-NonInteractive',
    '-NoProfile',
    '-EncodedCommand',
    Buffer.from(script, 'utf16le').toString('base64')
  ]
}

function loadMacOS () {
  try {
    return execFileSync('security', buildMacArgs(os.homedir()), {
      encoding: 'utf8',
      timeout: 10000,
      maxBuffer: MAX_BUFFER
    })
  } catch {
    return ''
  }
}

function loadLinux () {
  const dirs = [
    '/etc/ssl/certs',
    '/etc/pki/tls/certs',
    '/etc/pki/ca-trust/extracted/pem',
    '/usr/local/share/certs'
  ]
  const files = []
  for (const dir of dirs) {
    if (existsSync(dir)) {
      try {
        for (const f of readdirSync(dir)) {
          if (f.endsWith('.crt') || f.endsWith('.pem')) {
            files.push(join(dir, f))
          }
        }
        break
      } catch { /* skip */ }
    }
  }
  if (!files.length) {
    // fallback: try the ca-certificates bundle
    const bundlePaths = [
      '/etc/ssl/certs/ca-certificates.crt',
      '/etc/pki/tls/certs/ca-bundle.crt',
      '/etc/ssl/ca-bundle.pem'
    ]
    for (const p of bundlePaths) {
      if (existsSync(p)) {
        return readFileSync(p, 'utf8')
      }
    }
    return ''
  }
  return files.map(f => {
    try { return readFileSync(f, 'utf8') } catch { return '' }
  }).join('\n')
}

const run = promisify(execFile)
// The native Windows trust store supplies roots. An incomplete server chain
// may also need an issuer from one of the Intermediate Certification Authorities stores.
const script = `
$ErrorActionPreference = 'Stop'
foreach ($location in 'LocalMachine', 'CurrentUser') {
  $store = [System.Security.Cryptography.X509Certificates.X509Store]::new('CA', $location)
  try {
    $store.Open('ReadOnly')
    foreach ($cert in $store.Certificates) {
      if ($cert.NotAfter -gt (Get-Date)) {
        [Convert]::ToBase64String($cert.RawData)
      }
    }
  } finally {
    $store.Close()
  }
}`

async function readWindowsIntermediates () {
  const { stdout } = await run('powershell.exe', buildWinArgs(script), {
    encoding: 'utf8',
    windowsHide: true,
    timeout: 10000,
    maxBuffer: MAX_BUFFER
  })
  return new Set(stdout.trim().split(/\s+/).filter(Boolean))
}

function loadWindows () {
  try {
    return execFileSync('powershell.exe', buildWinArgs(), {
      encoding: 'utf8',
      timeout: 10000,
      windowsHide: true,
      maxBuffer: MAX_BUFFER
    })
  } catch {
    return ''
  }
}

function getSystemCAs () {
  if (_certs !== null) {
    return _certs
  }
  switch (os.platform()) {
    case 'darwin':
      _certs = loadMacOS()
      break
    case 'linux':
      _certs = loadLinux()
      break
    case 'win32':
      _certs = loadWindows()
      break
    default:
      _certs = ''
  }
  return _certs
}

module.exports = getSystemCAs
// for unit tests: the arg builders are pure, the loaders shell out
module.exports.buildMacArgs = buildMacArgs
module.exports.buildWinArgs = buildWinArgs
module.exports.readWindowsIntermediates = readWindowsIntermediates
module.exports.WIN_CA_SCRIPT = WIN_CA_SCRIPT
