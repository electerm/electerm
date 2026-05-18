/**
 * Per-terminal log path editor
 * Reads/writes logPath on the terminal's own state via refs
 */
import { Button } from 'antd'
import message from '../common/message'
import InputConfirm from '../common/input-confirm'
import ShowItem from '../common/show-item'
import { chooseSaveDirectory } from '../../common/choose-save-folder'
import createDefaultLogPath from '../../common/default-log-path'
import { osResolve } from '../../common/resolve'

const e = window.translate

export default function LogPathEdit ({ pid, logPath, logName, setLogPath }) {
  const defaultPath = createDefaultLogPath()
  const base = logPath || defaultPath
  const fullPath = osResolve(base, logName + '.log')

  const testAndSet = async (v) => {
    if (v) {
      try {
        const { fs } = window
        const uid = 'test-' + Date.now()
        const testFile = osResolve(v, uid + '.test.log')
        await fs.touch(testFile)
        await fs.unlink(testFile)
      } catch (err) {
        console.log('log path test failed', err)
        message.error('invalid log folder')
        return
      }
    }
    setLogPath(v)
  }

  const handleChange = (v) => {
    testAndSet(v)
  }

  const handleChooseFolder = async () => {
    const path = await chooseSaveDirectory()
    if (path) {
      handleChange(path)
    }
  }

  const handleReset = () => {
    setLogPath('')
  }

  const inputProps = {
    value: logPath,
    placeholder: defaultPath,
    onChange: handleChange,
    addonAfter: (
      <>
        <Button
          onClick={handleChooseFolder}
          className='mg1r'
          type='text'
          size='small'
        >
          {e('chooseFolder')}
        </Button>
        <Button
          size='small'
          type='text'
          onClick={handleReset}
        >
          {e('reset')}
        </Button>
      </>
    ),
    prefix: e('terminalLogPath') + ': '
  }

  return (
    <div className='pd1b'>
      <InputConfirm {...inputProps} />
      <div className='pd1t font-xs color-grey'>
        {fullPath} <ShowItem to={fullPath} />
      </div>
    </div>
  )
}
