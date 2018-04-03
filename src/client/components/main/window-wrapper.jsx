

import React from 'react'
import Term from '../terminal'
import Sftp from '../sftp'
import {Tabs} from 'antd'
import _ from 'lodash'
import './wrapper.styl'
import {
  topMenuHeight, tabsHeight,
  sshTabHeight, terminalSshConfigType
} from '../../common/constants'

const {TabPane} = Tabs
export default class WindowWrapper extends React.Component  {

  state = {
    pane: 'ssh'
  }

  computeHeight = () => {
    let hasHost = _.get(this.props, 'tab.host')
    return window.innerHeight - topMenuHeight - tabsHeight - (hasHost ? sshTabHeight : 0)
  }

  onChange = pane => {
    this.setState({pane})
  }

  render() {
    let {pane} = this.state
    let {props} = this
    let height = this.computeHeight()
    let host = _.get(props, 'tab.host')
    let type = _.get(props, 'tab.type')
    let propsAll = {
      ...props,
      height
    }
    return (
      <div className={'term-sftp-box ' + pane}>
        {
          host && type !== terminalSshConfigType
            ? (
              <Tabs
                activeKey={pane}
                onChange={this.onChange}
              >
                <TabPane
                  tab="ssh"
                  key="ssh"
                >
                  <Term {...propsAll} />
                </TabPane>
                <TabPane
                  tab="sftp"
                  key="sftp"
                >
                  <Sftp
                    {...props}
                    height={height}
                    pane={pane}
                  />
                </TabPane>
              </Tabs>
            )
            : <Term {...propsAll} />
        }
      </div>
    )
  }

}
