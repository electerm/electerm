import { useEffect, useState } from 'react'
import { Alert, Button, Space, Typography } from 'antd'

const { Text, Link } = Typography

export default function AISubscriptionAccount ({ providerAI }) {
  const [status, setStatus] = useState({ supported: false, configured: false })
  const [loading, setLoading] = useState(false)
  const [device, setDevice] = useState(null)
  const [error, setError] = useState('')

  async function refreshStatus () {
    const result = await window.pre.runGlobalAsync('getAISubscriptionStatus', providerAI)
    if (result) setStatus(result)
  }

  useEffect(() => {
    let mounted = true
    window.pre.runGlobalAsync('getAISubscriptionStatus', providerAI)
      .then(result => {
        if (mounted && result) setStatus(result)
      })
      .catch(() => {
        if (mounted) setStatus({ supported: false, configured: false })
      })
    return () => { mounted = false }
  }, [providerAI])

  async function signIn () {
    setLoading(true)
    setError('')
    try {
      if (providerAI === 'chatgpt') {
        await window.pre.runGlobalAsync('signInChatGPT')
        await refreshStatus()
      } else {
        const result = await window.pre.runGlobalAsync('beginSuperGrokSignIn')
        setDevice(result)
        await window.pre.runGlobalAsync('finishSuperGrokSignIn', result.attemptId)
        setDevice(null)
        await refreshStatus()
      }
    } catch (e) {
      setError(e.message || 'Sign-in failed')
      setDevice(null)
    } finally {
      setLoading(false)
    }
  }

  async function cancel () {
    if (providerAI === 'chatgpt') {
      await window.pre.runGlobalAsync('cancelChatGPTSignIn')
    } else {
      await window.pre.runGlobalAsync('cancelSuperGrokSignIn', device && device.attemptId)
    }
    setDevice(null)
    setLoading(false)
  }

  async function signOut () {
    setLoading(true)
    try {
      await window.pre.runGlobalAsync('signOutAISubscription', providerAI)
      await refreshStatus()
    } catch (e) {
      setError(e.message || 'Sign-out failed')
    } finally {
      setLoading(false)
    }
  }

  if (!status.supported) {
    return <Alert type='info' showIcon title='Subscription sign-in is available in Windows desktop builds.' />
  }

  return (
    <div className='ai-subscription-account mg1b'>
      {error && <Alert className='mg1b' type='error' showIcon title={error} />}
      {device && <Alert className='mg1b' type='info' showIcon title={<Space direction='vertical'><Text>Enter code <Text strong copyable>{device.userCode}</Text></Text><Link href={device.verificationUrl} target='_blank' rel='noreferrer'>Open xAI authorization</Link><Text>Expires in {device.expiresIn}s</Text></Space>} />}
      {status.configured && <Alert className='mg1b' type={status.planUsageEnabled === false ? 'warning' : 'success'} showIcon title={status.hint} />}
      <Space>
        <Button loading={loading} onClick={signIn} disabled={loading}>{status.configured ? 'Reconnect' : (providerAI === 'chatgpt' ? 'Continue with ChatGPT' : 'Connect SuperGrok')}</Button>
        {loading && <Button onClick={cancel}>Cancel</Button>}
        {status.configured && <Button danger onClick={signOut} loading={loading}>Sign out</Button>}
        {providerAI === 'chatgpt' && <Link href='https://chatgpt.com/#settings/Subscription' target='_blank' rel='noreferrer'>Manage ChatGPT usage</Link>}
      </Space>
    </div>
  )
}
