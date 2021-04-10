import { useEffect, useRef, useState } from 'react'
import { CloseOutlined, MinusSquareOutlined, UpCircleOutlined } from '@ant-design/icons'
import { Button } from 'antd'
import { getLatestReleaseInfo, getLatestReleaseVersion } from '../../common/update-check'
import upgrade from '../../common/upgrade'
import compare from '../../../app/common/version-compare'
import Link from '../common/external-link'
import { isMac, isWin, packInfo, appUpdateCheck } from '../../common/constants'
import newTerm from '../../common/new-terminal'
import './upgrade.styl'

const { prefix } = window
const {
  homepage
} = packInfo
const e = prefix('updater')
const c = prefix('common')
const { installSrc } = window.pre

export default function Upgrade (props) {
  const {
    checkUpdateOnStart
  } = props.store.config
  const [showCount, setShowCount] = useState(0)
  const update = useRef(null)
  function onEvent (e) {
    if (e && e.data && e.data.action === appUpdateCheck) {
      setShowCount(old => {
        return old + 1
      })
      getLatestRelease(true)
    }
  }
  function watch () {
    window.addEventListener('message', onEvent)
  }
  function unwatch () {
    window.removeEventListener('message', onEvent)
  }
  useEffect(() => {
    if (checkUpdateOnStart) {
      getLatestRelease()
    }
    watch()
    return unwatch
  }, [])

  function changeProps (update) {
    props.store.storeAssign({
      upgradeInfo: {
        ...props.store.upgradeInfo,
        ...update
      }
    })
  }

  function minimize () {
    changeProps({
      showUpgradeModal: false
    })
    props.store.focus()
  }

  function close () {
    props.store.storeAssign({
      upgradeInfo: {}
    })
  }

  function onData (upgradePercent) {
    if (upgradePercent >= 100) {
      update.current.destroy()
      return close()
    }
    changeProps({
      upgradePercent
    })
  }

  function onError (e) {
    changeProps({
      error: e.message
    })
  }

  function cancel () {
    update.current.destroy()
    changeProps({
      upgrading: false,
      upgradePercent: 0
    })
  }

  function onEnd () {
    close()
  }

  async function doUpgrade () {
    if (!isMac && !isWin && installSrc === 'npm') {
      return props.addTab(
        {
          ...newTerm(),
          loginScript: 'npm i -g electerm'
        }
      )
    }
    changeProps({
      upgrading: true
    })
    update.current = await upgrade({
      proxy: props.proxy,
      onData,
      onEnd,
      onError
    })
  }

  function skipVersion () {
    props.store.config.skipVersion = props.upgradeInfo.remoteVersion
    close()
  }

  async function getLatestRelease (noSkipVersion = false) {
    changeProps({
      checkingRemoteVersion: true,
      error: ''
    })
    const releaseVer = await getLatestReleaseVersion()
    changeProps({
      checkingRemoteVersion: false
    })
    if (!checkUpdateOnStart) {
      return
    }
    if (!releaseVer) {
      return changeProps({
        error: 'Can not get version info'
      })
    }
    const { skipVersion = 'v0.0.0' } = props.store.config
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
    changeProps({
      shouldUpgrade,
      releaseInfo,
      remoteVersion: latestVer,
      canAutoUpgrade,
      showUpgradeModal: true
    })
  }

  function renderError (err) {
    return (
      <div className='upgrade-panel'>
        <div className='upgrade-panel-title'>
          <CloseOutlined className='pointer font16 close-upgrade-panel' onClick={close} />
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

  function renderCanNotUpgrade () {
    const {
      showUpgradeModal
    } = props.upgradeInfo
    const cls = `animate upgrade-panel${showUpgradeModal ? '' : ' upgrade-panel-hide'}`
    return (
      <div className={cls}>
        <div className='upgrade-panel-title'>
          <CloseOutlined className='pointer font16 close-upgrade-panel' onClick={close} />
          {e('noNeed')}
        </div>
        <div className='upgrade-panel-body'>
          {e('noNeedDesc')}
        </div>
      </div>
    )
  }

  function renderChangeLog () {
    const {
      releaseInfo
    } = props.upgradeInfo
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

  function renderSkipVersion () {
    return (
      <Button
        onClick={skipVersion}
        icon={<CloseOutlined />}
        className='mg1l mg1b'
      >
        {e('skipThisVersion')}
      </Button>
    )
  }

  const {
    remoteVersion,
    upgrading,
    checkingRemoteVersion,
    showUpgradeModal,
    upgradePercent,
    shouldUpgrade,
    error
  } = props.upgradeInfo
  if (error) {
    return renderError(error)
  }
  if (!shouldUpgrade && !showCount) {
    return null
  }
  if (!shouldUpgrade && showCount) {
    return renderCanNotUpgrade()
  }
  if (checkingRemoteVersion) {
    return null
  }
  const cls = `animate upgrade-panel${showUpgradeModal ? '' : ' upgrade-panel-hide'}`
  const func = upgrading
    ? cancel
    : doUpgrade
  const getLink = (
    <div>
      {e('goGetIt')}
      <Link to={homepage} className='mg1l'>{homepage}</Link>
      {renderChangeLog()}
    </div>
  )
  return (
    <div className={cls}>
      <div className='upgrade-panel-title'>
        <MinusSquareOutlined className='pointer font16 close-upgrade-panel' onClick={minimize} />
        {e('newVersion')} <b>{remoteVersion}</b>
      </div>
      <div className='upgrade-panel-body'>
        {
          installSrc || isWin || isMac
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
                {renderSkipVersion()}
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
