/**
 * Unit tests for npm/install.js
 * Tests that correct download patterns are selected for different OS/arch combinations
 */

/* eslint-env jest */
/* global describe, it, expect, beforeAll */

const https = require('https')
const {
  isWindows7OrEarlier,
  isMacOS10,
  isLinuxLegacy,
  getDownloadPattern
} = require('../../npm/install')

// Cache for version - fetched once from electerm website
let cachedVersion = null

async function getVersion () {
  if (cachedVersion) {
    return cachedVersion
  }
  cachedVersion = await new Promise((resolve, reject) => {
    https.get('https://electerm.html5beta.com/version.html', (res) => {
      let data = ''
      res.on('data', chunk => { data += chunk })
      res.on('end', () => resolve(data.trim().replace('v', '')))
      res.on('error', reject)
    }).on('error', reject)
  })
  return cachedVersion
}

// Fetch version once before all tests
beforeAll(async () => {
  await getVersion()
})

describe('npm/install.js', () => {
  describe('isWindows7OrEarlier', () => {
    it('should return false for non-Windows platforms', () => {
      expect(isWindows7OrEarlier('darwin', '21.0.0')).toBe(false)
      expect(isWindows7OrEarlier('linux', '5.4.0')).toBe(false)
    })

    it('should return true for Windows 7 (NT 6.1)', () => {
      expect(isWindows7OrEarlier('win32', '6.1.7601')).toBe(true)
    })

    it('should return true for Windows Vista (NT 6.0)', () => {
      expect(isWindows7OrEarlier('win32', '6.0.6000')).toBe(true)
    })

    it('should return true for Windows XP (NT 5.1)', () => {
      expect(isWindows7OrEarlier('win32', '5.1.2600')).toBe(true)
    })

    it('should return false for Windows 8 (NT 6.2)', () => {
      expect(isWindows7OrEarlier('win32', '6.2.9200')).toBe(false)
    })

    it('should return false for Windows 8.1 (NT 6.3)', () => {
      expect(isWindows7OrEarlier('win32', '6.3.9600')).toBe(false)
    })

    it('should return false for Windows 10 (NT 10.0)', () => {
      expect(isWindows7OrEarlier('win32', '10.0.19041')).toBe(false)
    })

    it('should return false for Windows 11 (NT 10.0)', () => {
      expect(isWindows7OrEarlier('win32', '10.0.22000')).toBe(false)
    })
  })

  describe('isMacOS10', () => {
    it('should return false for non-macOS platforms', () => {
      expect(isMacOS10('win32', '10.0.19041')).toBe(false)
      expect(isMacOS10('linux', '5.4.0')).toBe(false)
    })

    it('should return true for macOS 10.15 Catalina (Darwin 19.x)', () => {
      expect(isMacOS10('darwin', '19.6.0')).toBe(true)
    })

    it('should return true for macOS 10.14 Mojave (Darwin 18.x)', () => {
      expect(isMacOS10('darwin', '18.7.0')).toBe(true)
    })

    it('should return true for macOS 10.13 High Sierra (Darwin 17.x)', () => {
      expect(isMacOS10('darwin', '17.7.0')).toBe(true)
    })

    it('should return false for macOS 11 Big Sur (Darwin 20.x)', () => {
      expect(isMacOS10('darwin', '20.6.0')).toBe(false)
    })

    it('should return false for macOS 12 Monterey (Darwin 21.x)', () => {
      expect(isMacOS10('darwin', '21.6.0')).toBe(false)
    })

    it('should return false for macOS 13 Ventura (Darwin 22.x)', () => {
      expect(isMacOS10('darwin', '22.1.0')).toBe(false)
    })

    it('should return false for macOS 14 Sonoma (Darwin 23.x)', () => {
      expect(isMacOS10('darwin', '23.0.0')).toBe(false)
    })
  })

  describe('isLinuxLegacy', () => {
    it('should return false for non-Linux platforms', () => {
      expect(isLinuxLegacy('win32', 2.31)).toBe(false)
      expect(isLinuxLegacy('darwin', 2.31)).toBe(false)
    })

    it('should return true for glibc < 2.34', () => {
      expect(isLinuxLegacy('linux', 2.31)).toBe(true)
      expect(isLinuxLegacy('linux', 2.17)).toBe(true)
      expect(isLinuxLegacy('linux', 2.33)).toBe(true)
    })

    it('should return false for glibc >= 2.34', () => {
      expect(isLinuxLegacy('linux', 2.34)).toBe(false)
      expect(isLinuxLegacy('linux', 2.35)).toBe(false)
      expect(isLinuxLegacy('linux', 2.38)).toBe(false)
    })
  })

  describe('getDownloadPattern', () => {
    describe('Windows', () => {
      it('should return win-x64 pattern for Windows x64', () => {
        const result = getDownloadPattern('win32', 'x64', {})
        expect(result.type).toBe('win-x64')
        expect(result.pattern.test('electerm-2.3.151-win-x64.tar.gz')).toBe(true)
        expect(result.pattern.test('electerm-2.3.151-win-arm64.tar.gz')).toBe(false)
      })

      it('should return win-arm64 pattern for Windows arm64', () => {
        const result = getDownloadPattern('win32', 'arm64', {})
        expect(result.type).toBe('win-arm64')
        expect(result.pattern.test('electerm-2.3.151-win-arm64.tar.gz')).toBe(true)
        expect(result.pattern.test('electerm-2.3.151-win-x64.tar.gz')).toBe(false)
      })

      it('should return win7 pattern for Windows 7', () => {
        const result = getDownloadPattern('win32', 'x64', { win7: true })
        expect(result.type).toBe('win7')
        expect(result.pattern.test('electerm-2.3.151-win7.tar.gz')).toBe(true)
        expect(result.pattern.test('electerm-2.3.151-win-x64.tar.gz')).toBe(false)
      })

      it('should prefer win7 over arm64 when win7 flag is set', () => {
        const result = getDownloadPattern('win32', 'arm64', { win7: true })
        expect(result.type).toBe('win7')
      })
    })

    describe('macOS', () => {
      it('should return mac-x64 pattern for macOS x64', () => {
        const result = getDownloadPattern('darwin', 'x64', {})
        expect(result.type).toBe('mac-x64')
        expect(result.pattern.test('electerm-2.3.151-mac-x64.dmg')).toBe(true)
        expect(result.pattern.test('electerm-2.3.151-mac-arm64.dmg')).toBe(false)
      })

      it('should return mac-arm64 pattern for macOS arm64 (Apple Silicon)', () => {
        const result = getDownloadPattern('darwin', 'arm64', {})
        expect(result.type).toBe('mac-arm64')
        expect(result.pattern.test('electerm-2.3.151-mac-arm64.dmg')).toBe(true)
        expect(result.pattern.test('electerm-2.3.151-mac-x64.dmg')).toBe(false)
      })

      it('should return mac10-x64 pattern for macOS 10.x', () => {
        const result = getDownloadPattern('darwin', 'x64', { mac10: true })
        expect(result.type).toBe('mac10-x64')
        expect(result.pattern.test('electerm-2.3.151-mac10-x64.dmg')).toBe(true)
        expect(result.pattern.test('electerm-2.3.151-mac-x64.dmg')).toBe(false)
      })

      it('should prefer mac10 over arm64 when mac10 flag is set', () => {
        const result = getDownloadPattern('darwin', 'arm64', { mac10: true })
        expect(result.type).toBe('mac10-x64')
      })
    })

    describe('Linux', () => {
      it('should return linux-x64 pattern for Linux x64', () => {
        const result = getDownloadPattern('linux', 'x64', {})
        expect(result.type).toBe('linux-x64')
        expect(result.pattern.test('electerm-2.3.151-linux-x64.tar.gz')).toBe(true)
        expect(result.pattern.test('electerm-2.3.151-linux-x64-legacy.tar.gz')).toBe(false)
      })

      it('should return linux-arm64 pattern for Linux arm64', () => {
        const result = getDownloadPattern('linux', 'arm64', {})
        expect(result.type).toBe('linux-arm64')
        expect(result.pattern.test('electerm-2.3.151-linux-arm64.tar.gz')).toBe(true)
        expect(result.pattern.test('electerm-2.3.151-linux-arm64-legacy.tar.gz')).toBe(false)
      })

      it('should return linux-armv7l pattern for Linux arm', () => {
        const result = getDownloadPattern('linux', 'arm', {})
        expect(result.type).toBe('linux-armv7l')
        expect(result.pattern.test('electerm-2.3.151-linux-armv7l.tar.gz')).toBe(true)
        expect(result.pattern.test('electerm-2.3.151-linux-armv7l-legacy.tar.gz')).toBe(false)
      })

      it('should return linux-x64-legacy pattern for Linux x64 with old glibc', () => {
        const result = getDownloadPattern('linux', 'x64', { linuxLegacy: true })
        expect(result.type).toBe('linux-x64-legacy')
        expect(result.pattern.test('electerm-2.3.151-linux-x64-legacy.tar.gz')).toBe(true)
        expect(result.pattern.test('electerm-2.3.151-linux-x64.tar.gz')).toBe(false)
      })

      it('should return linux-arm64-legacy pattern for Linux arm64 with old glibc', () => {
        const result = getDownloadPattern('linux', 'arm64', { linuxLegacy: true })
        expect(result.type).toBe('linux-arm64-legacy')
        expect(result.pattern.test('electerm-2.3.151-linux-arm64-legacy.tar.gz')).toBe(true)
        expect(result.pattern.test('electerm-2.3.151-linux-arm64.tar.gz')).toBe(false)
      })

      it('should return linux-armv7l-legacy pattern for Linux arm with old glibc', () => {
        const result = getDownloadPattern('linux', 'arm', { linuxLegacy: true })
        expect(result.type).toBe('linux-armv7l-legacy')
        expect(result.pattern.test('electerm-2.3.151-linux-armv7l-legacy.tar.gz')).toBe(true)
        expect(result.pattern.test('electerm-2.3.151-linux-armv7l.tar.gz')).toBe(false)
      })
    })

    describe('Unsupported platforms', () => {
      it('should return unsupported for unknown platforms', () => {
        const result = getDownloadPattern('freebsd', 'x64', {})
        expect(result.type).toBe('unsupported')
        expect(result.pattern).toBe(null)
      })

      it('should return unsupported for aix', () => {
        const result = getDownloadPattern('aix', 'ppc64', {})
        expect(result.type).toBe('unsupported')
      })
    })
  })

  describe('Pattern matching with actual release filenames', () => {
    // Release files with sample version for testing
    const releaseFiles = [
      `electerm-${sampleVersion}-linux-aarch64-legacy.rpm`,
      `electerm-${sampleVersion}-linux-aarch64.rpm`,
      `electerm-${sampleVersion}-linux-amd64-legacy.deb`,
      `electerm-${sampleVersion}-linux-amd64.deb`,
      `electerm-${sampleVersion}-linux-amd64.snap`,
      `electerm-${sampleVersion}-linux-arm64-legacy.AppImage`,
      `electerm-${sampleVersion}-linux-arm64-legacy.deb`,
      `electerm-${sampleVersion}-linux-arm64-legacy.tar.gz`,
      `electerm-${sampleVersion}-linux-arm64.AppImage`,
      `electerm-${sampleVersion}-linux-arm64.deb`,
      `electerm-${sampleVersion}-linux-arm64.tar.gz`,
      `electerm-${sampleVersion}-linux-armv7l-legacy.AppImage`,
      `electerm-${sampleVersion}-linux-armv7l-legacy.deb`,
      `electerm-${sampleVersion}-linux-armv7l-legacy.rpm`,
      `electerm-${sampleVersion}-linux-armv7l-legacy.tar.gz`,
      `electerm-${sampleVersion}-linux-armv7l.AppImage`,
      `electerm-${sampleVersion}-linux-armv7l.deb`,
      `electerm-${sampleVersion}-linux-armv7l.rpm`,
      `electerm-${sampleVersion}-linux-armv7l.tar.gz`,
      `electerm-${sampleVersion}-linux-x64-legacy.tar.gz`,
      `electerm-${sampleVersion}-linux-x64.tar.gz`,
      `electerm-${sampleVersion}-linux-x86_64-legacy.AppImage`,
      `electerm-${sampleVersion}-linux-x86_64-legacy.rpm`,
      `electerm-${sampleVersion}-linux-x86_64.AppImage`,
      `electerm-${sampleVersion}-linux-x86_64.rpm`,
      `electerm-${sampleVersion}-mac-arm64.dmg`,
      `electerm-${sampleVersion}-mac-arm64.dmg.blockmap`,
      `electerm-${sampleVersion}-mac-x64.dmg`,
      `electerm-${sampleVersion}-mac-x64.dmg.blockmap`,
      `electerm-${sampleVersion}-mac10-x64.dmg`,
      `electerm-${sampleVersion}-mac10-x64.dmg.blockmap`,
      `electerm-${sampleVersion}-win-arm64-installer.exe`,
      `electerm-${sampleVersion}-win-arm64-installer.exe.blockmap`,
      `electerm-${sampleVersion}-win-arm64.tar.gz`,
      `electerm-${sampleVersion}-win-x64-installer.exe`,
      `electerm-${sampleVersion}-win-x64-installer.exe.blockmap`,
      `electerm-${sampleVersion}-win-x64-loose.tar.gz`,
      `electerm-${sampleVersion}-win-x64-portable.tar.gz`,
      `electerm-${sampleVersion}-win-x64.appx`,
      `electerm-${sampleVersion}-win-x64.tar.gz`,
      `electerm-${sampleVersion}-win7.tar.gz`
    ]

    it('should match exactly one tar.gz file for win-x64', () => {
      const { pattern } = getDownloadPattern('win32', 'x64', {})
      const matches = releaseFiles.filter(f => pattern.test(f))
      expect(matches).toEqual([`electerm-${sampleVersion}-win-x64.tar.gz`])
    })

    it('should match exactly one tar.gz file for win-arm64', () => {
      const { pattern } = getDownloadPattern('win32', 'arm64', {})
      const matches = releaseFiles.filter(f => pattern.test(f))
      expect(matches).toEqual([`electerm-${sampleVersion}-win-arm64.tar.gz`])
    })

    it('should match exactly one tar.gz file for win7', () => {
      const { pattern } = getDownloadPattern('win32', 'x64', { win7: true })
      const matches = releaseFiles.filter(f => pattern.test(f))
      expect(matches).toEqual([`electerm-${sampleVersion}-win7.tar.gz`])
    })

    it('should match exactly one dmg file for mac-x64', () => {
      const { pattern } = getDownloadPattern('darwin', 'x64', {})
      const matches = releaseFiles.filter(f => pattern.test(f))
      expect(matches).toEqual([`electerm-${sampleVersion}-mac-x64.dmg`])
    })

    it('should match exactly one dmg file for mac-arm64', () => {
      const { pattern } = getDownloadPattern('darwin', 'arm64', {})
      const matches = releaseFiles.filter(f => pattern.test(f))
      expect(matches).toEqual([`electerm-${sampleVersion}-mac-arm64.dmg`])
    })

    it('should match exactly one dmg file for mac10-x64', () => {
      const { pattern } = getDownloadPattern('darwin', 'x64', { mac10: true })
      const matches = releaseFiles.filter(f => pattern.test(f))
      expect(matches).toEqual([`electerm-${sampleVersion}-mac10-x64.dmg`])
    })

    it('should match exactly one tar.gz file for linux-x64', () => {
      const { pattern } = getDownloadPattern('linux', 'x64', {})
      const matches = releaseFiles.filter(f => pattern.test(f))
      expect(matches).toEqual([`electerm-${sampleVersion}-linux-x64.tar.gz`])
    })

    it('should match exactly one tar.gz file for linux-x64-legacy', () => {
      const { pattern } = getDownloadPattern('linux', 'x64', { linuxLegacy: true })
      const matches = releaseFiles.filter(f => pattern.test(f))
      expect(matches).toEqual([`electerm-${sampleVersion}-linux-x64-legacy.tar.gz`])
    })

    it('should match exactly one tar.gz file for linux-arm64', () => {
      const { pattern } = getDownloadPattern('linux', 'arm64', {})
      const matches = releaseFiles.filter(f => pattern.test(f))
      expect(matches).toEqual([`electerm-${sampleVersion}-linux-arm64.tar.gz`])
    })

    it('should match exactly one tar.gz file for linux-arm64-legacy', () => {
      const { pattern } = getDownloadPattern('linux', 'arm64', { linuxLegacy: true })
      const matches = releaseFiles.filter(f => pattern.test(f))
      expect(matches).toEqual([`electerm-${sampleVersion}-linux-arm64-legacy.tar.gz`])
    })

    it('should match exactly one tar.gz file for linux-armv7l', () => {
      const { pattern } = getDownloadPattern('linux', 'arm', {})
      const matches = releaseFiles.filter(f => pattern.test(f))
      expect(matches).toEqual([`electerm-${sampleVersion}-linux-armv7l.tar.gz`])
    })

    it('should match exactly one tar.gz file for linux-armv7l-legacy', () => {
      const { pattern } = getDownloadPattern('linux', 'arm', { linuxLegacy: true })
      const matches = releaseFiles.filter(f => pattern.test(f))
      expect(matches).toEqual([`electerm-${sampleVersion}-linux-armv7l-legacy.tar.gz`])
    })
  })
})
