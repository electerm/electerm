

import React from 'react'
import Term from '../terminal'
import Sftp from '../sftp'
import {Tabs} from 'antd'
import _ from 'lodash'
import './wrapper.styl'

const {TabPane} = Tabs
export default class WindowWrapper extends React.Component  {

  state = {
    height: 500,
    width: window.innerWidth,
    pane: 'ssh'
  }

  componentDidMount() {
    window.addEventListener('resize', this.onResize)
    this.onResize()
  }

  onResize = () => {
    this.setState({
      height: this.computeHeight(),
      width: window.innerWidth
    })
  }

  computeHeight = () => {
    let hasHost = _.get(this.props, 'tab.host')
    return window.innerHeight - 39 - 46 - (hasHost ? 37 : 0)
  }

  onChange = pane => {
    this.setState({pane})
  }

  render() {
    let {height, pane, width} = this.state
    let {props} = this
    let host = _.get(props, 'tab.host')
    let propsAll = {
      ...props,
      height,
      width
    }
    return (
      <div className="ui-wrapper">
        {
          host
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
