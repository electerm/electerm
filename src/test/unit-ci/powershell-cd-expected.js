module.exports = function expectedPowerShellCd (dir) {
  const encoded = Buffer.from(dir, 'utf8').toString('base64')
  return `Set-Location -LiteralPath ([System.Text.Encoding]::UTF8.GetString([System.Convert]::FromBase64String('${encoded}')))`
}
