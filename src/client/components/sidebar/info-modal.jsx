import {
  GithubOutlined,
  GlobalOutlined,
  HighlightOutlined,
  HomeOutlined,
  UserOutlined,
  InfoCircleOutlined,
  AlignLeftOutlined,
  BugOutlined,
  HeartOutlined,
  CloudOutlined
} from '@ant-design/icons'
import { Tabs, Button } from 'antd'
import Modal from '../common/modal'
import LogoElem from '../common/logo-elem'
import Placeholder from '../common/placeholder'
import RunningTime from './app-running-time'
import { auto } from 'manate/react'
import { useState } from 'react'

import {
  packInfo,
  infoTabs
} from '../../common/constants'
import { checkSkipSrc } from '../../common/check-skip-src'
import './info.styl'

const e = window.translate

const stripProto = url => (url || '').replace(/^https?:\/\//, '').replace(/\/+$/, '')

// One settings style row: name over a muted address. The address is its own
// line because a url inside a sentence wraps three times on a phone; `.elli`
// keeps it one line on both form factors, so no per-breakpoint rules are
// needed anywhere in this page.
function AboutRow (props) {
  const {
    icon,
    title,
    sub,
    to
  } = props
  const attrs = to
    ? {
        href: to,
        onClick: ev => {
          ev.preventDefault()
          window.pre.openExternal(to)
        }
      }
    : {}
  return (
    <a className='about-row' {...attrs}>
      {icon}
      <span className='about-row-text'>
        <span className='block elli'>{title}</span>
        {sub && <span className='block elli font12 about-row-sub'>{sub}</span>}
      </span>
    </a>
  )
}

export default auto(function InfoModal (props) {
  const [runtimeEnv, setRuntimeEnv] = useState(null)

  const handleChangeTab = key => {
    window.store.infoModalTab = key
    if (key === infoTabs.env && !runtimeEnv) {
      window.pre.runGlobalAsync('getEnv').then(env => setRuntimeEnv(env))
    }
  }

  const renderCheckUpdate = () => {
    if (window.et.disableUpgradeCheck || checkSkipSrc(props.installSrc)) {
      return null
    }
    const {
      onCheckUpdate
    } = window.store
    const {
      upgradeInfo
    } = props
    const onCheckUpdating = upgradeInfo.checkingRemoteVersion || upgradeInfo.upgrading
    const { noUpdateMessage, noUpdateMessageExpires } = upgradeInfo
    const showMessage = noUpdateMessage && noUpdateMessageExpires && Date.now() < noUpdateMessageExpires
    return (
      <div className='mg1b mg2t'>
        <Button
          type='primary'
          loading={onCheckUpdating}
          onClick={() => onCheckUpdate(true)}
        >
          {e('checkForUpdate')}
        </Button>
        {showMessage && (
          <span className='mg1l update-msg'>{noUpdateMessage}</span>
        )}
      </div>
    )
  }

  const renderParsed = (obj, depth = 0) => {
    if (Array.isArray(obj)) {
      return (
        <ul className='pd2l'>
          {obj.map((item, i) => (
            <li key={i}>{renderParsed(item, depth + 1)}</li>
          ))}
        </ul>
      )
    } else if (typeof obj === 'object' && obj !== null) {
      return (
        <div className={depth > 0 ? 'pd2l' : ''}>
          {Object.entries(obj).map(([k, v]) => (
            <div key={k} className='pd1b'>
              <b>{k}:</b> {renderParsed(v, depth + 1)}
            </div>
          ))}
        </div>
      )
    } else {
      return <span>{String(obj)}</span>
    }
  }

  const renderValue = (v) => {
    try {
      const parsed = JSON.parse(v)
      return renderParsed(parsed)
    } catch {
      return <span>{v}</span>
    }
  }

  const renderOSInfo = () => {
    return window.pre.osInfo().map(({ k, v }, i) => (
      <div className='pd1b' key={i + '_os_' + k}>
        <b className='bold'>{k}:</b>
        <span className='mg1l'>
          {renderValue(v)}
        </span>
      </div>
    ))
  }

  const { infoModalTab, commandLineHelp } = props
  const {
    showInfoModal
  } = window.store
  function onCloseAbout () {
    window.store.showInfoModal = false
  }
  if (!showInfoModal) {
    return null
  }
  const {
    name,
    // description,
    devDependencies,
    dependencies,
    languageRepo,
    privacyNoticeLink,
    author: {
      name: authorName,
      email,
      url: authorUrl
    },
    homepage,
    bugs: {
      url: bugReportLink
    },
    releases: releaseLink,
    sponsorLink,
    knownIssuesLink
  } = packInfo
  const electermOnline = 'https://cloud.electerm.org'
  const link = releaseLink.replace('/releases', '')
  const { versions } = window.pre
  const deps = {
    ...devDependencies,
    ...dependencies
  }
  const envs = {
    ...versions,
    ...(runtimeEnv || {})
  }
  const aboutRows = [
    { icon: <HomeOutlined />, title: e('homepage'), to: homepage },
    { icon: <GithubOutlined />, title: 'GitHub', to: link },
    { icon: <HighlightOutlined />, title: e('changeLog'), to: releaseLink },
    { icon: <AlignLeftOutlined />, title: e('knownIssues'), to: knownIssuesLink },
    { icon: <BugOutlined />, title: e('bugReport'), to: bugReportLink },
    { icon: <GlobalOutlined />, title: `${e('language')} repo`, to: languageRepo },
    { icon: <CloudOutlined />, title: 'electerm Online', to: electermOnline },
    { icon: <HeartOutlined />, title: e('sponsorElecterm'), to: sponsorLink },
    { icon: <UserOutlined />, title: authorName, sub: email, to: authorUrl },
    { icon: <InfoCircleOutlined />, title: e('privacyNotice'), to: privacyNoticeLink }
  ]
  const title = (
    <div className='custom-modal-close-confirm-title font16'>
      <InfoCircleOutlined className='font20 mg1r' /> {e('about')} {name}
    </div>
  )
  const attrs = {
    title,
    width: 720,
    maskClosable: true,
    onCancel: onCloseAbout,
    open: true,
    wrapClassName: 'info-modal'
  }
  const items = [
    {
      key: infoTabs.info,
      label: e('about'),
      children: (
        <>
          <LogoElem />
          <p className='mg2b'>{e('desc')}</p>
          <RunningTime />
          <div className='about-list'>
            {aboutRows.map(({ icon, title, sub, to }, i) => (
              <AboutRow
                key={i}
                icon={icon}
                title={title}
                sub={sub || stripProto(to)}
                to={to}
              />
            ))}
            <AboutRow
              icon={<InfoCircleOutlined />}
              title={window.store.installSrc}
            />
          </div>
          {renderCheckUpdate()}
          <Placeholder />
        </>
      )
    },
    {
      key: infoTabs.deps,
      label: e('dependencies'),
      children: Object.keys(deps).map((k, i) => {
        const v = deps[k]
        return (
          <div className='pd1b' key={i + '_dp_' + k}>
            <b className='bold'>{k}</b>:
            <span className='mg1l'>
              {v}
            </span>
          </div>
        )
      })
    },
    {
      key: infoTabs.env,
      label: e('env'),
      children: Object.keys(envs).map((k, i) => {
        const v = envs[k]
        return (
          <div className='pd1b' key={i + '_env_' + k}>
            <b className='bold'>{k}</b>:
            <span className='mg1l'>
              {v}
            </span>
          </div>
        )
      })
    },
    {
      key: infoTabs.os,
      label: e('os'),
      children: <div>{renderOSInfo()}</div>
    }
  ]

  if (!window.et.isWebApp) {
    items.push({
      key: infoTabs.cmd,
      label: e('commandLineUsage'),
      children: (
        <pre>
          <code>{commandLineHelp}</code>
        </pre>
      )
    })
  }

  return (
    <Modal
      {...attrs}
    >
      <div className='about-wrap'>
        <Tabs
          activeKey={infoModalTab}
          onChange={handleChangeTab}
          items={items}
        />
      </div>
    </Modal>
  )
})
