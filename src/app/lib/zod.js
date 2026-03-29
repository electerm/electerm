/**
 * Lightweight zod replacement for electerm
 * Covers only the API surface used in the project:
 * z.string(), z.number(), z.boolean(), z.any(),
 * z.enum(), z.object(), z.array(), z.record(),
 * .optional(), .describe(), z.toJSONSchema()
 */

class ZodType {
  constructor (typeName, meta = {}) {
    this._typeName = typeName
    this._optional = false
    this._description = undefined
    this._meta = meta
    // Mark as zod-compatible schema
    this['~standard'] = { type: typeName }
  }

  optional () {
    const clone = this._clone()
    clone._optional = true
    return clone
  }

  describe (desc) {
    const clone = this._clone()
    clone._description = desc
    return clone
  }

  _clone () {
    const clone = Object.create(Object.getPrototypeOf(this))
    Object.assign(clone, this)
    // Re-create the ~standard marker so it's own-property
    clone['~standard'] = { ...this['~standard'] }
    return clone
  }

  _toJsonSchema () {
    throw new Error('_toJsonSchema not implemented for ' + this._typeName)
  }
}

class ZodString extends ZodType {
  constructor () {
    super('string')
  }

  _toJsonSchema () {
    return { type: 'string' }
  }
}

class ZodNumber extends ZodType {
  constructor () {
    super('number')
  }

  _toJsonSchema () {
    return { type: 'number' }
  }
}

class ZodBoolean extends ZodType {
  constructor () {
    super('boolean')
  }

  _toJsonSchema () {
    return { type: 'boolean' }
  }
}

class ZodAny extends ZodType {
  constructor () {
    super('any')
  }

  _toJsonSchema () {
    return {}
  }
}

class ZodEnum extends ZodType {
  constructor (values) {
    super('enum', { values })
  }

  _toJsonSchema () {
    return { type: 'string', enum: this._meta.values }
  }
}

class ZodArray extends ZodType {
  constructor (itemSchema) {
    super('array', { itemSchema })
  }

  _toJsonSchema () {
    const items = schemaToJsonSchema(this._meta.itemSchema)
    return { type: 'array', items }
  }
}

class ZodObject extends ZodType {
  constructor (shape) {
    super('object', { shape })
  }

  _toJsonSchema () {
    const properties = {}
    const required = []
    const shape = this._meta.shape || {}
    for (const [key, schema] of Object.entries(shape)) {
      properties[key] = schemaToJsonSchema(schema)
      if (schema._description) {
        properties[key].description = schema._description
      }
      if (!schema._optional) {
        required.push(key)
      }
    }
    const result = { type: 'object', properties }
    if (required.length > 0) {
      result.required = required
    }
    return result
  }
}

class ZodRecord extends ZodType {
  constructor (valueSchema) {
    super('record', { valueSchema })
  }

  _toJsonSchema () {
    const additionalProperties = schemaToJsonSchema(this._meta.valueSchema)
    return { type: 'object', additionalProperties }
  }
}

function schemaToJsonSchema (schema) {
  if (!schema) {
    return {}
  }
  if (schema instanceof ZodType) {
    const base = schema._toJsonSchema()
    if (schema._description) {
      base.description = schema._description
    }
    return base
  }
  // Plain object with zod values (used as inputSchema in MCP tools)
  if (typeof schema === 'object' && !Array.isArray(schema)) {
    return objectShapeToJsonSchema(schema)
  }
  return {}
}

function objectShapeToJsonSchema (shape) {
  const properties = {}
  const required = []
  for (const [key, value] of Object.entries(shape)) {
    if (value instanceof ZodType) {
      properties[key] = schemaToJsonSchema(value)
      if (!value._optional) {
        required.push(key)
      }
    }
  }
  const result = { type: 'object', properties }
  if (required.length > 0) {
    result.required = required
  }
  return result
}

const z = {
  string: () => new ZodString(),
  number: () => new ZodNumber(),
  boolean: () => new ZodBoolean(),
  any: () => new ZodAny(),
  enum: (values) => new ZodEnum(values),
  object: (shape) => new ZodObject(shape || {}),
  array: (itemSchema) => new ZodArray(itemSchema),
  record: (keyOrValue, maybeValue) => {
    // z.record(valueSchema) or z.record(keySchema, valueSchema)
    const valueSchema = maybeValue || keyOrValue
    return new ZodRecord(valueSchema)
  },
  toJSONSchema: (schema) => {
    if (schema instanceof ZodType) {
      return schema._toJsonSchema()
    }
    if (typeof schema === 'object' && schema !== null) {
      // Check if it's a plain shape object with ~standard values
      const hasZodValues = Object.values(schema).some(
        v => v instanceof ZodType
      )
      if (hasZodValues) {
        return objectShapeToJsonSchema(schema)
      }
    }
    return { type: 'object', properties: {} }
  }
}

module.exports = { z, ZodType }
