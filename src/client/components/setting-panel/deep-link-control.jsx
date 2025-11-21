import React, { useState, useEffect } from 'react'
import { Button, message, Tooltip, Tag, Space } from 'antd'
import { CheckCircleOutlined, CloseCircleOutlined } from '@ant-design/icons'

const e = window.translate

export default function DeepLinkControl () {
  const [loading, setLoading] = useState(false)
  const [registrationStatus, setRegistrationStatus] = useState(null)

  const checkRegistrationStatus = async () => {
    try {
      const status = await window.pre.runGlobalAsync('checkProtocolRegistration')
      setRegistrationStatus(status)
    } catch (error) {
      console.error('Failed to check protocol registration:', error)
    }
  }

  useEffect(() => {
    checkRegistrationStatus()
  }, [])

  const handleRegister = async () => {
    setLoading(true)
    try {
      const result = await window.pre.runGlobalAsync('registerDeepLink', true)
      if (result.registered) {
        message.success('Protocol handlers registered successfully')
        await checkRegistrationStatus()
      } else {
        message.warning(e('deepLinkSkipped') || 'Registration skipped: ' + result.reason)
      }
    } catch (error) {
      message.error('Failed to register protocol handlers')
      console.error('Registration error:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleUnregister = async () => {
    setLoading(true)
    try {
      await window.pre.runGlobalAsync('unregisterDeepLink')
      message.success('Protocol handlers unregistered successfully')
      await checkRegistrationStatus()
    } catch (error) {
      message.error('Failed to unregister protocol handlers')
      console.error('Unregistration error:', error)
    } finally {
      setLoading(false)
    }
  }

  const isAnyProtocolRegistered = () => {
    if (!registrationStatus) return false
    return Object.values(registrationStatus).some(status => status === true)
  }

  const renderTooltipContent = () => {
    const protocols = ['ssh', 'telnet', 'rdp', 'vnc', 'serial']

    return (
      <div>
        <div className='pd1b'>
          Register electerm to handle protocol URLs (ssh://, telnet://, rdp://, vnc://, serial://)
        </div>

        {registrationStatus && (
          <>
            <div className='pd1b'>
              Protocol Status
            </div>
            <div className='pd1b'>
              <Space size='small' wrap>
                {protocols.map(protocol => {
                  const isRegistered = registrationStatus[protocol]
                  return (
                    <Tag
                      key={protocol}
                      icon={isRegistered ? <CheckCircleOutlined /> : <CloseCircleOutlined />}
                      color={isRegistered ? 'success' : 'default'}
                    >
                      {protocol}://
                    </Tag>
                  )
                })}
              </Space>
            </div>
          </>
        )}
      </div>
    )
  }

  const isRegistered = isAnyProtocolRegistered()

  return (
    <div className='pd2b'>
      <Tooltip
        title={renderTooltipContent()}
        placement='right'
        overlayStyle={{ maxWidth: 400 }}
      >
        {
          isRegistered
            ? (
              <Button
                type='danger'
                danger
                onClick={handleUnregister}
                loading={loading}
              >
                {e('unregisterDeepLink')}
              </Button>
              )
            : (
              <Button
                type='primary'
                onClick={handleRegister}
                loading={loading}
              >
                {e('registerDeepLink')}
              </Button>
              )
        }
      </Tooltip>
    </div>
  )
}
