/**
 * tranporter
 */
import React from 'react'
import {Progress, Popover} from 'antd'

export default class Tranports extends React.Component {

  componentWillMount() {

  }

  componentWillUnmount() {

  }

  computePercent = () => {
    return 75
  }

  computeStatus = () => {

  }

  renderContent = () => {

  }

  render() {
    let {transports} = this.props
    if (!transports.length) {
      return null
    }
    return (
      <div className="tranports-wrap">
        <Popover
          title="file transfers"
          content={this.renderContent()}
        >
          <Progress
            type="circle"
            percent={this.computePercent()}
            status={this.computeStatus()}
          />
        </Popover>
      </div>
    )
  }
}
