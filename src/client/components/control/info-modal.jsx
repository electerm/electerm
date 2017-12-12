/**
 * output app and system info
 */

import {Icon, Modal, Tabs, Button, Tag} from 'antd'
import Link from '../common/external-link'
import _ from 'lodash'

const {TabPane} = Tabs

export default function({
  onCheckUpdate,
  onCheckUpdating
}) {
  const {getGlobal} = window
  let {
    name,
    description,
    devDependencies,
    dependencies,
    author,
    repository: {
      url
    },
    bugs: {
      url: bugReportLink
    },
    version: packVer
  } = getGlobal('packInfo')
  let cdn = window.location.origin
  let version = 'v' + packVer
  let link = url.replace('git+', '').replace('.git', '')
  let os = getGlobal('os')
  let env = getGlobal('env')
  let deps = {
    ...devDependencies,
    ...dependencies
  }
  let logoPath = cdn + '/_bc/electerm-resource/res/imgs/electerm.png'
  let releasesLink = link + '/releases'
  Modal.info({
    title: 'about ' + name,
    width: window.innerWidth - 100,
    maskClosable: true,
    okText: 'OK',
    content: (
      <div className="about-wrap">
        <Tabs defaultActiveKey="1">
          <TabPane tab="about" key="1">
            <div className="pd2y aligncenter">
              <img src={logoPath} className="iblock mw-100" />
            </div>
            <h1 className="mg2b font50">
              <span className="iblock mg1r">{name}</span>
              <Tag color="#08c">{version}</Tag>
            </h1>
            <p className="mg1b">{description}</p>
            <p className="mg1b">
              <b className="mg1r">author:</b>
              {author}
            </p>
            <p className="mg1b">
              <b>homepage:</b>
              <Link to={link} className="mg1l">
                <Icon type="github" /> {link}
              </Link>
            </p>
            <p className="mg1b">
              <b className="mg1r">download:</b>
              <Link to={releasesLink} className="mg1l">
                <Icon type="github" /> {releasesLink}
              </Link>
            </p>
            <p className="mg1b">
              <b className="mg1r">bug report:</b>
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
                check for update
              </Button>
            </p>
          </TabPane>
          <TabPane tab="dependencies" key="4">
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
          <TabPane tab="env" key="3">
            {
              Object.keys(env).map((k, i) => {
                let v = env[k]
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
            }
          </TabPane>
          <TabPane tab="os" key="2">
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
