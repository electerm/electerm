

import React from 'react'
import Term from '../terminal'
import Sftp from '../sftp'
import {Tabs} from 'antd'
import _ from 'lodash'
import './wrapper.styl'

const {TabPane} = Tabs
export default class WindowWrapper extends React.Component  {

  componentDidMount() {

  }

  render() {
    let {props} = this
    let hasHost = _.get(props, 'tab.host')
    let h = window.innerHeight - 39 - 46 - (hasHost ? 37 : 0)
    let th = h + 17
    return (
      <div className="ui-wrapper">
        {
          props.tab.host
            ? (
              <Tabs defaultActiveKey="ssh">
                <TabPane
                  tab="ssh"
                  key="ssh"
                >
                  <Term {...props} height={th} />
                </TabPane>
                <TabPane
                  tab="sftp"
                  key="sftp"
                >
                  <Sftp {...props} height={h} />
                </TabPane>
              </Tabs>
            )
            : <Term {...props} height={th} />
        }
      </div>
    )
  }

}
