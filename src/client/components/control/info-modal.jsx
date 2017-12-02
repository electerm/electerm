/**
 * output app and system info
 */

import {Icon, Modal, Tabs} from 'antd'
import Link from '../common/external-link'
import _ from 'lodash'

const {TabPane} = Tabs

export default function() {
  const {getGlobal} = window
  let {
    name,
    description,
    devDependencies,
    dependencies,
    author,
    repository: {
      url
    }
  } = getGlobal('packInfo')
  let version = getGlobal('version')
  let link = url.replace('git+', '').replace('.git', '')
  let os = getGlobal('os')
  let env = getGlobal('env')
  let deps = {
    ...devDependencies,
    ...dependencies
  }
  let logoPath = window.sugo.cdn + '/static/images/electerm.png'
  Modal.info({
    title: 'about ' + name,
    width: window.innerWidth - 100,
    maskClosable: true,
    okText: 'OK',
    content: (
      <div className="about-wrap">
        <Tabs defaultActiveKey="1">
          <TabPane tab="about" key="1">
            <div className="pd1y aligncenter">
              <img src={logoPath} className="iblock" />
            </div>
            <h1 className="mg2b">
              {name}
            </h1>
            <p className="mg1b">{description}</p>
            <p className="mg1b">
              <b className="mg1r">author:</b>
              {author}
            </p>
            <p className="mg1b">
              <b>github:</b>
              <Link to={link} className="mg1l">
                <Icon type="github" /> {link}
              </Link>
            </p>
            <p className="mg1b">
              <b className="mg1r">version:</b>
              {version}
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
