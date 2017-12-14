/**
 * ua
 */

import useragent from 'useragent'
import _ from 'lodash'

export default async function (ctx, next) {

  if (
    /^\/api\//.test(ctx.path)
  ) return await next()

  let
    userAgent = ctx.get('user-agent'),
    agent = useragent.parse(userAgent),
    is = useragent.is(userAgent),
    ua = [],
    os = agent.os,
    device = agent.device

  _.each(is, function (v, k) {
    if (k === 'version') ua.push('v' + v)
    else if (v) ua.push(k)
  })

  if (os) ua.push('os-' + os.family)
  if (device) ua.push('device-' + device.family)

  if (is.ie) {
    is.modern = false
    ua.push('obsolete')
  } else {
    is.modern = true
    ua.push('modern')
  }

  is.browserVersion = agent.toVersion()
  //console.log(is.browserVersion, 'is.browserVersion')
  let okChrome = is.chrome && is.browserVersion > '52.0'
  is.okChrome = okChrome
  ua.push(okChrome ? 'ok-browser' : 'not-ok-browser')
  ua.push(is.browserVersion)

  ctx.local = ctx.local || {}
  _.assign(ctx.local, {
    ua: is,
    uaArr: ua
  })
  //console.log(is)
  return await next()

}
