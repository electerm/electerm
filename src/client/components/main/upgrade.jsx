import { PureComponent } from 'react'
import { CloseOutlined, MinusSquareOutlined, UpCircleOutlined } from '@ant-design/icons'
import { Button, Select, Space } from 'antd'
import { getLatestReleaseInfo, getLatestReleaseVersion } from '../../common/update-check'
import upgrade from '../../common/upgrade'
import compare from '../../common/version-compare'
import Link from '../common/external-link'
import {
  isMac,
  isWin,
  packInfo,
  downloadUpgradeTimeout
} from '../../common/constants'
import { checkSkipSrc } from '../../common/check-skip-src'
import { debounce } from 'lodash-es'
import newTerm from '../../common/new-terminal'
import Markdown from '../common/markdown'
import downloadMirrors from '../../common/download-mirrors'
import { refsStatic } from '../common/ref'
import message from '../common/message'
import './upgrade.styl'

const e = window.translate
const {
  homepage
} = packInfo

const downloadMirrorList = [
  'github',
  'mirror',
  'sourceforge'
]

export default class Upgrade extends PureComponent {
  state = {
    mirror: downloadMirrorList[1]
  }

  downloadTimer = null

  componentDidMount () {
    if (window.et.isWebApp) {
      return
    }
    this.id = 'upgrade'
    refsStatic.add(this.id, this)
    this.cleanupTimer = setInterval(() => {
      const { noUpdateMessageExpires } = window.store.upgradeInfo
      if (noUpdateMessageExpires && Date.now() > noUpdateMessageExpires) {
        window.store.upgradeInfo.noUpdateMessage = ''
        window.store.upgradeInfo.noUpdateMessageExpires = 0
      }
    }, 1000)
  }

  componentWillUnmount () {
    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer)
    }
  }

  appUpdateCheck = (isManual) => {
    this.getLatestRelease(isManual)
  }

  changeProps = (update) => {
    Object.assign(
      window.store.upgradeInfo, update
    )
  }

  handleMinimize = () => {
    this.changeProps({
      showUpgradeModal: false
    })
    window.store.focus()
  }

  handleClose = () => {
    window.store.upgradeInfo = {}
  }

  handleMirrorChange = (mirror) => {
    this.setState({
      mirror
    })
  }

  onData = (upgradePercent) => {
    clearTimeout(this.downloadTimer)
    if (upgradePercent >= 100) {
      this.update && this.update.destroy()
      return this.handleClose()
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
    this.cancel()
    message.error('Download timeout, please try again')
  }

  onEnd = () => {
    this.handleClose()
  }

  doUpgrade = debounce(async () => {
    const { installSrc } = this.props
    if (!isMac && !isWin && installSrc === 'npm') {
      return window.store.addTab(
        {
          ...newTerm(undefined, true),
          runScripts: [
            {
              script: 'npm install -g electerm',
              delay: 500
            }
          ]
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
  }, 100)

  handleSkipVersion = () => {
    window.store.setConfig({
      skipVersion: this.props.upgradeInfo.remoteVersion
    })
    this.handleClose()
  }

  getLatestRelease = async (isManual = false) => {
    const { installSrc } = this.props
    if (checkSkipSrc(installSrc)) {
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
    if (!isManual && compare(skipVersion, latestVer) >= 0) {
      return
    }
    const shouldUpgrade = compare(currentVer, latestVer) < 0
    if (!shouldUpgrade) {
      if (isManual) {
        this.changeProps({
          noUpdateMessage: e('noNeed'),
          noUpdateMessageExpires: Date.now() + 3000
        })
      }
      return
    }
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
        <div className='upgrade-panel-title fix'>
          <span className='fleft'>
            {e('fail')}: {err}
          </span>
          <span className='fright'>
            <CloseOutlined className='pointer font16 close-upgrade-panel' onClick={this.handleClose} />
          </span>
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
        <Markdown text={releaseInfo.body} />
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

  renderLinks = () => {
    return (
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
  }

  renderMirrorSelector = () => {
    return (
      <Select
        value={this.state.mirror}
        onChange={this.handleMirrorChange}
        getPopupContainer={() => document.body}
        size='small'
        style={{ height: 32 }}
      >
        {downloadMirrorList.map((opt) => (
          <Select.Option key={opt} value={opt}>{opt}</Select.Option>
        ))}
      </Select>
    )
  }

  renderUpgradeButton = () => {
    const { upgrading, upgradePercent, checkingRemoteVersion } = this.props.upgradeInfo
    if (upgrading) {
      const percent = upgradePercent || 0
      return (
        <Button
          type='primary'
          icon={<UpCircleOutlined />}
          loading={checkingRemoteVersion}
          disabled={checkingRemoteVersion}
          onClick={() => this.cancel()}
          className='mg1b'
        >
          <span>{`${e('upgrading')}... ${percent}% ${e('cancel')}`}</span>
        </Button>
      )
    }
    return (
      <Space.Compact>
        {this.renderMirrorSelector()}
        <Button
          type='primary'
          icon={<UpCircleOutlined />}
          loading={checkingRemoteVersion}
          disabled={checkingRemoteVersion}
          onClick={() => this.doUpgrade()}
          className='mg1b'
        >
          {e('upgrade')}
        </Button>
      </Space.Compact>
    )
  }

  renderUpgradeContent = () => {
    const { installSrc } = this.props
    const skip = checkSkipSrc(installSrc)
    if (skip) {
      return this.renderLinks()
    }
    return (
      <div>
        {this.renderUpgradeButton()}
        {this.renderSkipVersion()}
        <div className='pd1t'>
          {this.renderLinks()}
        </div>
      </div>
    )
  }

  renderUpgradePanel = () => {
    const { remoteVersion, releaseInfo, showUpgradeModal } = this.props.upgradeInfo
    const cls = showUpgradeModal
      ? 'animate upgrade-panel'
      : 'animate upgrade-panel upgrade-panel-hide'
    return (
      <div className={cls}>
        <div className='upgrade-panel-title fix'>
          <span className='fleft'>
            {e('newVersion')} <b>{remoteVersion} [{releaseInfo.date}]</b>
          </span>
          <span className='fright'>
            <MinusSquareOutlined className='pointer font16 close-upgrade-panel' onClick={this.handleMinimize} />
          </span>
        </div>
        <div className='upgrade-panel-body'>
          {this.renderUpgradeContent()}
        </div>
      </div>
    )
  }

  render () {
    const { shouldUpgrade, checkingRemoteVersion, error } = this.props.upgradeInfo
    if (error) {
      return this.renderError(error)
    }
    if (!shouldUpgrade) {
      return null
    }
    if (checkingRemoteVersion) {
      return null
    }
    return this.renderUpgradePanel()
  }
}
