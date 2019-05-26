import React from 'react'
import { Icon, Button } from 'antd'
import {
  logoPath1
} from '../../common/constants'

const { prefix } = window
const e = prefix('main')
const m = prefix('menu')

export default class ErrorBoundary extends React.PureComponent {
  constructor (props) {
    super(props)
    this.state = {
      hasError: false,
      error: {}
    }
  }

  componentDidCatch (error) {
    log.error(error)
    this.setState({
      hasError: true,
      error
    })
  }

  reload = () => {
    window.location.reload()
  }

  render () {
    if (this.state.hasError) {
      let { stack, message } = this.state.error
      return (
        <div className='pd3 aligncenter error-wrapper'>
          <div className='pd2y aligncenter'>
            <img src={logoPath1} className='iblock mwm-100' />
          </div>
          <h1>
            <Icon type='frown-o' className='mg1r iblock' />
            <span className='iblock mg1r'>{e('error')}</span>
            <Button
              onClick={this.reload}
              className='iblock'
              icon='reload'
            >
              {m('reload')}
            </Button>
          </h1>
          <div className='pd1y'>{message}</div>
          <div className='pd1y'>{stack}</div>
        </div>
      )
    }
    return this.props.children
  }
}
