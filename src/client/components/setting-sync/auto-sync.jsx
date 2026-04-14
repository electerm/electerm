import { useEffect, useRef } from 'react'

export default function AutoSync ({ config }) {
  const lastSyncTimeRef = useRef(0)
  const intervalIdRef = useRef(null)

  useEffect(() => {
    if (
      !config.syncSetting?.autoSync || config.syncSetting?.autoSyncInterval <= 0
    ) {
      clearInterval(intervalIdRef.current)
      return
    }
    const checkAndSync = async () => {
      const syncSetting = config.syncSetting || {}
      const { autoSync, autoSyncInterval = 0, autoSyncDirection = 'upload' } = syncSetting

      if (!autoSync) {
        return
      }

      if (autoSyncInterval <= 0) {
        return
      }

      const now = Date.now()
      const intervalMs = autoSyncInterval * 60 * 1000
      if (now - lastSyncTimeRef.current >= intervalMs) {
        const { store } = window
        if (autoSyncDirection === 'download') {
          await store.downloadSettingAll()
        } else {
          await store.uploadSettingAll()
        }
        lastSyncTimeRef.current = now
      }
    }

    intervalIdRef.current = setInterval(checkAndSync, 10000)

    return () => {
      if (intervalIdRef.current) {
        clearInterval(intervalIdRef.current)
      }
    }
  }, [
    config.syncSetting?.autoSync,
    config.syncSetting?.autoSyncInterval,
    config.syncSetting?.autoSyncDirection
  ])

  return null
}
