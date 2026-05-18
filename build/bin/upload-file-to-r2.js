const fs = require('fs')
const path = require('path')

async function main () {
  const filePath = process.argv[2]
  const key = process.argv[3] || path.basename(filePath || '')

  if (!filePath) {
    throw new Error('Usage: node build/bin/upload-file-to-r2.js <filePath> [key]')
  }

  if (!fs.existsSync(filePath)) {
    throw new Error(`File does not exist: ${filePath}`)
  }

  const accountId = process.env.CF_R2_ACCOUNT_ID
  const bucket = process.env.CF_R2_BUCKET
  const accessKeyId = process.env.CF_R2_ACCESS_KEY_ID
  const secretAccessKey = process.env.CF_R2_SECRET_ACCESS_KEY

  if (!accountId || !bucket || !accessKeyId || !secretAccessKey) {
    throw new Error('Missing required env vars: CF_R2_ACCOUNT_ID, CF_R2_BUCKET, CF_R2_ACCESS_KEY_ID, CF_R2_SECRET_ACCESS_KEY')
  }

  const { S3Client, PutObjectCommand } = require('@aws-sdk/client-s3')

  const client = new S3Client({
    region: 'auto',
    endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
    credentials: {
      accessKeyId,
      secretAccessKey
    }
  })

  const fileStream = fs.createReadStream(filePath)
  const command = new PutObjectCommand({
    Bucket: bucket,
    Key: key,
    Body: fileStream,
    ContentLength: fs.statSync(filePath).size,
    ContentType: 'text/plain; charset=utf-8',
    CacheControl: 'no-store'
  })

  await client.send(command)
  console.log(`[r2] Uploaded ${filePath} to ${bucket}/${key}`)
}

main().catch(err => {
  console.error(err)
  process.exit(1)
})
