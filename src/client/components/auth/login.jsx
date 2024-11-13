import React, { useState, useEffect } from 'react'
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
import AppDrag from '../tabs/app-drag'
import WindowControl from '../tabs/window-control'
import './login.styl'

const e = window.translate

window.store = store

export default function Login () {
  const [pass, setPass] = useState('')
  const [logined, setLogined] = useState(!window.pre.requireAuth)
  const [loading, setLoading] = useState(false)
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    init()
  }, [])

  const init = async () => {
    if (!window.pre.requireAuth) {
      return
    }
    const globs = await window.pre.runGlobalAsync('init')
    window.et.globs = globs
  }

  const handlePassChange = e => {
    setPass(e.target.value)
  }

  const handleSubmit = () => {
    if (!pass) {
      return message.warning('password required')
    } else if (submitting) {
      return
    }
    login(pass)
  }

  const login = async (pass) => {
    setSubmitting(true)
    const r = await window.pre.runGlobalAsync('checkPassword', pass)
    if (r) {
      setLogined(true)
      setLoading(false)
    } else {
      message.error('Login failed')
      setLoading(false)
    }
    setSubmitting(false)
  }

  const renderAfter = () => {
    return (
      <ArrowRightOutlined
        className='mg1x pointer'
        onClick={handleSubmit}
      />
    )
  }

  const renderLogin = () => {
    return (
      <div className='login-wrap'>
        <AppDrag />
        <WindowControl
          store={window.store}
        />
        <div className='pd3 aligncenter'>
          <LogoElem />
          <div className='pd3 aligncenter'>
            <Input.Password
              value={pass}
              readOnly={loading}
              onChange={handlePassChange}
              placeholder={e('password')}
              addonAfter={renderAfter()}
              onPressEnter={handleSubmit}
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

  if (!logined) {
    return renderLogin()
  }
  return (
    <Main
      store={store}
    />
  )
}
