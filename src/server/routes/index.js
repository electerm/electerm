import Router from 'koa-router'
import {
  index
} from '../controllers'

//console.log(apis)
const router = new Router()

export default (app) => {
  router.get('/', index)

  app
    .use(router.routes())
    .use(router.allowedMethods())

}
