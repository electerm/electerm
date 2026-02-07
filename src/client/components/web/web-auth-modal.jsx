import React, { useState, useCallback } from 'react'
import { Input, Button } from 'antd'
import Modal from '../common/modal'

export default function WebAuthModal ({ authRequest, onAuthSubmit, onAuthCancel }) {
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')

  const handleSubmit = useCallback(() => {
    onAuthSubmit(username, password)
    setUsername('')
    setPassword('')
  }, [onAuthSubmit, username, password])

  const handleCancel = useCallback(() => {
    onAuthCancel()
    setUsername('')
    setPassword('')
  }, [onAuthCancel])

  return (
    <Modal
      open={!!authRequest}
      title='Authentication Required'
      width={400}
      onCancel={handleCancel}
      footer={null}
    >
      <div className='pd1y'>
        <p>
          <b>{authRequest?.host}</b> requires authentication
          {authRequest?.realm ? ` (${authRequest.realm})` : ''}
        </p>
        <div className='pd1b'>
          <div className='pd1b'>Username</div>
          <Input
            value={username}
            onChange={e => setUsername(e.target.value)}
            placeholder='Username'
            autoFocus
          />
        </div>
        <div className='pd1b'>
          <div className='pd1b'>Password</div>
          <Input.Password
            value={password}
            onChange={e => setPassword(e.target.value)}
            placeholder='Password'
            onPressEnter={handleSubmit}
          />
        </div>
        <div className='pd1t alignright'>
          <Button
            className='mg1r'
            onClick={handleCancel}
          >
            Cancel
          </Button>
          <Button
            type='primary'
            onClick={handleSubmit}
          >
            Login
          </Button>
        </div>
      </div>
    </Modal>
  )
}
