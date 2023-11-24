import { Component } from '../common/react-subx'
import LogoElem from '../common/logo-elem.jsx'
import store from '../../store'
import {
  Input,
  message,
  Spin
} from 'antd'
import {
  ArrowRightOutlined
} from '@ant-design/icons'
import Main from '../main/main.jsx'
import './login.styl'

const { prefix } = window
const f = prefix('form')

window.store = store

export default class Login extends Component {
  state = {
    pass: '',
    logined: !window.pre.requireAuth,
    loading: false
  }

  componentDidMount () {
    this.init()
  }

  init = async () => {
    if (!window.pre.requireAuth) {
      return
    }
    const globs = await window.pre.runGlobalAsync('init')
    window.et.globs = globs
  }

  handlePassChange = e => {
    this.setState({
      pass: e.target.value
    })
  }

  handleSubmit = () => {
    const {
      pass
    } = this.state
    if (!pass) {
      return message.warning('password required')
    } else if (
      this.submitting
    ) {
      return
    }
    this.login(
      this.state.pass
    )
  }

  login = async (pass) => {
    this.submitting = true
    const r = await window.pre.runGlobalAsync('checkPassword', pass)
    if (r) {
      this.setState({
        logined: true,
        loading: false
      })
    } else {
      message.error('Login failed')
      this.setState({
        loading: false
      })
    }
    this.submitting = false
  }

  renderAfter = () => {
    return (
      <ArrowRightOutlined
        className='mg1x pointer'
        onClick={this.handleSubmit}
      />
    )
  }

  renderLogin () {
    const {
      pass,
      loading
    } = this.state
    return (
      <div className='login-wrap'>
        <div className='pd3 aligncenter'>
          <LogoElem />
          <div className='pd3 aligncenter'>
            <Input.Password
              value={pass}
              readOnly={loading}
              onChange={this.handlePassChange}
              placeholder={f('password')}
              addonAfter={this.renderAfter()}
              onPressEnter={this.handleSubmit}
            />
          </div>
          <div className='aligncenter'>
            <Spin
              spinning={loading}
            />
          </div>
        </div>
      </div>
    )
  }

  render () {
    const {
      logined
    } = this.state
    if (!logined) {
      return this.renderLogin()
    }
    return (
      <Main
        store={store}
      />
    )
  }
}
