import {
  GithubOutlined,
  GlobalOutlined,
  HighlightOutlined,
  HomeOutlined,
  UserOutlined,
  WarningOutlined,
  InfoCircleOutlined,
  AlignLeftOutlined,
  BugOutlined
} from '@ant-design/icons'
import { Component } from '../common/react-subx'
import { Modal, Tabs, Button } from 'antd'
import Link from '../common/external-link'
import LogoElelm from '../common/logo-elem'

import {
  packInfo,
  infoTabs,
  srcsSkipUpgradeCheck
} from '../../common/constants'
import LogView from './log-view'
import './info.styl'

const { prefix } = window
const e = prefix('control')
const m = prefix('menu')
const c = prefix('common')
const a = prefix('app')
const s = prefix('setting')

export default class InfoModal extends Component {
  onChangeTab = key => {
    this.props.store.infoModalTab = key
  }

  renderCheckUpdate = () => {
    if (srcsSkipUpgradeCheck.includes(this.props.store.installSrc)) {
      return null
    }
    const { store } = this.props
    const {
      onCheckUpdate
    } = store
    const onCheckUpdating = store.upgradeInfo.checkingRemoteVersion || store.upgradeInfo.upgrading
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

  render () {
    const { store } = this.props
    const {
      onCloseAbout,
      showInfoModal,
      commandLineHelp,
      infoModalTab
    } = store
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
      repository: {
        url: bugReportLink
      },
      releases: releaseLink,
      privacyNoticeLink,
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
        <InfoCircleOutlined className='font20 mg1r' /> {m('about')} {name}
      </div>
    )
    const attrs = {
      title,
      width: window.innerWidth - 100,
      maskClosable: true,
      okText: c('ok'),
      onCancel: onCloseAbout,
      footer: null,
      open: true,
      wrapClassName: 'info-modal'
    }
    const items = [
      {
        key: infoTabs.info,
        label: m('about'),
        children: (
          <div>
            <LogoElelm />
            <p className='mg2b'>{a('desc')}</p>
            <p className='mg1b'>
              <UserOutlined /> <b className='mg1r'>{e('author')} ➾</b>
              <Link to={authorUrl} className='mg1l'>
                {authorName} ({email})
              </Link>
            </p>
            <p className='mg1b'>
              <HomeOutlined /> <b>{e('homepage')}/{e('download')} ➾</b>
              <Link to={homepage} className='mg1l'>
                {homepage}
              </Link>
            </p>
            <p className='mg1b'>
              <GithubOutlined /> <b className='mg1r'>github ➾</b>
              <Link to={link} className='mg1l'>
                {link}
              </Link>
            </p>
            <p className='mg1b'>
              <GlobalOutlined /> <b className='mg1r'>{s('language')} repo ➾</b>
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
              <HighlightOutlined /> <b className='mg1r'>Changelog ➾</b>
              <Link to={releaseLink} className='mg1l'>
                {releaseLink}
              </Link>
            </p>
            <p className='mg1b'>
              <AlignLeftOutlined /> <b className='mg1r'>Known issues ➾</b>
              <Link to={knownIssuesLink} className='mg1l'>
                {knownIssuesLink}
              </Link>
            </p>
            <p className='mg1b'>
              <WarningOutlined /> <b className='mg1r'>Privacy notice ➾</b>
              <Link to={privacyNoticeLink} className='mg1l'>
                {privacyNoticeLink}
              </Link>
            </p>
            {this.renderCheckUpdate()}
          </div>
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
        children: window.pre.osInfo().map(({ k, v }, i) => {
          return (
            <div className='pd1b' key={i + '_os_' + k}>
              <b className='bold'>{k}</b>:
              <span className='mg1l'>
                {v}
              </span>
            </div>
          )
        })
      },
      {
        key: infoTabs.log,
        label: e('log'),
        children: <LogView />
      },
      {
        key: infoTabs.cmd,
        label: e('commandLineUsage'),
        children: (
          <pre>
            <code>{commandLineHelp}</code>
          </pre>
        )
      }
    ]

    return (
      <Modal
        {...attrs}
      >
        <div className='about-wrap'>
          <Tabs
            activeKey={infoModalTab}
            onChange={this.onChangeTab}
            items={items}
          />
        </div>
      </Modal>
    )
  }
}
