import { useEffect, useRef } from 'react'

export default function AutoCheckUpdate ({ config }) {
  const lastCheckTimeRef = useRef(0)
  const intervalIdRef = useRef(null)

  useEffect(() => {
    if (!config.checkUpdateOnStart) {
      clearInterval(intervalIdRef.current)
      return
    }

    const checkForUpdate = () => {
      const { store } = window
      if (store.config.checkUpdateOnStart) {
        store.onCheckUpdate(false)
      }
      lastCheckTimeRef.current = Date.now()
    }

    intervalIdRef.current = setInterval(checkForUpdate, 60 * 60 * 1000)

    return () => {
      if (intervalIdRef.current) {
        clearInterval(intervalIdRef.current)
      }
    }
  }, [config.checkUpdateOnStart])

  return null
}
