import React from 'react'
import {Icon, Button} from 'antd'
import _ from 'lodash'
import {getLatestReleaseInfo, getLatestReleaseVersion} from '../../common/update-check'
import upgrade from '../../common/upgrade'
import compare from '../../common/version-compare'
import Link from '../common/external-link'
import {isMac, isWin} from '../../common/constants'
import newTerm from '../../common/new-terminal'
import './upgrade.styl'

const {getGlobal, prefix} = window
let {
  homepage
} = getGlobal('packInfo')
const e = prefix('updater')
const c = prefix('common')
const installSrc = getGlobal('installSrc')

export default class Upgrade extends React.Component {

  componentDidMount() {
    this.getLatestReleaseInfo()
  }

  componentDidUpdate(prevProps) {
    if (prevProps.shouldCheckUpdate !== this.props.shouldCheckUpdate) {
      this.getLatestReleaseInfo()
    }
  }

  changeProps = (update) => {
    this.props.modifier(old => {
      return {
        upgradeInfo: {
          ...old.upgradeInfo,
          ...update
        }
      }
    })
  }

  minimize = () => {
    this.changeProps({
      showUpgradeModal: false
    })
  }

  close = () => {
    this.props.modifier({
      upgradeInfo: {}
    })
  }

  upgrade = async () => {
    if (!isMac && !isWin && installSrc === 'npm') {
      return this.props.addTab(
        {
          ...newTerm(),
          loginScript: 'npm i -g electerm'
        }
      )
    }
    this.changeProps({
      upgrading: true
    })
    this.up = await upgrade({
      ..._.pick(this, [
        'onData',
        'onEnd',
        'onError'
      ])
    })
  }

  onData = (upgradePercent) => {
    if (upgradePercent >= 100) {
      this.up.destroy()
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
    this.up.destroy()
    this.changeProps({
      upgrading: false,
      upgradePercent: 0
    })
  }

  onEnd = this.close

  getLatestReleaseInfo = async () => {
    this.changeProps({
      checkingRemoteVersion: true,
      error: ''
    })
    let releaseVer = await getLatestReleaseVersion()
    this.changeProps({
      checkingRemoteVersion: false
    })
    if (!releaseVer) {
      return this.changeProps({
        error: 'Can not get version info'
      })
    }
    let currentVer = 'v' + window.et.version.split('-')[0]
    let latestVer = releaseVer.tag_name
    let shouldUpgrade = compare(currentVer, latestVer) < 0
    let canAutoUpgrade = installSrc || isWin || isMac
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
      <div className="upgrade-panel">
        <div className="upgrade-panel-title">
          <Icon
            type="close"
            className="pointer font16 close-upgrade-panel"
            onClick={this.close}
          />
          {e('fail')}: {err}
        </div>
        <div className="upgrade-panel-body">
          You can visit
          <Link
            to={homepage}
            className="mg1x"
          >{homepage}</Link> to download new version.
        </div>
      </div>
    )
  }

  renderCanNotUpgrade = () => {
    let {
      showUpgradeModal
    } = this.props.upgradeInfo
    let cls = `animate upgrade-panel${showUpgradeModal ? '' : ' upgrade-panel-hide'}`
    return (
      <div className={cls}>
        <div className="upgrade-panel-title">
          <Icon
            type="close"
            className="pointer font16 close-upgrade-panel"
            onClick={this.close}
          />
          {e('noNeed')}
        </div>
        <div className="upgrade-panel-body">
          {e('noNeedDesc')}
        </div>
      </div>
    )
  }

  renderChangeLog = () => {
    let {
      releaseInfo
    } = this.props.upgradeInfo
    if (!releaseInfo) {
      return null
    }
    let arr = releaseInfo.split(/[\n\r]+/g)
    return (
      <div className="pd1t">
        <div className="bold">Changelog:</div>
        {
          arr.map((item, i) => {
            return <div key={'clo' + i}>{item}</div>
          })
        }
      </div>
    )
  }

  render() {
    let {
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
    if (!shouldUpgrade && !this.props.shouldCheckUpdate) {
      return null
    }
    if (!shouldUpgrade && this.props.shouldCheckUpdate) {
      return this.renderCanNotUpgrade()
    }
    if (checkingRemoteVersion) {
      return null
    }
    let cls = `animate upgrade-panel${showUpgradeModal ? '' : ' upgrade-panel-hide'}`
    let func = upgrading
      ? this.cancel
      : this.upgrade
    return (
      <div className={cls}>
        <div className="upgrade-panel-title">
          <Icon
            type="minus-square"
            className="pointer font16 close-upgrade-panel"
            onClick={this.minimize}
          />
          {e('newVersion')} <b>{remoteVersion}</b>
        </div>
        <div className="upgrade-panel-body">
          {
            installSrc || isWin || isMac
              ? (
                <div>
                  <Button
                    type="primary"
                    icon="up-circle"
                    loading={checkingRemoteVersion}
                    disabled={checkingRemoteVersion}
                    onClick={func}
                  >
                    {
                      upgrading
                        ? <span>{`${e('upgrading')}... ${upgradePercent || 0}% ${c('cancel')}`}</span>
                        : e('upgrade')
                    }
                  </Button>
                  <p className="pd1t">
                    {e('goGetIt')}
                    <Link to={homepage} className="mg1l">{homepage}</Link>
                  </p>
                  {this.renderChangeLog()}
                </div>
              )
              : (
                <div>
                  {e('goGetIt')}
                  <Link to={homepage} className="mg1l">{homepage}</Link>
                  {this.renderChangeLog()}
                </div>
              )
          }
        </div>
      </div>
    )
  }

}
