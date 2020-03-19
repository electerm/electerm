/**
 * db common methods
 */

import {
  settingMap
} from '../common/constants'
import _ from 'lodash'
import handleError from './error-handler'

export const dbNames = _.without(
  Object.keys(settingMap), settingMap.setting
)

export const dbAction = (...args) => {
  return window.getGlobal('dbAction')(...args)
    .catch(handleError)
}

export function setData (_id, value, db = 'data') {
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
    upsert: true
  })
}

export async function getArrayData (dbName) {
  const res = await dbAction(dbName, 'find', {})
  return res.map(r => {
    const { _id, ...rest } = r
    return {
      id: _id,
      ...rest
    }
  })
}

export async function getData (name) {
  const res = await dbAction('data', 'findOne', {
    _id: name
  })
  return res ? res.value : undefined
}
