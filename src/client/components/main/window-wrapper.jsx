

import React from 'react'
import Term from '../terminal'
import Sftp from '../sftp'
import {Tabs} from 'antd'
import _ from 'lodash'
import './wrapper.styl'

const {TabPane} = Tabs
export default class WindowWrapper extends React.Component  {

  state = {
    height: 500
  }

  componentDidMount() {
    window.addEventListener('resize', this.onResize)
    this.onResize()
  }

  onResize = _.throttle(() => {
    this.setState({
      height: this.computeHeight()
    })
  }, 300)

  computeHeight = () => {
    let hasHost = _.get(this.props, 'tab.host')
    return window.innerHeight - 39 - 46 - (hasHost ? 37 : 0)
  }

  render() {
    let {height} = this.state
    let {props} =this
    let th = height + 17
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
                  <Sftp {...props} height={height} />
                </TabPane>
              </Tabs>
            )
            : <Term {...props} height={th} />
        }
      </div>
    )
  }

}
