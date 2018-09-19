/**
 * init before load components
 */

import React from 'react'
import Main from './main'
import {initFS} from '../../common/fs'

export default class Init extends React.PureComponent {
  constructor(props) {
    super(props)
    this.state = {
      loading: true
    }
    this.init()
  }

  init = async () => {
    await initFS()
    this.setState({
      loading: false
    })
  }

  render() {
    if (this.state.loading) {
      return (
        <div className="pd3 aligncenter">loading...</div>
      )
    }
    return <Main />
  }
}
