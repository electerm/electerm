import { useState, useEffect } from 'react'
import {
  ClockCircleOutlined
} from '@ant-design/icons'
import dayjs from 'dayjs'
import duration from 'dayjs/plugin/duration'

dayjs.extend(duration)

const e = window.translate

export default function RunningTime () {
  const [runningTime, setRunningTime] = useState(0)

  useEffect(() => {
    const startTime = window.pre.runSync('getInitTime')

    const timer = setInterval(() => {
      const currentTime = Date.now()
      const diff = Math.floor((currentTime - startTime) / 1000)
      setRunningTime(diff)
    }, 1000)

    return () => clearInterval(timer)
  }, [])
  const formatRunningTime = (seconds) => {
    return dayjs.duration(seconds, 'seconds').format('HH:mm:ss')
  }
  return (
    <p className='mg2b'>
      <ClockCircleOutlined /> <b>{e('runningTime')} ➾</b>
      <span className='mg1l'>{formatRunningTime(runningTime)}</span>
    </p>
  )
}
