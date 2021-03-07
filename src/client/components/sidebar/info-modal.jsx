import {
  GithubOutlined,
  GlobalOutlined,
  HighlightOutlined,
  HomeOutlined,
  UserOutlined,
  WarningOutlined,
  InfoCircleOutlined
} from '@ant-design/icons'
import { Component } from '../common/react-subx'
import { Modal, Tabs, Button, Tag } from 'antd'
import Link from '../common/external-link'

import {
  logoPath1,
  logoPath2,
  logoPath3,
  packInfo,
  infoTabs
} from '../../common/constants'
import LogView from './log-view'
import './info.styl'

const { prefix } = window
const e = prefix('control')
const m = prefix('menu')
const c = prefix('common')
const a = prefix('app')
const s = prefix('setting')
const { TabPane } = Tabs

export default class InfoModal extends Component {
  onChangeTab = key => {
    this.props.store.infoModalTab = key
  }

  render () {
    const { store } = this.props
    const {
      onCheckUpdate,
      onCloseAbout,
      showInfoModal,
      commandLineHelp,
      infoModalTab
    } = store
    if (!showInfoModal) {
      return null
    }
    const onCheckUpdating = store.upgradeInfo.checkingRemoteVersion || store.upgradeInfo.upgrading
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
        url
      },
      version: packVer
    } = packInfo
    const version = 'v' + packVer
    const link = url.replace('git+', '').replace('.git', '')
    const { env, versions } = window.pre
    const deps = {
      ...devDependencies,
      ...dependencies
    }
    const envs = {
      ...versions,
      ...env
    }
    const bugReportLink = link + '/issues'
    const releaseLink = link + '/releases'
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
      visible: true,
      wrapClassName: 'info-modal'
    }
    return (
      <Modal
        {...attrs}
      >
        <div className='about-wrap'>
          <Tabs activeKey={infoModalTab} onChange={this.onChangeTab}>
            <TabPane tab={m('about')} key={infoTabs.info}>
              <h1 className='mg3y font50'>
                <span className='iblock pd3 morph-shape mg1l mg1r'>
                  <img src={logoPath2} height={80} className='iblock mwm-100 mg1l mg1r logo-filter' />
                </span>
                <img src={logoPath3} height={80} className='hide' />
                <sup>
                  <img src={logoPath1} height={28} className='iblock mwm-100 mg1r' />
                </sup>
                <Tag color='#08c'>{version}</Tag>
              </h1>
              <p className='mg2b'>{a('desc')}</p>
              <p className='mg1b'>
                => <b className='mg1r'>{e('author')}:</b>
                <Link to={authorUrl} className='mg1l'>
                  <UserOutlined /> {authorName} ({email})
                </Link>
              </p>
              <p className='mg1b'>
                => <b>{e('homepage')}/{e('download')}:</b>
                <Link to={homepage} className='mg1l'>
                  <HomeOutlined /> {homepage}
                </Link>
              </p>
              <p className='mg1b'>
                => <b className='mg1r'>github:</b>
                <Link to={link} className='mg1l'>
                  <GithubOutlined /> {link}
                </Link>
              </p>
              <p className='mg1b'>
                => <b className='mg1r'>{s('language')} repo:</b>
                <Link to={langugeRepo} className='mg1l'>
                  <GlobalOutlined /> {langugeRepo}
                </Link>
              </p>
              <p className='mg1b'>
                => <b className='mg1r'>{e('bugReport')}:</b>
                <Link to={bugReportLink} className='mg1l'>
                  <WarningOutlined /> {bugReportLink}
                </Link>
              </p>
              <p className='mg1b'>
                => <b className='mg1r'>Changelog:</b>
                <Link to={releaseLink} className='mg1l'>
                  <HighlightOutlined /> {releaseLink}
                </Link>
              </p>
              <p className='mg1b mg2t'>
                <Button
                  type='primary'
                  loading={onCheckUpdating}
                  onClick={() => onCheckUpdate(true)}
                >
                  {e('checkForUpdate')}
                </Button>
              </p>
            </TabPane>
            <TabPane tab={e('dependencies')} key={infoTabs.deps}>
              {
                Object.keys(deps).map((k, i) => {
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
              }
            </TabPane>
            <TabPane tab={e('env')} key={infoTabs.env}>
              {
                Object.keys(envs).map((k, i) => {
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
              }
            </TabPane>
            <TabPane tab={e('os')} key={infoTabs.os}>
              {
                window.pre.osInfo().map(({ k, v }, i) => {
                  return (
                    <div className='pd1b' key={i + '_os_' + k}>
                      <b className='bold'>{k}</b>:
                      <span className='mg1l'>
                        {v}
                      </span>
                    </div>
                  )
                })
              }
            </TabPane>
            <TabPane tab={e('log')} key={infoTabs.log}>
              <LogView />
            </TabPane>
            <TabPane tab={e('commandLineUsage')} key={infoTabs.cmd}>
              <pre>
                <code>{commandLineHelp}</code>
              </pre>
            </TabPane>
          </Tabs>
        </div>
      </Modal>
    )
  }
}
