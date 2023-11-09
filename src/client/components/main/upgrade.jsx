import { PureComponent } from 'react'
import { CloseOutlined, MinusSquareOutlined, UpCircleOutlined } from '@ant-design/icons'
import { Button } from 'antd'
import { getLatestReleaseInfo, getLatestReleaseVersion } from '../../common/update-check'
import upgrade from '../../common/upgrade'
import compare from '../../common/version-compare'
import Link from '../common/external-link'
import {
  isMac,
  isWin,
  packInfo,
  commonActions,
  srcsSkipUpgradeCheck,
  downloadUpgradeTimeout,
  mirrors
} from '../../common/constants'
import newTerm from '../../common/new-terminal'
import Markdown from '../common/markdown'
import downloadMirrors from '../../common/download-mirrors'
import './upgrade.styl'

const { prefix } = window
const {
  homepage
} = packInfo
const e = prefix('updater')
const c = prefix('common')

export default class Upgrade extends PureComponent {
  state = {
    showCount: 0,
    mirror: mirrors.github
  }

  downloadTimer = null

  componentDidMount () {
    setTimeout(() => {
      getLatestReleaseVersion(1)
    }, 5000)
    this.watch()
  }

  componentWillUnmount () {
    this.unwatch()
  }

  watch = () => {
    window.addEventListener('message', this.onEvent)
  }

  unwatch = () => {
    window.removeEventListener('message', this.onEvent)
  }

  onEvent = (e) => {
    if (e && e.data && e.data.action === commonActions.appUpdateCheck) {
      this.setState(old => {
        return {
          showCount: old.showCount + 1
        }
      })
      this.getLatestRelease(true)
    }
  }

  changeProps = (update) => {
    window.store.storeAssign({
      _upgradeInfo: JSON.stringify({
        ...this.props.upgradeInfo,
        ...update
      })
    })
  }

  handleMinimize = () => {
    this.changeProps({
      showUpgradeModal: false
    })
    window.store.focus()
  }

  handleClose = () => {
    window.store.storeAssign({
      _upgradeInfo: '{}'
    })
  }

  onData = (upgradePercent) => {
    clearTimeout(this.downloadTimer)
    if (upgradePercent >= 100) {
      this.update && this.update.destroy()
      return this.close()
    }
    this.changeProps({
      upgradePercent
    })
  }

  onError = (e) => {
    this.changeProps({
      error: e.message
    })
  }

  cancel = () => {
    this.update && this.update.destroy()
    this.changeProps({
      upgrading: false,
      upgradePercent: 0
    })
  }

  timeout = () => {
    const { mirror } = this.state
    this.cancel()
    const next = mirror === mirrors.github
      ? this.doUpgrade
      : undefined
    const nextMirror = mirror === mirrors.github
      ? mirrors.sourceforge
      : mirrors.github
    this.setState({
      mirror: nextMirror
    }, next)
  }

  onEnd = () => {
    this.close()
  }

  doUpgrade = async () => {
    const { installSrc } = this.props
    if (!isMac && !isWin && installSrc === 'npm') {
      return window.store.addTab(
        {
          ...newTerm(undefined, true),
          loginScript: 'npm i -g electerm'
        }
      )
    }
    this.changeProps({
      upgrading: true
    })
    const proxy = window.store.getProxySetting()
    this.update = await upgrade({
      mirror: this.state.mirror,
      proxy,
      onData: this.onData,
      onEnd: this.onEnd,
      onError: this.onError
    })
    this.downloadTimer = setTimeout(this.timeout, downloadUpgradeTimeout)
  }

  handleSkipVersion = () => {
    window.store.config.skipVersion = this.props.upgradeInfo.remoteVersion
    this.close()
  }

  getLatestRelease = async (noSkipVersion = false) => {
    const { installSrc } = this.props
    if (srcsSkipUpgradeCheck.includes(installSrc)) {
      return
    }
    this.changeProps({
      checkingRemoteVersion: true,
      error: ''
    })
    const releaseVer = await getLatestReleaseVersion()
    this.changeProps({
      checkingRemoteVersion: false
    })
    if (!releaseVer) {
      return this.changeProps({
        error: 'Can not get version info'
      })
    }
    const { skipVersion = 'v0.0.0' } = this.props
    const currentVer = 'v' + window.et.version.split('-')[0]
    const latestVer = releaseVer.tag_name
    if (!noSkipVersion && compare(skipVersion, latestVer) >= 0) {
      return
    }
    const shouldUpgrade = compare(currentVer, latestVer) < 0
    const canAutoUpgrade = installSrc || isWin || isMac
    let releaseInfo
    if (canAutoUpgrade) {
      releaseInfo = await getLatestReleaseInfo()
    }
    this.changeProps({
      shouldUpgrade,
      releaseInfo,
      remoteVersion: latestVer,
      canAutoUpgrade,
      showUpgradeModal: true
    })
  }

