/**
 * Shell Integration Scripts Provider
 *
 * Provides paths to shell integration scripts for different shells.
 * These scripts enable command tracking via OSC 633 escape sequences.
 */

const { resolve: pathResolve } = require('path')
const {
  getInlineShellIntegration,
  wrapSilent
} = require('./inline')

// Get the directory where shell integration scripts are stored
const shellIntegrationDir = __dirname

/**
 * Get the path to a shell integration script
 * @param {string} shell - Shell type: 'bash', 'zsh', or 'fish'
 * @returns {string} Absolute path to the shell integration script
 */
function getShellIntegrationPath (shell) {
  const scriptName = `electerm.${shell}`
  return pathResolve(shellIntegrationDir, scriptName)
}

/**
 * Get environment variables to inject shell integration for a given shell
 * @param {string} shellPath - Path to the shell executable
 * @returns {object} Environment variables to merge with process.env
 */
function getShellIntegrationEnv (shellPath) {
  const shellName = getShellType(shellPath)
  const scriptPath = getShellIntegrationPath(shellName)

  switch (shellName) {
    case 'bash':
      return {
        ELECTERM_SHELL_INTEGRATION_PATH: scriptPath,
        // Use BASH_ENV to source the script for non-interactive shells
        // For interactive shells, we'll inject via --rcfile or --init-file
        BASH_ENV: scriptPath
      }

    case 'zsh':
      return {
        // For zsh, we set the path as env var
        // The init command will source it after shell starts
        ELECTERM_SHELL_INTEGRATION_PATH: scriptPath
      }

    case 'fish':
      return {
        ELECTERM_SHELL_INTEGRATION_PATH: scriptPath
      }

    default:
      return {}
  }
}

/**
 * Detect shell type from shell path
 * @param {string} shellPath - Path to shell executable
 * @returns {string} Shell type: 'bash', 'zsh', 'fish', or 'unknown'
 */
function getShellType (shellPath) {
  const normalizedPath = shellPath.toLowerCase()

  if (normalizedPath.includes('bash')) {
    return 'bash'
  } else if (normalizedPath.includes('zsh')) {
    return 'zsh'
  } else if (normalizedPath.includes('fish')) {
    return 'fish'
  } else if (normalizedPath.includes('sh')) {
    // Generic sh, try bash compatibility
    return 'bash'
  }

  return 'unknown'
}

/**
 * Get shell arguments to enable shell integration
 * @param {string} shellPath - Path to shell executable
 * @param {string[]} existingArgs - Existing shell arguments
 * @returns {string[]} Modified shell arguments
 */
function getShellIntegrationArgs (shellPath, existingArgs = []) {
  const shellName = getShellType(shellPath)
  const scriptPath = getShellIntegrationPath(shellName)

  switch (shellName) {
    case 'bash':
      // For bash, we can use --rcfile to specify an init script
      // But this replaces .bashrc, so we need our script to source .bashrc
      // Instead, we'll rely on BASH_ENV for now
      return existingArgs

    case 'zsh':
      // For zsh, we could use ZDOTDIR but it's complex
      // We'll rely on the user's .zshrc or use direct sourcing
      return existingArgs

    case 'fish':
      // Fish can use -C to run commands on startup
      return [
        ...existingArgs,
        '-C',
        `source "${scriptPath}"`
      ]

    default:
      return existingArgs
  }
}

/**
 * Get the init command to source shell integration
 * This can be sent to the terminal after it starts
 * @param {string} shellPath - Path to shell executable
 * @returns {string|null} Command to source shell integration, or null if not supported
 */
function getShellIntegrationInitCommand (shellPath) {
  const shellName = getShellType(shellPath)
  const scriptPath = getShellIntegrationPath(shellName)

  switch (shellName) {
    case 'bash':
      // Source the script and clear the command line to hide it from user
      return `source "${scriptPath}" 2>/dev/null; printf '\\e[2K\\e[1A'\n`
    case 'zsh':
      // Source the script and clear the command line to hide it from user
      return `source "${scriptPath}" 2>/dev/null; printf '\\e[2K\\e[1A'\n`
    case 'fish':
      // Source the script and clear the command line to hide it from user
      return `source "${scriptPath}" 2>/dev/null; printf '\\e[2K\\e[1A'\n`
    default:
      return null
  }
}

/**
 * Get inline shell integration command for remote/SSH sessions
 * @param {string} shellType - 'bash', 'zsh', or 'fish'
 * @returns {string} Command to send to enable shell integration
 */
function getRemoteShellIntegrationCommand (shellType = 'bash') {
  const cmd = getInlineShellIntegration(shellType)
  return wrapSilent(cmd, shellType)
}

module.exports = {
  getShellIntegrationPath,
  getShellIntegrationEnv,
  getShellType,
  getShellIntegrationArgs,
  getShellIntegrationInitCommand,
  getRemoteShellIntegrationCommand,
  getInlineShellIntegration,
  shellIntegrationDir
}
