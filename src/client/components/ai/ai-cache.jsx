import { aiSuggestionsCache } from '../../common/cache'
import { useEffect, useState } from 'react'
import {
  Button,
  Alert
} from 'antd'

const e = window.translate

export default function AiCache () {
  const [count, setCount] = useState(0)

  function handleClick () {
    aiSuggestionsCache.clear()
    setCount(0)
  }

  useEffect(() => {
    setCount(aiSuggestionsCache.cache.size)
  }, [])

  const msg = (
    <>
      <span className='mg3r'>{e('aiSuggestionsCache')}: <b>{count}</b></span>
      <Button
        onClick={handleClick}
        size='small'
      >
        {e('clear')}
      </Button>
    </>
  )
  return (
    <Alert message={msg} type='info' className='mg2y' />
  )
}
