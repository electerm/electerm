/**
 * Guard for local file transfers started by an MCP client / AI agent.
 *
 * The SFTP transfer tools take a caller-supplied local path. Without a guard,
 * a remote party (or an AI assistant steered by content it just read) can read
 * any local file off the machine into an upload, or write any local file from a
 * download — `~/.bashrc`, `~/.ssh/authorized_keys`, an autostart entry — with
 * no dialog. Both directions therefore have to ask the human first when the
 * path is one that turns a file write into code execution, or a file read into
 * credential theft.
 *
 * Pure module (no window / store access, no imports) so the decision can be
 * unit tested and so the same rules apply no matter which caller asks: the MCP
 * widget, the in-app AI agent, or a batch op.
 *
 * Paths are matched after normalisation: `~` expanded, `\` folded to `/`, and
 * `.`/`..` collapsed lexically, so `~/a/../.ssh/id_rsa` cannot slip past a
 * pattern that only looked at the last segment.
 */

// Writing any of these changes what the host runs next: shell rc/profile files
// are sourced by the next interactive shell, autostart entries and user units
// run at login, .ssh holds the trust store and the identity keys, and the VCS
// configs can point a hook or a fsmonitor at an attacker binary.
const sensitiveWritePatterns = [
  /(^|\/)\.(bashrc|bash_profile|bash_login|bash_logout|profile|zshrc|zprofile|zshenv|zlogin|zlogout|kshrc|mkshrc|cshrc|tcshrc)$/i,
  /(^|\/)\.config\/(fish\/config\.fish|env\.sh|environment)$/i,
  /(^|\/)\.pam_environment$/i,
  /(^|\/)\.ssh(\/|$)/i,
  /(^|\/)\.config\/autostart(\/|$)/i,
  /(^|\/)\.config\/systemd\/(user|system)(\/|$)/i,
  /(^|\/)library\/launch(agents|daemons)(\/|$)/i,
  /(^|\/)appdata\/(roaming|local)\/microsoft\/windows\/start menu\/programs\/startup(\/|$)/i,
  /(^|\/)\.(gitconfig|gitattributes)$/i,
  /(^|\/)\.config\/git\/config$/i,
  /(^|\/)\.(bashrc\.d|profile\.d|zshrc\.d)(\/|$)/i
]

// Reading any of these hands credentials to whoever receives the upload.
const sensitiveReadPatterns = [
  /(^|\/)\.ssh(\/|$)/i,
  /(^|\/)\.(aws|azure|gcloud|kube|docker|gnupg|password-store)(\/|$)/i,
  /(^|\/)\.(netrc|npmrc|pypirc|git-credentials|htpasswd|pgpass)$/i,
  /(^|\/)\.config\/(gh\/hosts\.yml|hub)$/i,
  /(^|\/)\.config\/gcloud(\/|$)/i,
  /(^|\/)appdata\/(roaming|local)\/(microsoft\/credentials|\.?ssh|gnupg)(\/|$)/i,
  /(^|\/)(\.env|\.env\.[a-z0-9]+|id_rsa|id_dsa|id_ecdsa|id_ed25519)$/i
]

export const conflictPolicies = [
  'mergeOrOverwriteAll',
  'renameAll'
]

// Legacy / documented aliases. `overwrite`/`rename` are what the tool schemas
// used to advertise; neither is a real `fileActions` value, so the old code
// silently fell through to the conflict dialog whenever a client asked for
// them. Map them onto the real ones instead of ignoring them.
const conflictPolicyAliases = {
  overwrite: 'mergeOrOverwriteAll',
  rename: 'renameAll'
}

export const normalizeConflictPolicy = (policy) => {
  if (!policy || typeof policy !== 'string') {
    return null
  }
  const mapped = conflictPolicyAliases[policy] || policy
  return conflictPolicies.includes(mapped) ? mapped : null
}

// Fold a caller-supplied local path into something a pattern can be matched
// against safely. Lexical only — no fs access, so it also works for a path that
// does not exist yet (which is exactly the write case we care about).
export const normalizeLocalPath = (localPath, homeDir) => {
  if (!localPath || typeof localPath !== 'string') {
    return ''
  }
  let p = localPath.trim().replace(/\\/g, '/')
  if (!p) {
    return ''
  }
  if (homeDir && typeof homeDir === 'string') {
    const home = homeDir.trim().replace(/\\/g, '/').replace(/\/+$/, '')
    if (home) {
      if (p === '~') {
        p = home
      } else if (p.startsWith('~/')) {
        p = home + p.slice(1)
      }
    }
  }
  const absolute = p.startsWith('/')
  const out = []
  for (const seg of p.split('/')) {
    if (!seg || seg === '.') {
      continue
    }
    if (seg === '..') {
      if (out.length && out[out.length - 1] !== '..') {
        out.pop()
      }
      continue
    }
    out.push(seg)
  }
  return (absolute ? '/' : '') + out.join('/')
}

const firstMatch = (patterns, localPath, homeDir) => {
  const normalized = normalizeLocalPath(localPath, homeDir)
  if (!normalized) {
    return ''
  }
  return patterns.some(re => re.test(normalized)) ? normalized : ''
}

// Returns the normalised path when a download to it would create or change
// something the host executes, '' otherwise.
export const sensitiveWritePath = (localPath, homeDir) => {
  return firstMatch(sensitiveWritePatterns, localPath, homeDir)
}

// Returns the normalised path when an upload from it would carry credentials
// off the machine, '' otherwise.
export const sensitiveReadPath = (localPath, homeDir) => {
  return firstMatch(sensitiveReadPatterns, localPath, homeDir)
}

/**
 * Decide whether a transfer needs the human to say yes before it is queued.
 *
 * @param {object} spec
 * @param {'upload'|'download'} spec.direction
 * @param {string} spec.fromPath source path (local for upload, remote for download)
 * @param {string} spec.toPath destination path (remote for upload, local for download)
 * @param {boolean} spec.strict whitelist mode: every MCP-side write is reviewed
 * @param {string} spec.homeDir used to expand a leading `~`
 * @returns {{requireApproval: boolean, reasons: Array<{code: string, path: string}>}}
 */
export const decideTransferApproval = ({
  direction,
  fromPath,
  toPath,
  strict,
  homeDir
} = {}) => {
  const reasons = []
  if (direction === 'download') {
    const hit = sensitiveWritePath(toPath, homeDir)
    if (hit) {
      reasons.push({ code: 'sensitive-write', path: hit })
    }
  } else if (direction === 'upload') {
    const hit = sensitiveReadPath(fromPath, homeDir)
    if (hit) {
      reasons.push({ code: 'sensitive-read', path: hit })
    }
  }
  if (strict) {
    reasons.push({ code: 'strict-mode', path: '' })
  }
  return {
    requireApproval: reasons.length > 0,
    reasons
  }
}
