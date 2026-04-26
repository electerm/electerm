const { spawn } = require('child_process')

function encodeUtf8Base64 (value) {
  return Buffer.from(String(value), 'utf8').toString('base64')
}

function parseEditorCommand (command = '') {
  const input = String(command).trim()
  if (!input) {
    throw new Error('Editor command is required')
  }

  const args = []
  let current = ''
  let quote = ''

  for (let index = 0; index < input.length; index++) {
    const char = input[index]

    if (quote) {
      if (char === quote) {
        quote = ''
      } else if (char === '\\' && input[index + 1] === quote) {
        current += quote
        index++
      } else {
        current += char
      }
      continue
    }

    if (char === '"' || char === '\'') {
      quote = char
      continue
    }

    if (/\s/.test(char)) {
      if (current) {
        args.push(current)
        current = ''
      }
      continue
    }

    current += char
  }

  if (quote) {
    throw new Error('Editor command contains an unmatched quote')
  }

  if (current) {
    args.push(current)
  }

  if (!args.length) {
    throw new Error('Editor command is required')
  }

  return {
    command: args[0],
    args: args.slice(1)
  }
}

function spawnDetachedEditor (command, args, options = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      detached: false,
      stdio: ['ignore', 'ignore', 'pipe'],
      ...options
    })
    let stderr = ''

    child.stderr.on('data', data => {
      stderr += data.toString()
    })
    child.on('error', reject)

    let settled = false
    const settle = (err) => {
      if (settled) {
        return
      }
      settled = true
      clearTimeout(timer)
      child.unref()
      if (err) {
        reject(err)
      } else {
        resolve()
      }
    }

    child.on('close', code => {
      if (code !== 0) {
        settle(new Error(stderr.trim() || `Editor exited with code ${code}`))
      } else {
        settle(null)
      }
    })

    const timer = setTimeout(() => settle(null), 5000)
  })
}

function openFileWithEditor (filePath, editorCommand) {
  const parsed = parseEditorCommand(editorCommand)

  if (process.platform === 'win32') {
    const script = [
      '$editor = [System.Text.Encoding]::UTF8.GetString([System.Convert]::FromBase64String($env:ELECTERM_EDITOR_COMMAND_B64))',
      '$editorArgsJson = [System.Text.Encoding]::UTF8.GetString([System.Convert]::FromBase64String($env:ELECTERM_EDITOR_ARGS_B64))',
      '$editorArgs = @((ConvertFrom-Json -InputObject $editorArgsJson))',
      '& $editor @editorArgs',
      'if ($LASTEXITCODE -ne $null) { exit $LASTEXITCODE }'
    ].join('; ')

    return spawnDetachedEditor('powershell.exe', [
      '-NoLogo',
      '-Command',
      script
    ], {
      windowsHide: true,
      env: {
        ...process.env,
        ELECTERM_EDITOR_COMMAND_B64: encodeUtf8Base64(parsed.command),
        ELECTERM_EDITOR_ARGS_B64: encodeUtf8Base64(JSON.stringify([...parsed.args, filePath]))
      }
    })
  }

  const userShell = process.env.SHELL || '/bin/sh'

  return spawnDetachedEditor(userShell, [
    '-l',
    '-i',
    '-c',
    'exec "$0" "$@"',
    parsed.command,
    ...parsed.args,
    filePath
  ])
}

exports.openFileWithEditor = openFileWithEditor
exports.parseEditorCommand = parseEditorCommand
