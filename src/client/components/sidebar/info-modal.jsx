import {
  GithubOutlined,
  GlobalOutlined,
  HighlightOutlined,
  HomeOutlined,
  UserOutlined,
  WarningOutlined,
  InfoCircleOutlined,
  AlignLeftOutlined,
  BugOutlined,
  HeartOutlined
} from '@ant-design/icons'
import { Modal, Tabs, Button } from 'antd'
import Link from '../common/external-link'
import LogoElem from '../common/logo-elem'
import RunningTime from './app-running-time'
import { auto } from 'manate/react'

import {
  packInfo,
  infoTabs
} from '../../common/constants'
import { checkSkipSrc } from '../../common/check-skip-src'
import './info.styl'

const e = window.translate

export default auto(function InfoModal (props) {
  const handleChangeTab = key => {
    window.store.infoModalTab = key
  }

  const renderCheckUpdate = () => {
    if (window.et.isWebApp || checkSkipSrc(props.installSrc)) {
      return null
    }
    const {
      onCheckUpdate
    } = window.store
    const {
      upgradeInfo
    } = props
    const onCheckUpdating = upgradeInfo.checkingRemoteVersion || upgradeInfo.upgrading
    return (
      <p className='mg1b mg2t'>
        <Button
          type='primary'
          loading={onCheckUpdating}
          onClick={() => onCheckUpdate(true)}
        >
          {e('checkForUpdate')}
        </Button>
      </p>
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
    langugeRepo,
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
    privacyNoticeLink,
    sponsorLink,
    knownIssuesLink
  } = packInfo
  const link = releaseLink.replace('/releases', '')
  const { env, versions } = window.pre
  const deps = {
    ...devDependencies,
    ...dependencies
  }
  const envs = {
    ...versions,
    ...env
  }
  const title = (
    <div className='ant-modal-confirm-title font16'>
      <InfoCircleOutlined className='font20 mg1r' /> {e('about')} {name}
    </div>
  )
  const attrs = {
    title,
    width: window.innerWidth - 100,
    maskClosable: true,
    okText: e('ok'),
    onCancel: onCloseAbout,
    footer: null,
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
          <p className='mg1b'>
            <HomeOutlined /> <b>{e('homepage')}/{e('download')} ➾</b>
            <Link to={homepage} className='mg1l'>
              {homepage}
            </Link>
          </p>
          <p className='mg1b'>
            <UserOutlined /> <b className='mg1r'>{e('author')} ➾</b>
            <Link to={authorUrl} className='mg1l'>
              {authorName} ({email})
            </Link>
          </p>
          <p className='mg1b'>
            <GithubOutlined /> <b className='mg1r'>github ➾</b>
            <Link to={link} className='mg1l'>
              {link}
            </Link>
          </p>
          <p className='mg1b'>
            <GlobalOutlined /> <b className='mg1r'>{e('language')} repo ➾</b>
            <Link to={langugeRepo} className='mg1l'>
              {langugeRepo}
            </Link>
          </p>
          <p className='mg1b'>
            <BugOutlined /> <b className='mg1r'>{e('bugReport')} ➾</b>
            <Link to={bugReportLink} className='mg1l'>
              {bugReportLink}
            </Link>
          </p>
          <p className='mg1b'>
            <HighlightOutlined /> <b className='mg1r'>{e('changeLog')} ➾</b>
            <Link to={releaseLink} className='mg1l'>
              {releaseLink}
            </Link>
          </p>
          <p className='mg1b'>
            <AlignLeftOutlined /> <b className='mg1r'>{e('knownIssues')} ➾</b>
            <Link to={knownIssuesLink} className='mg1l'>
              {knownIssuesLink}
            </Link>
          </p>
          <p className='mg1b'>
            <WarningOutlined /> <b className='mg1r'>{e('privacyNotice')} ➾</b>
            <Link to={privacyNoticeLink} className='mg1l'>
              {privacyNoticeLink}
            </Link>
          </p>
          <p className='mg1b'>
            <HeartOutlined /> <b className='mg1r'>{e('sponsorElecterm')} ➾</b>
            <Link to={sponsorLink} className='mg1l'>
              {sponsorLink}
            </Link>
          </p>
          <p className='mg1b'>
            <InfoCircleOutlined /> <b className='mg1r'>{window.store.installSrc}</b>
          </p>
          {renderCheckUpdate()}
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
