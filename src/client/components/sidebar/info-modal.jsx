/**
 * output app and system info
 */

import {Icon, Modal, Tabs, Button, Tag} from 'antd'
import Link from '../common/external-link'
import _ from 'lodash'
import {
  logoPath1,
  logoPath2
} from '../../common/constants'

const {prefix} = window
const e = prefix('control')
const m = prefix('menu')
const c = prefix('common')
const a = prefix('app')
const {TabPane} = Tabs

export default function({
  onCheckUpdate,
  onCheckUpdating,
  onCancel,
  onOk
}) {
  const {getGlobal} = window
  let {
    name,
    //description,
    devDependencies,
    dependencies,
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
  } = getGlobal('packInfo')
  let version = 'v' + packVer
  let link = url.replace('git+', '').replace('.git', '')
  let os = getGlobal('os')
  let env = getGlobal('env')
  let deps = {
    ...devDependencies,
    ...dependencies
  }
  let versions = getGlobal('versions')
  let envs = {
    ...versions,
    ...env
  }
  let bugReportLink = link + '/issues'
  let cls1 = Math.random() > 0.5
    ? 'hide'
    : ''
  let cls2 = cls1
    ? ''
    : 'hide'
  Modal.info({
    title: `${m('about')} ` + name,
    width: window.innerWidth - 100,
    maskClosable: true,
    okText: c('ok'),
    onCancel,
    onOk,
    content: (
      <div className="about-wrap">
        <Tabs defaultActiveKey="1">
          <TabPane tab={m('about')} key="1">
            <div className="pd2y aligncenter">
              <img src={logoPath1} className={`iblock mwm-100 ${cls1}`} />
              <img src={logoPath2} className={`iblock mwm-100 ${cls2}`} />
            </div>
            <h1 className="mg2b font50">
              <span className="iblock mg1r">{name}</span>
              <Tag color="#08c">{version}</Tag>
            </h1>
            <p className="mg1b">{a('desc')}</p>
            <p className="mg1b">
              <b className="mg1r">{e('author')}:</b>
              <Link to={authorUrl} className="mg1l">
                {authorName} ({email})
              </Link>
            </p>
            <p className="mg1b">
              <b>{e('homepage')}/{e('download')}:</b>
              <Link to={homepage} className="mg1l">
                <Icon type="home" /> {homepage}
              </Link>
            </p>
            <p className="mg1b">
              <b className="mg1r">github:</b>
              <Link to={link} className="mg1l">
                <Icon type="github" /> {link}
              </Link>
            </p>
            <p className="mg1b">
              <b className="mg1r">{e('bugReport')}:</b>
              <Link to={bugReportLink} className="mg1l">
                <Icon type="github" /> {bugReportLink}
              </Link>
            </p>
            <p className="mg1y">
              <Button
                type="primary"
                loading={onCheckUpdating}
                onClick={onCheckUpdate}
              >
                {e('checkForUpdate')}
              </Button>
            </p>
          </TabPane>
          <TabPane tab={e('dependencies')} key="4">
            {
              Object.keys(deps).map((k, i) => {
                let v = deps[k]
                return (
                  <div className="pd1b" key={i + '_dp_' + k}>
                    <b className="bold">{k}</b>:
                    <span className="mg1l">
                      {v}
                    </span>
                  </div>
                )
              })
            }
          </TabPane>
          <TabPane tab={e('env')} key="3">
            {
              Object.keys(envs).map((k, i) => {
                let v = envs[k]
                return (
                  <div className="pd1b" key={i + '_env_' + k}>
                    <b className="bold">{k}</b>:
                    <span className="mg1l">
                      {v}
                    </span>
                  </div>
                )
              })
            }
          </TabPane>
          <TabPane tab={e('os')} key="2">
            {
              Object.keys(os).map((k, i) => {
                let vf = os[k]
                if (!_.isFunction(vf)) {
                  return null
                }
                let v = JSON.stringify(vf(), null, 2)
                return (
                  <div className="pd1b" key={i + '_os_' + k}>
                    <b className="bold">{k}</b>:
                    <span className="mg1l">
                      {v}
                    </span>
                  </div>
                )
              })
            }
          </TabPane>
        </Tabs>

      </div>
    )
  })
}
