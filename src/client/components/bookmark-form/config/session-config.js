// Config for each session type to drive rendering
import { connectionMap } from '../../../common/constants'
import ssh from './ssh'
import local from './local'

const sessionConfig = {
  [connectionMap.ssh]: ssh,
  [connectionMap.local]: local
}

export default sessionConfig
