/**
 * db common methods
 */

import {
  settingMap
} from '../common/constants'
import _ from 'lodash'
import handleError from './error-handler'
import { generate } from 'shortid'

/**
 * db action, never direct use it
 * @param  {...any} args
 */
const dbAction = (...args) => {
  return window.getGlobal('dbAction')(...args)
    .catch(handleError)
}

/**
 * standalone db names
 */
export const dbNames = _.without(
  Object.keys(settingMap), settingMap.setting
)

/**
 * db insert
 * @param {string} dbName
 * @param {object or array} inst
 */
export function insert (dbName, inst) {
  let arr = _.isArray(inst) ? inst : [inst]
  arr = arr.map(obj => {
    const { id, _id, ...rest } = obj
    return {
      id: _id || id || generate(),
      ...rest
    }
  })
  return dbAction(dbName, 'insert', arr)
}

/**
 * db delete
 * @param {string} dbName
 * @param {string} id
 */
export function remove (dbName, id) {
  const q = id
    ? {
      _id: id
    }
    : {}
  const multi = !id
  return dbAction(dbName, 'remove', q, { multi })
}

/**
 * upsert single data in db
 * @param {string} _id
 * @param {any} value
 * @param {string} db default is 'data'
 */
export function update (_id, value, db = 'data', upsert = true) {
  const update = dbNames.includes(db)
    ? {
      _id,
      ...value
    }
    : {
      _id,
      value
    }
  return dbAction(db, 'update', {
    _id
  }, update, {
    upsert
  })
}

/**
 * get doc from db
 * @param {string} dbName
 * @param {string} id
 * @return any
 */
export async function findOne (dbName, id) {
  const res = await dbAction('data', 'findOne', {
    _id: id
  })
  if (!res) {
    return res
  }
  const { _id, ...rest } = res
  return {
    id: _id,
    ...rest
  }
}

/**
 * get all data as array from databse
 * @param {string} dbName
 */
export async function find (dbName) {
  const res = await dbAction(dbName, 'find', {})
  return res.map(r => {
    const { _id, ...rest } = r
    return {
      id: _id,
      ...rest
    }
  })
}

/**
 * get value from database: data
 * @param {string} name
 * @return any
 */
export async function getData (name) {
  const res = await dbAction('data', 'findOne', {
    _id: name
  })
  return res ? res.value : undefined
}

/**
 * get sorted data from db
 * @param {string} dbName
 */
export async function fetchInitData (dbName) {
  const res = await find(dbName)
  const order = await getData(`${dbName}:order`)
  return res.sort((a, b) => {
    const ai = _.findIndex(order, r => r === a.id)
    const bi = _.findIndex(order, r => r === b.id)
    return ai - bi
  })
}
