import _ from 'lodash'
import CONFIG from '../config'

const {site: local} = CONFIG

export default async (ctx, next) => {
  let arr = ctx.href.split('/')
  let host = local.host || (arr[0] + '//' + arr[2])
  let {href, path} = ctx

  ctx.local = {
    ...local,
    host,
    href,
    _,
    path,
    serverTime: +new Date()
  }

  if (!local.cdn) ctx.local.cdn = host

  await next()

}
