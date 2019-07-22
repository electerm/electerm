import { Component } from 'react'
import { Icon, Button } from 'antd'
import _ from 'lodash'
import { getLatestReleaseInfo, getLatestReleaseVersion } from '../../common/update-check'
import upgrade from '../../common/upgrade'
import compare from '../../common/version-compare'
import Link from '../common/external-link'
import { isMac, isWin } from '../../common/constants'
import newTerm from '../../common/new-terminal'
import './upgrade.styl'

const { getGlobal, prefix } = window
const {
  homepage
} = getGlobal('packInfo')
const e = prefix('updater')
const c = prefix('common')
const installSrc = getGlobal('installSrc')

export default class Upgrade extends Component {
  componentDidMount () {
    this.getLatestReleaseInfo()
  }

  componentDidUpdate (prevProps) {
    if (prevProps.shouldCheckUpdate !== this.props.shouldCheckUpdate) {
      this.getLatestReleaseInfo()
    }
  }

  changeProps = (update) => {
    this.props.store.modifier({
      upgradeInfo: {
        ...this.props.store.upgradeInfo,
        ...update
      }
    })
  }

  minimize = () => {
    this.changeProps({
      showUpgradeModal: false
    })
    this.props.store.focus()
  }

  close = () => {
    this.props.store.modifier({
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
    const releaseVer = await getLatestReleaseVersion()
    this.changeProps({
      checkingRemoteVersion: false
    })
    if (!releaseVer) {
      return this.changeProps({
        error: 'Can not get version info'
      })
    }
    const currentVer = 'v' + window.et.version.split('-')[0]
    const latestVer = releaseVer.tag_name
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
          <Icon
            type='close'
            className='pointer font16 close-upgrade-panel'
            onClick={this.close}
          />
          {e('fail')}: {err}
        </div>
        <div className='upgrade-panel-body'>
          You can visit
          <Link
            to={homepage}
            className='mg1x'
          >{homepage}</Link> to download new version.
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
          <Icon
            type='close'
            className='pointer font16 close-upgrade-panel'
            onClick={this.close}
          />
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
    const arr = releaseInfo.split(/[\n\r]+/g)
    return (
      <div className='pd1t'>
        <div className='bold'>Changelog:</div>
        {
          arr.map((item, i) => {
            return <div key={'clo' + i}>{item}</div>
          })
        }
      </div>
    )
  }

  render () {
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
    if (!shouldUpgrade && !this.props.shouldCheckUpdate) {
      return null
    }
    if (!shouldUpgrade && this.props.shouldCheckUpdate) {
      return this.renderCanNotUpgrade()
    }
    if (checkingRemoteVersion) {
      return null
    }
    const cls = `animate upgrade-panel${showUpgradeModal ? '' : ' upgrade-panel-hide'}`
    const func = upgrading
      ? this.cancel
      : this.upgrade
    return (
      <div className={cls}>
        <div className='upgrade-panel-title'>
          <Icon
            type='minus-square'
            className='pointer font16 close-upgrade-panel'
            onClick={this.minimize}
          />
          {e('newVersion')} <b>{remoteVersion}</b>
        </div>
        <div className='upgrade-panel-body'>
          {
            installSrc || isWin || isMac
              ? (
                <div>
                  <Button
                    type='primary'
                    icon='up-circle'
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
                  <p className='pd1t'>
                    {e('goGetIt')}
                    <Link to={homepage} className='mg1l'>{homepage}</Link>
                  </p>
                  {this.renderChangeLog()}
                </div>
              )
              : (
                <div>
                  {e('goGetIt')}
                  <Link to={homepage} className='mg1l'>{homepage}</Link>
                  {this.renderChangeLog()}
                </div>
              )
          }
        </div>
      </div>
    )
  }
}
