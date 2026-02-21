// Config for each session type to drive rendering
import { connectionMap } from '../../../common/constants'
import ssh from './ssh'
import web from './web'
import vnc from './vnc'
import telnet from './telnet'
import serial from './serial'
import local from './local'
import rdp from './rdp'
import ftp from './ftp'
import spice from './spice'

const sessionConfig = {
  [connectionMap.ssh]: ssh,
  [connectionMap.telnet]: telnet,
  [connectionMap.serial]: serial,
  [connectionMap.local]: local,
  [connectionMap.vnc]: vnc,
  [connectionMap.rdp]: rdp,
  [connectionMap.ftp]: ftp,
  [connectionMap.web]: web,
  [connectionMap.spice]: spice
}

export default sessionConfig
