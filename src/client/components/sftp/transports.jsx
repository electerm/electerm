/**
 * tranporter
 */
import React from 'react'
import {Progress, Popover} from 'antd'
import {Transport} from './transport'
import _ from 'lodash'

export default class Tranports extends React.Component {

  constructor(props) {
    super(props)
    this.state = {
      currentTarnsport: props.transports[0] || null
    }
  }

  componentWillReceiveProps(nextProps) {
    if (
      !_.isEqual(this.props.transports, nextProps.transports)
    ) {
      this.initState(nextProps)
    }
  }

  initState = nextProps => {
    
  }

  renderContent = () => {
    let {transports} = this.props
    let {currentTarnsport} = this.state
    return (
      <div className="transports-content">
        {
          transports.map((t ,i) => {
            return (
              <Transport
                transport={t}
                {...this.props}
                index={i}
                currentTarnsportId={currentTarnsport.id}
              />
            )
          })
        }
      </div>
    )
  }

  render() {
    let {transports} = this.props
    let {currentTarnsport} = this.state
    let percent = _.get(currentTarnsport, 'percent')
    let status = _.get(currentTarnsport, 'status')
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
            width={60}
            percent={percent}
            status={status}
          />
        </Popover>
      </div>
    )
  }
}
