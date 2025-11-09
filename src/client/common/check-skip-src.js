/**
 * Check if install source should skip upgrade check
 */

import { srcsSkipUpgradeCheck } from './constants'

export const checkSkipSrc = (installSrc) => {
  if (!installSrc) return false
  return srcsSkipUpgradeCheck.some(skipSrc => {
    if (skipSrc === 'skip-upgrade-check') {
      return installSrc === skipSrc
    }
    // For file extensions like '.appx', '.snap', check if installSrc ends with them
    return installSrc.endsWith(skipSrc)
  })
}
