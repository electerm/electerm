const { z } = require('../../src/app/lib/zod')
const zodOriginal = require('zod')
const {
  test: it, expect
} = require('@playwright/test')
const { describe } = it
it.setTimeout(100000)

describe('custom zod replacement', function () {
  describe('basic types', function () {
    it('z.string() creates string schema', function () {
      const schema = z.string()
      expect(schema._typeName).toEqual('string')
      expect(schema['~standard']).toBeTruthy()
    })

    it('z.number() creates number schema', function () {
      const schema = z.number()
      expect(schema._typeName).toEqual('number')
    })

    it('z.boolean() creates boolean schema', function () {
      const schema = z.boolean()
      expect(schema._typeName).toEqual('boolean')
    })

    it('z.any() creates any schema', function () {
      const schema = z.any()
      expect(schema._typeName).toEqual('any')
    })
  })

  describe('.optional() and .describe()', function () {
    it('.optional() marks schema as optional', function () {
      const schema = z.string().optional()
      expect(schema._optional).toEqual(true)
      // Original should not be mutated
      const original = z.string()
      expect(original._optional).toEqual(false)
    })

    it('.describe() adds description', function () {
      const schema = z.string().describe('A name')
      expect(schema._description).toEqual('A name')
    })

    it('chaining .optional().describe() works', function () {
      const schema = z.number().optional().describe('Optional port')
      expect(schema._optional).toEqual(true)
      expect(schema._description).toEqual('Optional port')
    })

    it('chaining .describe().optional() works', function () {
      const schema = z.number().describe('Port').optional()
      expect(schema._optional).toEqual(true)
      expect(schema._description).toEqual('Port')
    })
  })

  describe('z.enum()', function () {
    it('creates enum schema', function () {
      const schema = z.enum(['a', 'b', 'c'])
      expect(schema._typeName).toEqual('enum')
      expect(schema._meta.values).toEqual(['a', 'b', 'c'])
    })

    it('supports .optional().describe()', function () {
      const schema = z.enum(['none', 'even']).optional().describe('Parity')
      expect(schema._optional).toEqual(true)
      expect(schema._description).toEqual('Parity')
    })
  })

  describe('z.object()', function () {
    it('creates object schema', function () {
      const schema = z.object({
        name: z.string(),
        age: z.number().optional()
      })
      expect(schema._typeName).toEqual('object')
    })

    it('z.object({}) creates empty object schema', function () {
      const schema = z.object({})
      expect(schema._typeName).toEqual('object')
    })
  })

  describe('z.array()', function () {
    it('creates array schema', function () {
      const schema = z.array(z.string())
      expect(schema._typeName).toEqual('array')
    })

    it('supports .optional().describe()', function () {
      const schema = z.array(z.string()).optional().describe('Tags')
      expect(schema._optional).toEqual(true)
      expect(schema._description).toEqual('Tags')
    })
  })

  describe('z.record()', function () {
    it('creates record schema with value type', function () {
      const schema = z.record(z.any())
      expect(schema._typeName).toEqual('record')
    })

    it('creates record schema with key and value types', function () {
      const schema = z.record(z.string(), z.any())
      expect(schema._typeName).toEqual('record')
    })
  })

  describe('z.toJSONSchema() - comparison with real zod', function () {
    it('converts simple string schema', function () {
      const custom = z.toJSONSchema(z.object({ name: z.string() }))
      const original = zodOriginal.z.toJSONSchema(
        zodOriginal.z.object({ name: zodOriginal.z.string() })
      )
      expect(custom.type).toEqual('object')
      expect(custom.properties.name.type).toEqual(original.properties.name.type)
      expect(custom.required).toContain('name')
    })

    it('converts object with optional fields', function () {
      const custom = z.toJSONSchema(z.object({
        host: z.string(),
        port: z.number().optional()
      }))
      expect(custom.type).toEqual('object')
      expect(custom.properties.host.type).toEqual('string')
      expect(custom.properties.port.type).toEqual('number')
      expect(custom.required).toContain('host')
      expect(custom.required).not.toContain('port')
    })

    it('converts enum schema', function () {
      const custom = z.toJSONSchema(z.object({
        parity: z.enum(['none', 'even', 'odd'])
      }))
      const original = zodOriginal.z.toJSONSchema(
        zodOriginal.z.object({
          parity: zodOriginal.z.enum(['none', 'even', 'odd'])
        })
      )
      expect(custom.properties.parity.enum).toEqual(original.properties.parity.enum)
    })

    it('converts array schema', function () {
      const custom = z.toJSONSchema(z.object({
        tags: z.array(z.string()).optional()
      }))
      expect(custom.properties.tags.type).toEqual('array')
      expect(custom.properties.tags.items.type).toEqual('string')
      expect(custom.required || []).not.toContain('tags')
    })

    it('converts nested object schema', function () {
      const inner = z.object({
        command: z.string(),
        delay: z.number().optional()
      })
      const custom = z.toJSONSchema(z.object({
        scripts: z.array(inner).optional()
      }))
      expect(custom.properties.scripts.type).toEqual('array')
      expect(custom.properties.scripts.items.type).toEqual('object')
      expect(custom.properties.scripts.items.properties.command.type).toEqual('string')
    })

    it('converts record schema', function () {
      const custom = z.toJSONSchema(z.object({
        updates: z.record(z.any())
      }))
      expect(custom.properties.updates.type).toEqual('object')
      expect(custom.properties.updates.additionalProperties).toBeTruthy()
    })

    it('handles descriptions', function () {
      const custom = z.toJSONSchema(z.object({
        host: z.string().describe('Host address'),
        port: z.number().optional().describe('Port number')
      }))
      expect(custom.properties.host.description).toEqual('Host address')
      expect(custom.properties.port.description).toEqual('Port number')
    })
  })

  describe('z.toJSONSchema() - plain shape objects (MCP inputSchema pattern)', function () {
    it('converts plain object with zod values', function () {
      const inputSchema = {
        tabId: z.string().describe('Tab ID to switch to')
      }
      const result = z.toJSONSchema(z.object(inputSchema))
      expect(result.type).toEqual('object')
      expect(result.properties.tabId.type).toEqual('string')
      expect(result.properties.tabId.description).toEqual('Tab ID to switch to')
    })

    it('handles empty object', function () {
      const result = z.toJSONSchema(z.object({}))
      expect(result.type).toEqual('object')
    })

    it('handles null/undefined input', function () {
      const result = z.toJSONSchema(null)
      expect(result.type).toEqual('object')
    })
  })

  describe('~standard marker compatibility', function () {
    it('all schema types have ~standard property', function () {
      expect(z.string()['~standard']).toBeTruthy()
      expect(z.number()['~standard']).toBeTruthy()
      expect(z.boolean()['~standard']).toBeTruthy()
      expect(z.any()['~standard']).toBeTruthy()
      expect(z.enum(['a'])['~standard']).toBeTruthy()
      expect(z.object({})['~standard']).toBeTruthy()
      expect(z.array(z.string())['~standard']).toBeTruthy()
      expect(z.record(z.any())['~standard']).toBeTruthy()
    })

    it('optional/describe clones preserve ~standard', function () {
      const schema = z.string().optional().describe('test')
      expect(schema['~standard']).toBeTruthy()
    })
  })

  describe('bookmark-zod-schemas compatibility', function () {
    it('can build the full SSH bookmark schema and convert to JSON', function () {
      const runScriptSchema = z.object({
        delay: z.number().optional().describe('Delay in ms'),
        script: z.string().describe('Command to execute')
      })

      const sshBookmarkSchema = {
        title: z.string().describe('Bookmark title'),
        host: z.string().describe('SSH host address'),
        port: z.number().optional().describe('SSH port'),
        username: z.string().optional().describe('SSH username'),
        password: z.string().optional().describe('SSH password'),
        authType: z.enum(['password', 'privateKey', 'profiles']).optional().describe('Auth type'),
        runScripts: z.array(runScriptSchema).optional().describe('Run scripts'),
        serverHostKey: z.array(z.string()).optional().describe('Server host key algorithms'),
        x11: z.boolean().optional().describe('Enable x11 forwarding')
      }

      const jsonSchema = z.toJSONSchema(z.object(sshBookmarkSchema))
      expect(jsonSchema.type).toEqual('object')
      expect(jsonSchema.properties.title.type).toEqual('string')
      expect(jsonSchema.properties.host.type).toEqual('string')
      expect(jsonSchema.properties.port.type).toEqual('number')
      expect(jsonSchema.properties.authType.enum).toEqual(['password', 'privateKey', 'profiles'])
      expect(jsonSchema.properties.runScripts.type).toEqual('array')
      expect(jsonSchema.properties.runScripts.items.properties.script.type).toEqual('string')
      expect(jsonSchema.properties.serverHostKey.type).toEqual('array')
      expect(jsonSchema.properties.serverHostKey.items.type).toEqual('string')
      expect(jsonSchema.properties.x11.type).toEqual('boolean')
      expect(jsonSchema.required).toContain('title')
      expect(jsonSchema.required).toContain('host')
      expect(jsonSchema.required).not.toContain('port')
      expect(jsonSchema.required).not.toContain('x11')
    })
  })

  describe('streamableHttp zodToJsonSchema compatibility', function () {
    it('handles plain shape objects with ~standard check', function () {
      const inputSchema = {
        tabId: z.string().describe('Tab ID'),
        lines: z.number().optional().describe('Number of lines')
      }

      // This mimics the check in streamableHttp.js
      const hasZodStandard = Object.values(inputSchema).some(
        v => v && typeof v === 'object' && '~standard' in v
      )
      expect(hasZodStandard).toEqual(true)

      // Wrap in z.object and convert
      const zodObject = z.object(
        Object.fromEntries(
          Object.entries(inputSchema).map(([key, value]) => [key, value])
        )
      )
      const jsonSchema = z.toJSONSchema(zodObject)
      expect(jsonSchema.type).toEqual('object')
      expect(jsonSchema.properties.tabId.type).toEqual('string')
      expect(jsonSchema.properties.lines.type).toEqual('number')
    })

    it('handles z.object({}) inputSchema', function () {
      const inputSchema = z.object({})
      const hasStandard = '~standard' in inputSchema
      expect(hasStandard).toEqual(true)

      const jsonSchema = z.toJSONSchema(inputSchema)
      expect(jsonSchema.type).toEqual('object')
    })
  })
})
