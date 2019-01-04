import React from 'react'
import {Icon, Button, notification} from 'antd'
import {getLatestReleaseInfo, upgrade} from '../../common/update-check'
import compare from '../../common/version-compare'
import Link from '../common/external-link'
import {isMac, isWin} from '../../common/constants'

const {getGlobal, prefix} = window
let {
  homepage
} = getGlobal('packInfo')
const e = prefix('updater')
const installSrc = getGlobal('installSrc')

export default class Upgrade extends React.Component {

  state = {
    upgradePercent: 0
  }

  componentDidMount() {
    this.getLatestReleaseInfo()
  }

  componentDidUpdate(prevProps) {
    if (prevProps.shouldCheckUpdate !== this.props.shouldCheckUpdate) {
      this.getLatestReleaseInfo()
    }
  }

  minimize = () => {
    this.props.modifer(old => {
      return {
        ...old.upgradeInfo,
        showUpgradeModal: true
      }
    })
  }

  close = () => {
    this.props.modifer({
      upgradeInfo: {}
    })
  }

  upgrade = async (ver) => {
    this.props.modifier({
      upgrading: true
    })
    await upgrade(ver)
    this.props.modifier({
      upgrading: false
    })
  }

  onData = (upgradePercent) => {
    this.setState({
      upgradePercent
    })
  }

  onError = () => {
    // let transport = copy(this.props.transport)
    // transport.status = 'exception'
    // this.update(transport)
    // this.props.onError(e)
  }

  getLatestReleaseInfo = async () => {
    this.props.modifier({
      onCheckUpdating: true
    })
    let releaseInfo = await getLatestReleaseInfo()
    this.props.modifier({
      onCheckUpdating: false
    })
    if (!releaseInfo) {
      return this.notifyUpdateFail()
    }
    let currentVer = 'v' + window.et.version.split('-')[0]
    let latestVer = releaseInfo.tag_name
    let shouldShowUpdate = compare(currentVer, latestVer) < 0
    let canAutoUpgrade = installSrc || isWin || isMac
    if (canAutoUpgrade && shouldShowUpdate) {
      this.showSrcUpdateInfo(releaseInfo)
    }
    else if (shouldShowUpdate) {
      this.showUpdateInfo(releaseInfo)
    } else if (this.props.shouldCheckUpdate) {
      notification.info({
        message: e('noNeed'),
        placement: 'bottomRight',
        description: e('noNeedDesc'),
        duration: 5
      })
    }
  }

  notifyUpdateFail() {
    notification.info({
      message: e('fail'),
      placement: 'bottomRight',
      description: (
        <div>
          you can visit
          <Link
            to={homepage}
            className="mg1x"
          >{homepage}</Link>
          {e('fail')}
        </div>
      ),
      duration: 10
    })
  }

  showUpdateInfo = (releaseInfo) => {
    let {tag_name} = releaseInfo
    let description = (
      <div>
        <p className="pd1b wordbreak">
          {e('goGetIt')}
          <Link to={homepage} className="mg1l">{homepage}</Link>
        </p>
      </div>
    )
    notification.info({
      placement: 'bottomRight',
      message: (
        <p className="pd1b">{e('newVersion')} <b>{tag_name}</b></p>
      ),
      description,
      duration: 15
    })
  }

  showSrcUpdateInfo = (releaseInfo) => {
    let {upgrading} = this.props
    let {tag_name} = releaseInfo
    let description = (
      <div>
        <p className="pd1b">
          <Button
            type="primary"
            icon="up-circle"
            loading={upgrading}
            disabled={upgrading}
            onClick={() => this.upgrade(tag_name)}
          >{e('upgrade')}</Button>
        </p>
      </div>
    )
    notification.info({
      placement: 'bottomRight',
      message: (
        <p className="pd1b">{e('newVersion')} <b>{tag_name}</b></p>
      ),
      description,
      duration: 15
    })
  }

  renderError = () => {
    return (
      <div className="upgrade-panel">
        <Icon
          type="close"
          className="pointer font16 close-upgrade-panel"
          onClick={this.close}
        />
        <p className="pd1b bold">
          {e('fail')}
        </p>
        <p className="pd1b">
          You can visit
          <Link
            to={homepage}
            className="mg1x"
          >{homepage}</Link> to download new version.
        </p>
      </div>
    )
  }

  renderCanNotUpgrade = () => {
    return (
      <div className="upgrade-panel">
        <Icon
          type="close"
          className="pointer font16 close-upgrade-panel"
          onClick={this.close}
        />
        <p className="pd1b bold">
          {e('noNeed')}
        </p>
        <p className="pd1b">
          {e('noNeedDesc')}
        </p>
      </div>
    )
  }

  render() {
    let {
      remoteVersion,
      upgrading,
      checkingRemoteVersion,
      showUpgradeModal,
      error
    } = this.props.upgradeInfo
    if (!error) {
      return this.renderError()
    }
    let canUpgrade = this.checkUpgrade()
    if (!canUpgrade) {
      return this.renderCanNotUpgrade()
    }
    let cls = `animate upgrade-panel${showUpgradeModal ? '' : ' upgrade-panel-hide'}`
    return (
      <div className={cls}>
        <Icon
          type="minus-square"
          className="pointer font16 close-upgrade-panel"
          onClick={this.minimize}
        />
        <p className="pd1b">
          {e('newVersion')} <b>{remoteVersion}</b>
        </p>
        <p className="pd1b">
          <Button
            type="primary"
            icon="up-circle"
            loading={upgrading || checkingRemoteVersion}
            disabled={upgrading || checkingRemoteVersion}
            onClick={() => this.upgrade(remoteVersion)}
          >{e('upgrade')}</Button>
        </p>
      </div>
    )
  }

}
