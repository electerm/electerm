import React, { useState } from 'react'
import { Alert, Button } from 'antd'
import ExternalLink from '../common/external-link'

const batchOpWikiLink = 'https://github.com/electerm/electerm/wiki/batch-operation'

export default function BatchOpAlert () {
  const [expanded, setExpanded] = useState(false)

  const description = (
    <div>
      <div>
        <p>Actions: <code>connect, command, sftp_upload, sftp_download, zmodem_upload, zmodem_download</code></p>
        <p><ExternalLink to={batchOpWikiLink}>{batchOpWikiLink}</ExternalLink></p>
      </div>
      {expanded && (
        <div className='mg1t'>
          <p><strong>connect</strong> params: <code>host, port, username, authType, password, privateKey, passphrase, certificate, profile, enableSftp, enableSsh, useSshAgent, sshAgent, term, encode, envLang, setEnv, startDirectoryRemote, startDirectoryLocal, proxy, x11, displayRaw, sshTunnels, connectionHoppings</code></p>
          <p><strong>command</strong> params: <code>command</code></p>
          <p><strong>sftp_upload</strong> params: <code>localPath, remotePath</code></p>
          <p><strong>sftp_download</strong> params: <code>remotePath, localPath</code></p>
          <p><strong>zmodem_upload</strong> params: <code>files (array), protocol (trzsz|rzsz)</code></p>
          <p><strong>zmodem_download</strong> params: <code>remoteFiles (array), saveFolder, protocol (trzsz|rzsz)</code></p>
        </div>
      )}
      <Button
        size='small'
        className='mg1y'
        onClick={() => setExpanded(v => !v)}
      >
        {expanded ? 'Show less' : 'Show more'}
      </Button>
    </div>
  )

  return (
    <Alert
      message='Batch Operation Workflow'
      description={description}
      type='info'
      showIcon
      className='mg1b'
    />
  )
}
