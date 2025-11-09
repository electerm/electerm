/**
 * Render proper form according to session config
 */
import sessionConfig from './config/session-config'
import { connectionMap } from '../../common/constants'
import FormRenderer from './form-renderer'

export default function renderForm (type, props) {
  const conf = sessionConfig[type] || sessionConfig[connectionMap.ssh]
  return <FormRenderer config={conf} props={props} />
}
