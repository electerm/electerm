const { describe, test } = require('node:test')
const assert = require('node:assert/strict')

const load = () => import('../../client/components/terminal/shell.js')

// Issue #4610: telnet to a Huawei VRP switch. The remote `$SHELL` probe was
// answered with a CLI error banner, which was read as "some sh-compatible
// shell", so the PS1 integration script was typed into a device that cannot
// run `eval`. The device echoed it, the screen stayed frozen for the whole
// suppression window and the text ended up in the scrollback.
describe('remote shell probe parsing', () => {
  test('reads a normal shell path', async () => {
    const { parseRemoteShell } = await load()
    assert.equal(parseRemoteShell('/bin/bash\n'), 'bash')
    assert.equal(parseRemoteShell('/usr/local/bin/zsh'), 'zsh')
    assert.equal(parseRemoteShell('/usr/bin/fish\n'), 'fish')
    assert.equal(parseRemoteShell('/bin/dash\n'), 'sh')
  })

  test('is not fooled by an error banner or a prompt', async () => {
    const { parseRemoteShell } = await load()
    // Huawei VRP answers an unknown command like this
    assert.equal(parseRemoteShell('Error: Unrecognized command found at \'^\' position.\n'), '')
    assert.equal(parseRemoteShell('<HUAWEI>'), '')
    assert.equal(parseRemoteShell('% Invalid input detected\n'), '')
    // empty answer: $SHELL unset, or the command was swallowed
    assert.equal(parseRemoteShell(''), '')
    assert.equal(parseRemoteShell('   \r\n'), '')
    assert.equal(parseRemoteShell(undefined), '')
  })
})
