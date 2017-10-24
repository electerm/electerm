import _ from 'lodash'
import CONFIG from '../config'
import serialize from 'serialize-javascript'

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
    serialize,
    serverTime: +new Date()
  }
console.log(ctx.local, 'ctx.local')
  if (!local.cdn) ctx.local.cdn = host

  await next()

}
