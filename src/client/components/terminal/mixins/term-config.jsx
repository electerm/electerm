import message from '../../common/message'
import ExternalLink from '../../common/external-link.jsx'
import { isWin } from '../../../common/constants.js'

/**
 * Reacting to config changes that cannot be handled by a re-render: they need
 * the live xterm instance (font/renderer) or the shell integration sequence.
 */
export const configMixin = {
  getValue (props, type, name) {
    return type === 'glob'
      ? props.config[name]
      : props.tab[name] || props.config[name]
  },

  checkConfigChange (prevProps, props) {
    for (const k of this.terminalConfigProps) {
      const { name, type } = k
      const prev = this.getValue(prevProps, type, name)
      const curr = this.getValue(props, type, name)
      if (
        prev !== curr
      ) {
        this.term.options[name] = curr
        if (['fontFamily', 'fontSize'].includes(name)) {
          this.onResize()
        }
        if (name === 'fontSize') {
          this.originalFontSize = curr
          this.setState({ fontSizeChanged: false })
        }
      }
    }

    // Handle renderer type changes (dom <-> webGL) by reloading the
    // renderer and refreshing the theme so the background color is
    // correct for the new renderer.
    if (
      prevProps.config.rendererType !== props.config.rendererType &&
      this.term
    ) {
      this.reloadWebglRenderer('renderer type change')
        .then(() => this.applyTerminalTheme())
        .catch(e => console.error('renderer type change failed', e))
    }

    // Check for shell integration related config changes
    const prevShowSuggestions = prevProps.config.showCmdSuggestions
    const currShowSuggestions = props.config.showCmdSuggestions
    const prevSftpFollow = prevProps.sftpPathFollowSsh
    const currSftpFollow = props.sftpPathFollowSsh
    const prevRestoreTerminal = prevProps.config.restoreTerminalSessionOnReload
    const currRestoreTerminal = props.config.restoreTerminalSessionOnReload

    if (
      (!prevShowSuggestions && currShowSuggestions) ||
      (!prevSftpFollow && currSftpFollow) ||
      (!prevRestoreTerminal && currRestoreTerminal)
    ) {
      // Config was toggled to true, try to inject shell integration if not already done
      if (this.startupQueue.canInjectShellIntegration() && !this.startupQueue.shellInjected) {
        this.startupQueue.enqueueShellIntegration(currSftpFollow)
      } else if (this.startupQueue.shellInjected && currSftpFollow) {
        this.getCwd()
      }
    }
    if (
      !prevSftpFollow &&
      currSftpFollow &&
      this.isLocal() &&
      isWin
    ) {
      return this.warnSftpFollowUnsupported()
    }
  },

  warnSftpFollowUnsupported () {
    message.warning(
      <span>
        Fish shell/windows shell is not supported for SFTP follow SSH path feature. See: <ExternalLink to='https://github.com/electerm/electerm/wiki/Warning-about-sftp-follow-ssh-path-function'>wiki</ExternalLink>
      </span>
      , 7)
  }
}
