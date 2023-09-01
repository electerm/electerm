/**
 * file permission render
 */

import { Button } from 'antd'
import { isFunction, noop } from 'lodash-es'

const { prefix } = window
const e = prefix('permission')
const { Group } = Button

export default (perm, _onClick) => {
  const {
    name,
    permission
  } = perm
  const onClick = isFunction(_onClick)
    ? _onClick
    : noop
  return (
    <div key={name + 'pr'} className='pd1b'>
      <span className='iblock mg1r'>{e(name)}</span>
      <Group className='iblock'>
        {
          Object.keys(permission).map(n => {
            const type = permission[n]
              ? 'primary'
              : 'ghost'
            return (
              <Button
                key={n + 'permi'}
                type={type}
                onClick={() => onClick(name, n)}
              >
                {e(n)}
              </Button>
            )
          })
        }
      </Group>
    </div>
  )
}
