const { mkdtempSync } = require('node:fs')
const path = require('node:path')
const { execFileSync } = require('node:child_process')
const { _electron } = require(process.env.PLAYWRIGHT_MODULE || 'playwright')
const { seedIsolatedData } = require('./e2e/common/webgl-test-isolation')

async function main () {
  const builds = process.argv.slice(2)
  for (let i = 0; i < 3 * builds.length; i++) {
    const build = i % builds.length
    const data = mkdtempSync(path.resolve('.cache/startup-'))
    seedIsolatedData(data)
    const start = performance.now()
    const env = { ...process.env, DATA_PATH: data }
    for (const name of ['LANG', 'LANGUAGE', 'LC_ALL', 'LC_MESSAGES']) delete env[name]
    const app = await _electron.launch({
      executablePath: path.resolve(builds[build]),
      env
    })
    try {
      const page = await app.firstWindow()
      const windowMs = Math.round(performance.now() - start)
      await page.waitForFunction(() => window.store?.currentTab?.status === 'success')
      await page.locator('.session-current .xterm-helper-textarea').focus()
      await page.keyboard.insertText("Write-Output ('READY_'+'BENCH')")
      await page.keyboard.press('Enter')
      await page.waitForFunction(() => document.body.innerText.split(/\r?\n/).some(l => l.trim() === 'READY_BENCH'))
      const readyMs = Math.round(performance.now() - start)
      await page.waitForTimeout(2500)
      const pid = app.process().pid
      const privateMiB = Number(execFileSync('powershell.exe', ['-NoProfile', '-Command', `
        $all = @(Get-CimInstance Win32_Process)
        $ids = @(${pid})
        do {
          $next = @($all | Where-Object { $_.ParentProcessId -in $ids -and $_.ProcessId -notin $ids } | ForEach-Object ProcessId)
          $ids += $next
        } while ($next.Count)
        [Math]::Round((Get-Process -Id $ids -ErrorAction SilentlyContinue | Measure-Object PrivateMemorySize64 -Sum).Sum / 1MB)
      `], { windowsHide: true, encoding: 'utf8' }).trim())
      console.log(JSON.stringify({ build, windowMs, readyMs, privateMiB }))
    } finally {
      await app.close()
    }
  }
}
main().catch(e => { console.error(e); process.exitCode = 1 })