  renderError = (err) => {
    return (
      <div className='upgrade-panel'>
        <div className='upgrade-panel-title'>
          <CloseOutlined className='pointer font16 close-upgrade-panel' onClick={this.handleClose} />
          {e('fail')}: {err}
        </div>
        <div className='upgrade-panel-body'>
          You can visit
          <Link
            to={homepage}
            className='mg1x'
          >{homepage}
          </Link> to download new version.
        </div>
      </div>
    )
  }

  renderCanNotUpgrade = () => {
    const {
      showUpgradeModal
    } = this.props.upgradeInfo
    const cls = `animate upgrade-panel${showUpgradeModal ? '' : ' upgrade-panel-hide'}`
    return (
      <div className={cls}>
        <div className='upgrade-panel-title'>
          <CloseOutlined className='pointer font16 close-upgrade-panel' onClick={this.handleClose} />
          {e('noNeed')}
        </div>
        <div className='upgrade-panel-body'>
          {e('noNeedDesc')}
        </div>
      </div>
    )
  }

  renderChangeLog = () => {
    const {
      releaseInfo
    } = this.props.upgradeInfo
    if (!releaseInfo) {
      return null
    }
    return (
      <div className='pd1t'>
        <div className='bold'>Changelog:</div>
        <Markdown text={releaseInfo} />
        <Link
          to={packInfo.releases}
        >{e('moreChangeLog')}
        </Link>
      </div>
    )
  }

  renderSkipVersion = () => {
    return (
      <Button
        onClick={this.handleSkipVersion}
        icon={<CloseOutlined />}
        className='mg1l mg1b'
      >
        {e('skipThisVersion')}
      </Button>
    )
  }

  render () {
    const {
      showCount
    } = this.state
    const { installSrc } = this.props
    const {
      remoteVersion,
      upgrading,
      checkingRemoteVersion,
      showUpgradeModal,
      upgradePercent,
      shouldUpgrade,
      error
    } = this.props.upgradeInfo
    if (error) {
      return this.renderError(error)
    }
    if (!shouldUpgrade && showCount < 2) {
      return null
    }
    if (!shouldUpgrade && showCount > 1) {
      return this.renderCanNotUpgrade()
    }
    if (checkingRemoteVersion) {
      return null
    }
    const cls = `animate upgrade-panel${showUpgradeModal ? '' : ' upgrade-panel-hide'}`
    const func = upgrading
      ? this.cancel
      : this.doUpgrade
    const getLink = (
      <div>
        <p>
          {e('manuallyDownloadFrom')}:
          {
            downloadMirrors.map((d) => {
              return (
                <Link to={d.url} className='mg1l' key={d.url}>{d.name}</Link>
              )
            })
          }
        </p>
        {this.renderChangeLog()}
      </div>
    )
    const skip = srcsSkipUpgradeCheck.includes(installSrc)
    return (
      <div className={cls}>
        <div className='upgrade-panel-title'>
          <MinusSquareOutlined className='pointer font16 close-upgrade-panel' onClick={this.handleMinimize} />
          {e('newVersion')} <b>{remoteVersion}</b>
        </div>
        <div className='upgrade-panel-body'>
          {
            !skip
              ? (
                <div>
                  <Button
                    type='primary'
                    icon={<UpCircleOutlined />}
                    loading={checkingRemoteVersion}
                    disabled={checkingRemoteVersion}
                    onClick={func}
                    className='mg1b'
                  >
                    {
                      upgrading
                        ? <span>{`${e('upgrading')}... ${upgradePercent || 0}% ${c('cancel')}`}</span>
                        : e('upgrade')
                    }
                  </Button>
                  {this.renderSkipVersion()}
                  <div className='pd1t'>
                    {getLink}
                  </div>
                </div>
                )
              : getLink
          }
        </div>
      </div>
    )
  }
}
