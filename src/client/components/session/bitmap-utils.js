/* eslint-disable camelcase */

const TOTAL_MEMORY = 16777216
const buffer = new ArrayBuffer(TOTAL_MEMORY)
export const HEAPU8 = new Uint8Array(buffer)
export const HEAP32 = new Int32Array(buffer)
HEAP32[0] = 255
const PAGE_SIZE = 4096
let DYNAMICTOP = 0
let STACKTOP = 0

const Runtime = {
  stackSave: function () {
    return STACKTOP
  },
  stackRestore: function (stackTop) {
    STACKTOP = stackTop
  },
  // forceAlign: function (target, quantum) {
  //   quantum = quantum || 4
  //   if (quantum === 1) return target
  //   if (isNumber(target) && isNumber(quantum)) {
  //     return Math.ceil(target / quantum) * quantum
  //   } else if (isNumber(quantum) && isPowerOfTwo(quantum)) {
  //     return '(((' + target + ')+' + (quantum - 1) + ')&' + -quantum + ')'
  //   }
  //   return 'Math.ceil((' + target + ')/' + quantum + ')*' + quantum
  // },
  isNumberType: function (type) {
    return type in Runtime.INT_TYPES || type in Runtime.FLOAT_TYPES
  },
  isPointerType: function isPointerType (type) {
    return type[type.length - 1] === '*'
  },
  isStructType: function isStructType (type) {
    if (isPointerType(type)) return false
    if (isArrayType(type)) return true
    if (/<?{ ?[^}]* ?}>?/.test(type)) return true // { i32, i8 } etc. - anonymous struct types
    // See comment in isStructPointerType()
    return type[0] === '%'
  },
  INT_TYPES: { i1: 0, i8: 0, i16: 0, i32: 0, i64: 0 },
  FLOAT_TYPES: { float: 0, double: 0 },
  or64: function (x, y) {
    const l = (x | 0) | (y | 0)
    const h = (Math.round(x / 4294967296) | Math.round(y / 4294967296)) * 4294967296
    return l + h
  },
  and64: function (x, y) {
    const l = (x | 0) & (y | 0)
    const h = (Math.round(x / 4294967296) & Math.round(y / 4294967296)) * 4294967296
    return l + h
  },
  xor64: function (x, y) {
    const l = (x | 0) ^ (y | 0)
    const h = (Math.round(x / 4294967296) ^ Math.round(y / 4294967296)) * 4294967296
    return l + h
  },
  getNativeTypeSize: function (type) {
    switch (type) {
      case 'i1': case 'i8': return 1
      case 'i16': return 2
      case 'i32': return 4
      case 'i64': return 8
      case 'float': return 4
      case 'double': return 8
      default: {
        if (type[type.length - 1] === '*') {
          return Runtime.QUANTUM_SIZE // A pointer
        } else if (type[0] === 'i') {
          const bits = parseInt(type.substr(1))
          assert(bits % 8 === 0)
          return bits / 8
        } else {
          return 0
        }
      }
    }
  },
  getNativeFieldSize: function (type) {
    return Math.max(Runtime.getNativeTypeSize(type), Runtime.QUANTUM_SIZE)
  },
  dedup: function dedup (items, ident) {
    const seen = {}
    if (ident) {
      return items.filter(function (item) {
        if (seen[item[ident]]) return false
        seen[item[ident]] = true
        return true
      })
    } else {
      return items.filter(function (item) {
        if (seen[item]) return false
        seen[item] = true
        return true
      })
    }
  },
  set: function set () {
    const args = typeof arguments[0] === 'object' ? arguments[0] : arguments
    const ret = {}
    for (let i = 0; i < args.length; i++) {
      ret[args[i]] = 0
    }
    return ret
  },
  STACK_ALIGN: 8,
  getAlignSize: function (type, size, vararg) {
    // we align i64s and doubles on 64-bit boundaries, unlike x86
    if (vararg) return 8
    if (!vararg && (type === 'i64' || type === 'double')) return 8
    if (!type) return Math.min(size, 8) // align structures internally to 64 bits
    return Math.min(size || (type ? Runtime.getNativeFieldSize(type) : 0), Runtime.QUANTUM_SIZE)
  },
  calculateStructAlignment: function calculateStructAlignment (type) {
    type.flatSize = 0
    type.alignSize = 0
    const diffs = []
    let prev = -1
    let index = 0
    type.flatIndexes = type.fields.map(function (field) {
      index++
      let size, alignSize
      if (Runtime.isNumberType(field) || Runtime.isPointerType(field)) {
        size = Runtime.getNativeTypeSize(field) // pack char; char; in structs, also char[X]s.
        alignSize = Runtime.getAlignSize(field, size)
      } else if (Runtime.isStructType(field)) {
        if (field[1] === '0') {
          // this is [0 x something]. When inside another structure like here, it must be at the end,
          // and it adds no size
          // XXX this happens in java-nbody for example... assert(index === type.fields.length, 'zero-length in the middle!');
          size = 0
          if (Types.types[field]) {
            alignSize = Runtime.getAlignSize(null, Types.types[field].alignSize)
          } else {
            alignSize = type.alignSize || QUANTUM_SIZE
          }
        } else {
          size = Types.types[field].flatSize
          alignSize = Runtime.getAlignSize(null, Types.types[field].alignSize)
        }
      } else if (field[0] === 'b') {
        // bN, large number field, like a [N x i8]
        size = field.substr(1) | 0
        alignSize = 1
      } else if (field[0] === '<') {
        // vector type
        size = alignSize = Types.types[field].flatSize // fully aligned
      } else if (field[0] === 'i') {
        // illegal integer field, that could not be legalized because it is an internal structure field
        // it is ok to have such fields, if we just use them as markers of field size and nothing more complex
        size = alignSize = parseInt(field.substr(1)) / 8
        assert(size % 1 === 0, 'cannot handle non-byte-size field ' + field)
      } else {
        assert(false, 'invalid type for calculateStructAlignment')
      }
      if (type.packed) alignSize = 1
      type.alignSize = Math.max(type.alignSize, alignSize)
      const curr = Runtime.alignMemory(type.flatSize, alignSize) // if necessary, place this on aligned memory
      type.flatSize = curr + size
      if (prev >= 0) {
        diffs.push(curr - prev)
      }
      prev = curr
      return curr
    })
    if (type.name_ && type.name_[0] === '[') {
      // arrays have 2 elements, so we get the proper difference. then we scale here. that way we avoid
      // allocating a potentially huge array for [999999 x i8] etc.
      type.flatSize = parseInt(type.name_.substr(1)) * type.flatSize / 2
    }
    type.flatSize = Runtime.alignMemory(type.flatSize, type.alignSize)
    if (diffs.length === 0) {
      type.flatFactor = type.flatSize
    } else if (Runtime.dedup(diffs).length === 1) {
      type.flatFactor = diffs[0]
    }
    type.needsFlattening = (type.flatFactor != 1)
    return type.flatIndexes
  },
  generateStructInfo: function (struct, typeName, offset) {
    var type, alignment
    if (typeName) {
      offset = offset || 0
      type = (typeof Types === 'undefined' ? Runtime.typeInfo : Types.types)[typeName]
      if (!type) return null
      if (type.fields.length != struct.length) {
        printErr('Number of named fields must match the type for ' + typeName + ': possibly duplicate struct names. Cannot return structInfo')
        return null
      }
      alignment = type.flatIndexes
    } else {
      var type = { fields: struct.map(function (item) { return item[0] }) }
      alignment = Runtime.calculateStructAlignment(type)
    }
    const ret = {
      __size__: type.flatSize
    }
    if (typeName) {
      struct.forEach(function (item, i) {
        if (typeof item === 'string') {
          ret[item] = alignment[i] + offset
        } else {
          // embedded struct
          let key
          for (const k in item) key = k
          ret[key] = Runtime.generateStructInfo(item[key], type.fields[i], alignment[i])
        }
      })
    } else {
      struct.forEach(function (item, i) {
        ret[item[1]] = alignment[i]
      })
    }
    return ret
  },
  dynCall: function (sig, ptr, args) {
    if (args && args.length) {
      assert(args.length === sig.length - 1)
      return FUNCTION_TABLE[ptr].apply(null, args)
    } else {
      assert(sig.length === 1)
      return FUNCTION_TABLE[ptr]()
    }
  },
  addFunction: function (func) {
    const table = FUNCTION_TABLE
    const ret = table.length
    assert(ret % 2 === 0)
    table.push(func)
    for (let i = 0; i < 2 - 1; i++) table.push(0)
    return ret
  },
  removeFunction: function (index) {
    const table = FUNCTION_TABLE
    table[index] = null
  },
  getAsmConst: function (code, numArgs) {
    // code is a constant string on the heap, so we can cache these
    if (!Runtime.asmConstCache) Runtime.asmConstCache = {}
    const func = Runtime.asmConstCache[code]
    if (func) return func
    const args = []
    for (let i = 0; i < numArgs; i++) {
      args.push(String.fromCharCode(36) + i) // $0, $1 etc
    }
    code = Pointer_stringify(code)
    if (code[0] === '"') {
      // tolerate EM_ASM("..code..") even though EM_ASM(..code..) is correct
      if (code.indexOf('"', 1) === code.length - 1) {
        code = code.substr(1, code.length - 2)
      } else {
        // something invalid happened, e.g. EM_ASM("..code($0)..", input)
        abort('invalid EM_ASM input |' + code + '|. Please use EM_ASM(..code..) (no quotes) or EM_ASM({ ..code($0).. }, input) (to input values)')
      }
    }
    return Runtime.asmConstCache[code] = eval('(function(' + args.join(',') + '){ ' + code + ' })') // new Function does not allow upvars in node
  },
  warnOnce: function (text) {
    if (!Runtime.warnOnce.shown) Runtime.warnOnce.shown = {}
    if (!Runtime.warnOnce.shown[text]) {
      Runtime.warnOnce.shown[text] = 1
      Module.printErr(text)
    }
  },
  funcWrappers: {},
  getFuncWrapper: function (func, sig) {
    assert(sig)
    if (!Runtime.funcWrappers[func]) {
      Runtime.funcWrappers[func] = function dynCall_wrapper () {
        return Runtime.dynCall(sig, func, arguments)
      }
    }
    return Runtime.funcWrappers[func]
  },
  UTF8Processor: function () {
    const buffer = []
    let needed = 0
    this.processCChar = function (code) {
      code = code & 0xFF

      if (buffer.length === 0) {
        if ((code & 0x80) === 0x00) { // 0xxxxxxx
          return String.fromCharCode(code)
        }
        buffer.push(code)
        if ((code & 0xE0) === 0xC0) { // 110xxxxx
          needed = 1
        } else if ((code & 0xF0) === 0xE0) { // 1110xxxx
          needed = 2
        } else { // 11110xxx
          needed = 3
        }
        return ''
      }

      if (needed) {
        buffer.push(code)
        needed--
        if (needed > 0) return ''
      }

      const c1 = buffer[0]
      const c2 = buffer[1]
      const c3 = buffer[2]
      const c4 = buffer[3]
      let ret
      if (buffer.length === 2) {
        ret = String.fromCharCode(((c1 & 0x1F) << 6) | (c2 & 0x3F))
      } else if (buffer.length === 3) {
        ret = String.fromCharCode(((c1 & 0x0F) << 12) | ((c2 & 0x3F) << 6) | (c3 & 0x3F))
      } else {
        // http://mathiasbynens.be/notes/javascript-encoding#surrogate-formulae
        const codePoint = ((c1 & 0x07) << 18) | ((c2 & 0x3F) << 12) |
                        ((c3 & 0x3F) << 6) | (c4 & 0x3F)
        ret = String.fromCharCode(
          Math.floor((codePoint - 0x10000) / 0x400) + 0xD800,
          (codePoint - 0x10000) % 0x400 + 0xDC00)
      }
      buffer.length = 0
      return ret
    }
    this.processJSString = function processJSString (string) {
      string = unescape(encodeURIComponent(string))
      const ret = []
      for (let i = 0; i < string.length; i++) {
        ret.push(string.charCodeAt(i))
      }
      return ret
    }
  },
  stackAlloc: function (size) { const ret = STACKTOP; STACKTOP = (STACKTOP + size) | 0; STACKTOP = (((STACKTOP) + 7) & -8); (assert((STACKTOP | 0) < (STACK_MAX | 0)) | 0); return ret },
  staticAlloc: function (size) { const ret = STATICTOP; STATICTOP = (STATICTOP + (assert(!staticSealed), size)) | 0; STATICTOP = (((STATICTOP) + 7) & -8); return ret },
  dynamicAlloc: function (size) { const ret = DYNAMICTOP; DYNAMICTOP = (DYNAMICTOP + (assert(DYNAMICTOP > 0), size)) | 0; DYNAMICTOP = (((DYNAMICTOP) + 7) & -8); if (DYNAMICTOP >= TOTAL_MEMORY) enlargeMemory(); return ret },
  alignMemory: function (size, quantum) { const ret = size = Math.ceil((size) / (quantum || 8)) * (quantum || 8); return ret },
  makeBigInt: function (low, high, unsigned) { const ret = (unsigned ? ((low >>> 0) + ((high >>> 0) * 4294967296)) : ((low >>> 0) + ((high | 0) * 4294967296))); return ret },
  GLOBAL_BASE: 8,
  QUANTUM_SIZE: 4,
  __dummy__: 0
}

function alignMemoryPage (x) {
  return (x + 4095) & -4096
}

function _time (ptr) {
  const ret = Math.floor(Date.now() / 1000)
  if (ptr) {
    HEAP32[((ptr) >> 2)] = ret
  }
  return ret
}

function _sbrk (bytes) {
  // Implement a Linux-like 'memory area' for our 'process'.
  // Changes the size of the memory area by |bytes|; returns the
  // address of the previous top ('break') of the memory area
  // We control the "dynamic" memory - DYNAMIC_BASE to DYNAMICTOP
  const self = _sbrk
  if (!self.called) {
    DYNAMICTOP = alignMemoryPage(DYNAMICTOP) // make sure we start out aligned
    self.called = true
    // assert(Runtime.dynamicAlloc)
    self.alloc = Runtime.dynamicAlloc
    Runtime.dynamicAlloc = function () { abort('cannot dynamically allocate, sbrk now has control') }
  }
  const ret = DYNAMICTOP
  if (bytes !== 0) self.alloc(bytes)
  return ret // Previous break location.
}

function _sysconf (name) {
  // long sysconf(int name);
  // http://pubs.opengroup.org/onlinepubs/009695399/functions/sysconf.html
  switch (name) {
    case 30: return PAGE_SIZE
    case 132:
    case 133:
    case 12:
    case 137:
    case 138:
    case 15:
    case 235:
    case 16:
    case 17:
    case 18:
    case 19:
    case 20:
    case 149:
    case 13:
    case 10:
    case 236:
    case 153:
    case 9:
    case 21:
    case 22:
    case 159:
    case 154:
    case 14:
    case 77:
    case 78:
    case 139:
    case 80:
    case 81:
    case 79:
    case 82:
    case 68:
    case 67:
    case 164:
    case 11:
    case 29:
    case 47:
    case 48:
    case 95:
    case 52:
    case 51:
    case 46:
      return 200809
    case 27:
    case 246:
    case 127:
    case 128:
    case 23:
    case 24:
    case 160:
    case 161:
    case 181:
    case 182:
    case 242:
    case 183:
    case 184:
    case 243:
    case 244:
    case 245:
    case 165:
    case 178:
    case 179:
    case 49:
    case 50:
    case 168:
    case 169:
    case 175:
    case 170:
    case 171:
    case 172:
    case 97:
    case 76:
    case 32:
    case 173:
    case 35:
      return -1
    case 176:
    case 177:
    case 7:
    case 155:
    case 8:
    case 157:
    case 125:
    case 126:
    case 92:
    case 93:
    case 129:
    case 130:
    case 131:
    case 94:
    case 91:
      return 1
    case 74:
    case 60:
    case 69:
    case 70:
    case 4:
      return 1024
    case 31:
    case 42:
    case 72:
      return 32
    case 87:
    case 26:
    case 33:
      return 2147483647
    case 34:
    case 1:
      return 47839
    case 38:
    case 36:
      return 99
    case 43:
    case 37:
      return 2048
    case 0: return 2097152
    case 3: return 65536
    case 28: return 32768
    case 44: return 32767
    case 75: return 16384
    case 39: return 1000
    case 89: return 700
    case 71: return 256
    case 40: return 255
    case 2: return 100
    case 180: return 64
    case 25: return 20
    case 5: return 16
    case 6: return 6
    case 73: return 4
    case 84: return 1
  }
  // ___setErrNo(ERRNO_CODES.EINVAL)
  return -1
}

function _malloc ($bytes) {
  let label = 0

  label = 1
  while (1) {
    switch (label) {
      case 1:
        var $1 = ($bytes >>> 0) < 245
        if ($1) { label = 2; break } else { label = 78; break }
      case 2:
        var $3 = ($bytes >>> 0) < 11
        if ($3) { var $8 = 16; label = 4; break } else { label = 3; break }
      case 3:
        var $5 = ((($bytes) + (11)) | 0)
        var $6 = $5 & -8
        $8 = $6; label = 4; break
      case 4:
        // var $8
        var $9 = $8 >>> 3
        var $10 = HEAP32[((40) >> 2)]
        var $11 = $10 >>> ($9 >>> 0)
        var $12 = $11 & 3
        var $13 = ($12 | 0) === 0
        if ($13) { label = 12; break } else { label = 5; break }
      case 5:
        var $15 = $11 & 1
        var $16 = $15 ^ 1
        var $17 = ((($16) + ($9)) | 0)
        var $18 = $17 << 1
        var $19 = ((80 + ($18 << 2)) | 0)
        var $20 = $19
        var $_sum11 = ((($18) + (2)) | 0)
        var $21 = ((80 + ($_sum11 << 2)) | 0)
        var $22 = HEAP32[(($21) >> 2)]
        var $23 = (($22 + 8) | 0)
        var $24 = HEAP32[(($23) >> 2)]
        var $25 = ($20 | 0) === ($24 | 0)
        if ($25) { label = 6; break } else { label = 7; break }
      case 6:
        var $27 = 1 << $17
        var $28 = $27 ^ -1
        var $29 = $10 & $28
        HEAP32[((40) >> 2)] = $29
        label = 11; break
      case 7:
        var $31 = $24
        var $32 = HEAP32[((56) >> 2)]
        var $33 = ($31 >>> 0) < ($32 >>> 0)
        if ($33) { label = 10; break } else { label = 8; break }
      case 8:
        var $35 = (($24 + 12) | 0)
        var $36 = HEAP32[(($35) >> 2)]
        var $37 = ($36 | 0) === ($22 | 0)
        if ($37) { label = 9; break } else { label = 10; break }
      case 9:
        HEAP32[(($35) >> 2)] = $20
        HEAP32[(($21) >> 2)] = $24
        label = 11; break
      case 10:

        throw new Error('Reached an unreachable!')
      case 11:
        var $40 = $17 << 3
        var $41 = $40 | 3
        var $42 = (($22 + 4) | 0)
        HEAP32[(($42) >> 2)] = $41
        var $43 = $22
        var $_sum1314 = $40 | 4
        var $44 = (($43 + $_sum1314) | 0)
        var $45 = $44
        var $46 = HEAP32[(($45) >> 2)]
        var $47 = $46 | 1
        HEAP32[(($45) >> 2)] = $47
        var $48 = $23
        var $mem_0 = $48; label = 341; break
      case 12:
        var $50 = HEAP32[((48) >> 2)]
        var $51 = ($8 >>> 0) > ($50 >>> 0)
        if ($51) { label = 13; break } else { var $nb_0 = $8; label = 160; break }
      case 13:
        var $53 = ($11 | 0) === 0
        if ($53) { label = 27; break } else { label = 14; break }
      case 14:
        var $55 = $11 << $9
        var $56 = 2 << $9
        var $57 = (((-$56)) | 0)
        var $58 = $56 | $57
        var $59 = $55 & $58
        var $60 = (((-$59)) | 0)
        var $61 = $59 & $60
        var $62 = ((($61) - (1)) | 0)
        var $63 = $62 >>> 12
        var $64 = $63 & 16
        var $65 = $62 >>> ($64 >>> 0)
        var $66 = $65 >>> 5
        var $67 = $66 & 8
        var $68 = $67 | $64
        var $69 = $65 >>> ($67 >>> 0)
        var $70 = $69 >>> 2
        var $71 = $70 & 4
        var $72 = $68 | $71
        var $73 = $69 >>> ($71 >>> 0)
        var $74 = $73 >>> 1
        var $75 = $74 & 2
        var $76 = $72 | $75
        var $77 = $73 >>> ($75 >>> 0)
        var $78 = $77 >>> 1
        var $79 = $78 & 1
        var $80 = $76 | $79
        var $81 = $77 >>> ($79 >>> 0)
        var $82 = ((($80) + ($81)) | 0)
        var $83 = $82 << 1
        var $84 = ((80 + ($83 << 2)) | 0)
        var $85 = $84
        var $_sum4 = ((($83) + (2)) | 0)
        var $86 = ((80 + ($_sum4 << 2)) | 0)
        var $87 = HEAP32[(($86) >> 2)]
        var $88 = (($87 + 8) | 0)
        var $89 = HEAP32[(($88) >> 2)]
        var $90 = ($85 | 0) === ($89 | 0)
        if ($90) { label = 15; break } else { label = 16; break }
      case 15:
        var $92 = 1 << $82
        var $93 = $92 ^ -1
        var $94 = $10 & $93
        HEAP32[((40) >> 2)] = $94
        label = 20; break
      case 16:
        var $96 = $89
        var $97 = HEAP32[((56) >> 2)]
        var $98 = ($96 >>> 0) < ($97 >>> 0)
        if ($98) { label = 19; break } else { label = 17; break }
      case 17:
        var $100 = (($89 + 12) | 0)
        var $101 = HEAP32[(($100) >> 2)]
        var $102 = ($101 | 0) === ($87 | 0)
        if ($102) { label = 18; break } else { label = 19; break }
      case 18:
        HEAP32[(($100) >> 2)] = $85
        HEAP32[(($86) >> 2)] = $89
        label = 20; break
      case 19:

        throw new Error('Reached an unreachable!')
      case 20:
        var $105 = $82 << 3
        var $106 = ((($105) - ($8)) | 0)
        var $107 = $8 | 3
        var $108 = (($87 + 4) | 0)
        HEAP32[(($108) >> 2)] = $107
        var $109 = $87
        var $110 = (($109 + $8) | 0)
        var $111 = $110
        var $112 = $106 | 1
        var $_sum67 = $8 | 4
        var $113 = (($109 + $_sum67) | 0)
        var $114 = $113
        HEAP32[(($114) >> 2)] = $112
        var $115 = (($109 + $105) | 0)
        var $116 = $115
        HEAP32[(($116) >> 2)] = $106
        var $117 = HEAP32[((48) >> 2)]
        var $118 = ($117 | 0) === 0
        if ($118) { label = 26; break } else { label = 21; break }
      case 21:
        var $120 = HEAP32[((60) >> 2)]
        var $121 = $117 >>> 3
        var $122 = $121 << 1
        var $123 = ((80 + ($122 << 2)) | 0)
        var $124 = $123
        var $125 = HEAP32[((40) >> 2)]
        var $126 = 1 << $121
        var $127 = $125 & $126
        var $128 = ($127 | 0) === 0
        if ($128) { label = 22; break } else { label = 23; break }
      case 22:
        var $130 = $125 | $126
        HEAP32[((40) >> 2)] = $130
        var $_sum9_pre = ((($122) + (2)) | 0)
        var $_pre = ((80 + ($_sum9_pre << 2)) | 0)
        var $F4_0 = $124; var $_pre_phi = $_pre; label = 25; break
      case 23:
        var $_sum10 = ((($122) + (2)) | 0)
        var $132 = ((80 + ($_sum10 << 2)) | 0)
        var $133 = HEAP32[(($132) >> 2)]
        var $134 = $133
        var $135 = HEAP32[((56) >> 2)]
        var $136 = ($134 >>> 0) < ($135 >>> 0)
        if ($136) { label = 24; break } else { $F4_0 = $133; $_pre_phi = $132; label = 25; break }
      case 24:

        throw new Error('Reached an unreachable!')
      case 25:
        // var $_pre_phi
        // var $F4_0
        HEAP32[(($_pre_phi) >> 2)] = $120
        var $139 = (($F4_0 + 12) | 0)
        HEAP32[(($139) >> 2)] = $120
        var $140 = (($120 + 8) | 0)
        HEAP32[(($140) >> 2)] = $F4_0
        var $141 = (($120 + 12) | 0)
        HEAP32[(($141) >> 2)] = $124
        label = 26; break
      case 26:
        HEAP32[((48) >> 2)] = $106
        HEAP32[((60) >> 2)] = $111
        var $143 = $88
        $mem_0 = $143; label = 341; break
      case 27:
        var $145 = HEAP32[((44) >> 2)]
        var $146 = ($145 | 0) === 0
        if ($146) { $nb_0 = $8; label = 160; break } else { label = 28; break }
      case 28:
        var $148 = (((-$145)) | 0)
        var $149 = $145 & $148
        var $150 = ((($149) - (1)) | 0)
        var $151 = $150 >>> 12
        var $152 = $151 & 16
        var $153 = $150 >>> ($152 >>> 0)
        var $154 = $153 >>> 5
        var $155 = $154 & 8
        var $156 = $155 | $152
        var $157 = $153 >>> ($155 >>> 0)
        var $158 = $157 >>> 2
        var $159 = $158 & 4
        var $160 = $156 | $159
        var $161 = $157 >>> ($159 >>> 0)
        var $162 = $161 >>> 1
        var $163 = $162 & 2
        var $164 = $160 | $163
        var $165 = $161 >>> ($163 >>> 0)
        var $166 = $165 >>> 1
        var $167 = $166 & 1
        var $168 = $164 | $167
        var $169 = $165 >>> ($167 >>> 0)
        var $170 = ((($168) + ($169)) | 0)
        var $171 = ((344 + ($170 << 2)) | 0)
        var $172 = HEAP32[(($171) >> 2)]
        var $173 = (($172 + 4) | 0)
        var $174 = HEAP32[(($173) >> 2)]
        var $175 = $174 & -8
        var $176 = ((($175) - ($8)) | 0)
        var $t_0_i = $172; var $v_0_i = $172; var $rsize_0_i = $176; label = 29; break
      case 29:
        // var $rsize_0_i
        // var $v_0_i
        // var $t_0_i
        var $178 = (($t_0_i + 16) | 0)
        var $179 = HEAP32[(($178) >> 2)]
        var $180 = ($179 | 0) === 0
        if ($180) { label = 30; break } else { var $185 = $179; label = 31; break }
      case 30:
        var $182 = (($t_0_i + 20) | 0)
        var $183 = HEAP32[(($182) >> 2)]
        var $184 = ($183 | 0) === 0
        if ($184) { label = 32; break } else { $185 = $183; label = 31; break }
      case 31:
        // var $185
        var $186 = (($185 + 4) | 0)
        var $187 = HEAP32[(($186) >> 2)]
        var $188 = $187 & -8
        var $189 = ((($188) - ($8)) | 0)
        var $190 = ($189 >>> 0) < ($rsize_0_i >>> 0)
        var $_rsize_0_i = ($190 ? $189 : $rsize_0_i)
        var $_v_0_i = ($190 ? $185 : $v_0_i)
        $t_0_i = $185; $v_0_i = $_v_0_i; $rsize_0_i = $_rsize_0_i; label = 29; break
      case 32:
        var $192 = $v_0_i
        var $193 = HEAP32[((56) >> 2)]
        var $194 = ($192 >>> 0) < ($193 >>> 0)
        if ($194) { label = 76; break } else { label = 33; break }
      case 33:
        var $196 = (($192 + $8) | 0)
        var $197 = $196
        var $198 = ($192 >>> 0) < ($196 >>> 0)
        if ($198) { label = 34; break } else { label = 76; break }
      case 34:
        var $200 = (($v_0_i + 24) | 0)
        var $201 = HEAP32[(($200) >> 2)]
        var $202 = (($v_0_i + 12) | 0)
        var $203 = HEAP32[(($202) >> 2)]
        var $204 = ($203 | 0) === ($v_0_i | 0)
        if ($204) { label = 40; break } else { label = 35; break }
      case 35:
        var $206 = (($v_0_i + 8) | 0)
        var $207 = HEAP32[(($206) >> 2)]
        var $208 = $207
        var $209 = ($208 >>> 0) < ($193 >>> 0)
        if ($209) { label = 39; break } else { label = 36; break }
      case 36:
        var $211 = (($207 + 12) | 0)
        var $212 = HEAP32[(($211) >> 2)]
        var $213 = ($212 | 0) === ($v_0_i | 0)
        if ($213) { label = 37; break } else { label = 39; break }
      case 37:
        var $215 = (($203 + 8) | 0)
        var $216 = HEAP32[(($215) >> 2)]
        var $217 = ($216 | 0) === ($v_0_i | 0)
        if ($217) { label = 38; break } else { label = 39; break }
      case 38:
        HEAP32[(($211) >> 2)] = $203
        HEAP32[(($215) >> 2)] = $207
        var $R_1_i = $203; label = 47; break
      case 39:

        throw new Error('Reached an unreachable!')
      case 40:
        var $220 = (($v_0_i + 20) | 0)
        var $221 = HEAP32[(($220) >> 2)]
        var $222 = ($221 | 0) === 0
        if ($222) { label = 41; break } else { var $R_0_i = $221; var $RP_0_i = $220; label = 42; break }
      case 41:
        var $224 = (($v_0_i + 16) | 0)
        var $225 = HEAP32[(($224) >> 2)]
        var $226 = ($225 | 0) === 0
        if ($226) { $R_1_i = 0; label = 47; break } else { $R_0_i = $225; $RP_0_i = $224; label = 42; break }
      case 42:
        // var $RP_0_i
        // var $R_0_i
        var $227 = (($R_0_i + 20) | 0)
        var $228 = HEAP32[(($227) >> 2)]
        var $229 = ($228 | 0) === 0
        if ($229) { label = 43; break } else { $R_0_i = $228; $RP_0_i = $227; label = 42; break }
      case 43:
        var $231 = (($R_0_i + 16) | 0)
        var $232 = HEAP32[(($231) >> 2)]
        var $233 = ($232 | 0) === 0
        if ($233) { label = 44; break } else { $R_0_i = $232; $RP_0_i = $231; label = 42; break }
      case 44:
        var $235 = $RP_0_i
        var $236 = ($235 >>> 0) < ($193 >>> 0)
        if ($236) { label = 46; break } else { label = 45; break }
      case 45:
        HEAP32[(($RP_0_i) >> 2)] = 0
        $R_1_i = $R_0_i; label = 47; break
      case 46:

        throw new Error('Reached an unreachable!')
      case 47:
        // var $R_1_i
        var $240 = ($201 | 0) === 0
        if ($240) { label = 67; break } else { label = 48; break }
      case 48:
        var $242 = (($v_0_i + 28) | 0)
        var $243 = HEAP32[(($242) >> 2)]
        var $244 = ((344 + ($243 << 2)) | 0)
        var $245 = HEAP32[(($244) >> 2)]
        var $246 = ($v_0_i | 0) === ($245 | 0)
        if ($246) { label = 49; break } else { label = 51; break }
      case 49:
        HEAP32[(($244) >> 2)] = $R_1_i
        var $cond_i = ($R_1_i | 0) === 0
        if ($cond_i) { label = 50; break } else { label = 57; break }
      case 50:
        var $248 = HEAP32[(($242) >> 2)]
        var $249 = 1 << $248
        var $250 = $249 ^ -1
        var $251 = HEAP32[((44) >> 2)]
        var $252 = $251 & $250
        HEAP32[((44) >> 2)] = $252
        label = 67; break
      case 51:
        var $254 = $201
        var $255 = HEAP32[((56) >> 2)]
        var $256 = ($254 >>> 0) < ($255 >>> 0)
        if ($256) { label = 55; break } else { label = 52; break }
      case 52:
        var $258 = (($201 + 16) | 0)
        var $259 = HEAP32[(($258) >> 2)]
        var $260 = ($259 | 0) === ($v_0_i | 0)
        if ($260) { label = 53; break } else { label = 54; break }
      case 53:
        HEAP32[(($258) >> 2)] = $R_1_i
        label = 56; break
      case 54:
        var $263 = (($201 + 20) | 0)
        HEAP32[(($263) >> 2)] = $R_1_i
        label = 56; break
      case 55:

        throw new Error('Reached an unreachable!')
      case 56:
        var $266 = ($R_1_i | 0) === 0
        if ($266) { label = 67; break } else { label = 57; break }
      case 57:
        var $268 = $R_1_i
        var $269 = HEAP32[((56) >> 2)]
        var $270 = ($268 >>> 0) < ($269 >>> 0)
        if ($270) { label = 66; break } else { label = 58; break }
      case 58:
        var $272 = (($R_1_i + 24) | 0)
        HEAP32[(($272) >> 2)] = $201
        var $273 = (($v_0_i + 16) | 0)
        var $274 = HEAP32[(($273) >> 2)]
        var $275 = ($274 | 0) === 0
        if ($275) { label = 62; break } else { label = 59; break }
      case 59:
        var $277 = $274
        var $278 = HEAP32[((56) >> 2)]
        var $279 = ($277 >>> 0) < ($278 >>> 0)
        if ($279) { label = 61; break } else { label = 60; break }
      case 60:
        var $281 = (($R_1_i + 16) | 0)
        HEAP32[(($281) >> 2)] = $274
        var $282 = (($274 + 24) | 0)
        HEAP32[(($282) >> 2)] = $R_1_i
        label = 62; break
      case 61:

        throw new Error('Reached an unreachable!')
      case 62:
        var $285 = (($v_0_i + 20) | 0)
        var $286 = HEAP32[(($285) >> 2)]
        var $287 = ($286 | 0) === 0
        if ($287) { label = 67; break } else { label = 63; break }
      case 63:
        var $289 = $286
        var $290 = HEAP32[((56) >> 2)]
        var $291 = ($289 >>> 0) < ($290 >>> 0)
        if ($291) { label = 65; break } else { label = 64; break }
      case 64:
        var $293 = (($R_1_i + 20) | 0)
        HEAP32[(($293) >> 2)] = $286
        var $294 = (($286 + 24) | 0)
        HEAP32[(($294) >> 2)] = $R_1_i
        label = 67; break
      case 65:

        throw new Error('Reached an unreachable!')
      case 66:

        throw new Error('Reached an unreachable!')
      case 67:
        var $298 = ($rsize_0_i >>> 0) < 16
        if ($298) { label = 68; break } else { label = 69; break }
      case 68:
        var $300 = ((($rsize_0_i) + ($8)) | 0)
        var $301 = $300 | 3
        var $302 = (($v_0_i + 4) | 0)
        HEAP32[(($302) >> 2)] = $301
        var $_sum4_i = ((($300) + (4)) | 0)
        var $303 = (($192 + $_sum4_i) | 0)
        var $304 = $303
        var $305 = HEAP32[(($304) >> 2)]
        var $306 = $305 | 1
        HEAP32[(($304) >> 2)] = $306
        label = 77; break
      case 69:
        var $308 = $8 | 3
        var $309 = (($v_0_i + 4) | 0)
        HEAP32[(($309) >> 2)] = $308
        var $310 = $rsize_0_i | 1
        var $_sum_i41 = $8 | 4
        var $311 = (($192 + $_sum_i41) | 0)
        var $312 = $311
        HEAP32[(($312) >> 2)] = $310
        var $_sum1_i = ((($rsize_0_i) + ($8)) | 0)
        var $313 = (($192 + $_sum1_i) | 0)
        var $314 = $313
        HEAP32[(($314) >> 2)] = $rsize_0_i
        var $315 = HEAP32[((48) >> 2)]
        var $316 = ($315 | 0) === 0
        if ($316) { label = 75; break } else { label = 70; break }
      case 70:
        var $318 = HEAP32[((60) >> 2)]
        var $319 = $315 >>> 3
        var $320 = $319 << 1
        var $321 = ((80 + ($320 << 2)) | 0)
        var $322 = $321
        var $323 = HEAP32[((40) >> 2)]
        var $324 = 1 << $319
        var $325 = $323 & $324
        var $326 = ($325 | 0) === 0
        if ($326) { label = 71; break } else { label = 72; break }
      case 71:
        var $328 = $323 | $324
        HEAP32[((40) >> 2)] = $328
        var $_sum2_pre_i = ((($320) + (2)) | 0)
        var $_pre_i = ((80 + ($_sum2_pre_i << 2)) | 0)
        var $F1_0_i = $322; var $_pre_phi_i = $_pre_i; label = 74; break
      case 72:
        var $_sum3_i = ((($320) + (2)) | 0)
        var $330 = ((80 + ($_sum3_i << 2)) | 0)
        var $331 = HEAP32[(($330) >> 2)]
        var $332 = $331
        var $333 = HEAP32[((56) >> 2)]
        var $334 = ($332 >>> 0) < ($333 >>> 0)
        if ($334) { label = 73; break } else { $F1_0_i = $331; $_pre_phi_i = $330; label = 74; break }
      case 73:

        throw new Error('Reached an unreachable!')
      case 74:
        // var $_pre_phi_i
        // var $F1_0_i
        HEAP32[(($_pre_phi_i) >> 2)] = $318
        var $337 = (($F1_0_i + 12) | 0)
        HEAP32[(($337) >> 2)] = $318
        var $338 = (($318 + 8) | 0)
        HEAP32[(($338) >> 2)] = $F1_0_i
        var $339 = (($318 + 12) | 0)
        HEAP32[(($339) >> 2)] = $322
        label = 75; break
      case 75:
        HEAP32[((48) >> 2)] = $rsize_0_i
        HEAP32[((60) >> 2)] = $197
        label = 77; break
      case 76:

        throw new Error('Reached an unreachable!')
      case 77:
        var $342 = (($v_0_i + 8) | 0)
        var $343 = $342
        $mem_0 = $343; label = 341; break
      case 78:
        var $345 = ($bytes >>> 0) > 4294967231
        if ($345) { $nb_0 = -1; label = 160; break } else { label = 79; break }
      case 79:
        var $347 = ((($bytes) + (11)) | 0)
        var $348 = $347 & -8
        var $349 = HEAP32[((44) >> 2)]
        var $350 = ($349 | 0) === 0
        if ($350) { $nb_0 = $348; label = 160; break } else { label = 80; break }
      case 80:
        var $352 = (((-$348)) | 0)
        var $353 = $347 >>> 8
        var $354 = ($353 | 0) === 0
        if ($354) { var $idx_0_i = 0; label = 83; break } else { label = 81; break }
      case 81:
        var $356 = ($348 >>> 0) > 16777215
        if ($356) { $idx_0_i = 31; label = 83; break } else { label = 82; break }
      case 82:
        var $358 = ((($353) + (1048320)) | 0)
        var $359 = $358 >>> 16
        var $360 = $359 & 8
        var $361 = $353 << $360
        var $362 = ((($361) + (520192)) | 0)
        var $363 = $362 >>> 16
        var $364 = $363 & 4
        var $365 = $364 | $360
        var $366 = $361 << $364
        var $367 = ((($366) + (245760)) | 0)
        var $368 = $367 >>> 16
        var $369 = $368 & 2
        var $370 = $365 | $369
        var $371 = (((14) - ($370)) | 0)
        var $372 = $366 << $369
        var $373 = $372 >>> 15
        var $374 = ((($371) + ($373)) | 0)
        var $375 = $374 << 1
        var $376 = ((($374) + (7)) | 0)
        var $377 = $348 >>> ($376 >>> 0)
        var $378 = $377 & 1
        var $379 = $378 | $375
        $idx_0_i = $379; label = 83; break
      case 83:
        // var $idx_0_i
        var $381 = ((344 + ($idx_0_i << 2)) | 0)
        var $382 = HEAP32[(($381) >> 2)]
        var $383 = ($382 | 0) === 0
        if ($383) { var $v_2_i = 0; var $rsize_2_i = $352; var $t_1_i = 0; label = 90; break } else { label = 84; break }
      case 84:
        var $385 = ($idx_0_i | 0) === 31
        if ($385) { var $390 = 0; label = 86; break } else { label = 85; break }
      case 85:
        var $387 = $idx_0_i >>> 1
        var $388 = (((25) - ($387)) | 0)
        $390 = $388; label = 86; break
      case 86:
        // var $390
        var $391 = $348 << $390
        var $v_0_i18 = 0; var $rsize_0_i17 = $352; var $t_0_i16 = $382; var $sizebits_0_i = $391; var $rst_0_i = 0; label = 87; break
      case 87:
        // var $rst_0_i
        // var $sizebits_0_i
        // var $t_0_i16
        // var $rsize_0_i17
        // var $v_0_i18
        var $393 = (($t_0_i16 + 4) | 0)
        var $394 = HEAP32[(($393) >> 2)]
        var $395 = $394 & -8
        var $396 = ((($395) - ($348)) | 0)
        var $397 = ($396 >>> 0) < ($rsize_0_i17 >>> 0)
        if ($397) { label = 88; break } else { var $v_1_i = $v_0_i18; var $rsize_1_i = $rsize_0_i17; label = 89; break }
      case 88:
        var $399 = ($395 | 0) === ($348 | 0)
        if ($399) { $v_2_i = $t_0_i16; $rsize_2_i = $396; $t_1_i = $t_0_i16; label = 90; break } else { $v_1_i = $t_0_i16; $rsize_1_i = $396; label = 89; break }
      case 89:
        // var $rsize_1_i
        // var $v_1_i
        var $401 = (($t_0_i16 + 20) | 0)
        var $402 = HEAP32[(($401) >> 2)]
        var $403 = $sizebits_0_i >>> 31
        var $404 = (($t_0_i16 + 16 + ($403 << 2)) | 0)
        var $405 = HEAP32[(($404) >> 2)]
        var $406 = ($402 | 0) === 0
        var $407 = ($402 | 0) === ($405 | 0)
        var $or_cond21_i = $406 | $407
        var $rst_1_i = ($or_cond21_i ? $rst_0_i : $402)
        var $408 = ($405 | 0) === 0
        var $409 = $sizebits_0_i << 1
        if ($408) { $v_2_i = $v_1_i; $rsize_2_i = $rsize_1_i; $t_1_i = $rst_1_i; label = 90; break } else { $v_0_i18 = $v_1_i; $rsize_0_i17 = $rsize_1_i; $t_0_i16 = $405; $sizebits_0_i = $409; $rst_0_i = $rst_1_i; label = 87; break }
      case 90:
        // var $t_1_i
        // var $rsize_2_i
        // var $v_2_i
        var $410 = ($t_1_i | 0) === 0
        var $411 = ($v_2_i | 0) === 0
        var $or_cond_i = $410 & $411
        if ($or_cond_i) { label = 91; break } else { var $t_2_ph_i = $t_1_i; label = 93; break }
      case 91:
        var $413 = 2 << $idx_0_i
        var $414 = (((-$413)) | 0)
        var $415 = $413 | $414
        var $416 = $349 & $415
        var $417 = ($416 | 0) === 0
        if ($417) { $nb_0 = $348; label = 160; break } else { label = 92; break }
      case 92:
        var $419 = (((-$416)) | 0)
        var $420 = $416 & $419
        var $421 = ((($420) - (1)) | 0)
        var $422 = $421 >>> 12
        var $423 = $422 & 16
        var $424 = $421 >>> ($423 >>> 0)
        var $425 = $424 >>> 5
        var $426 = $425 & 8
        var $427 = $426 | $423
        var $428 = $424 >>> ($426 >>> 0)
        var $429 = $428 >>> 2
        var $430 = $429 & 4
        var $431 = $427 | $430
        var $432 = $428 >>> ($430 >>> 0)
        var $433 = $432 >>> 1
        var $434 = $433 & 2
        var $435 = $431 | $434
        var $436 = $432 >>> ($434 >>> 0)
        var $437 = $436 >>> 1
        var $438 = $437 & 1
        var $439 = $435 | $438
        var $440 = $436 >>> ($438 >>> 0)
        var $441 = ((($439) + ($440)) | 0)
        var $442 = ((344 + ($441 << 2)) | 0)
        var $443 = HEAP32[(($442) >> 2)]
        $t_2_ph_i = $443; label = 93; break
      case 93:
        // var $t_2_ph_i
        var $444 = ($t_2_ph_i | 0) === 0
        if ($444) { var $rsize_3_lcssa_i = $rsize_2_i; var $v_3_lcssa_i = $v_2_i; label = 96; break } else { var $t_232_i = $t_2_ph_i; var $rsize_333_i = $rsize_2_i; var $v_334_i = $v_2_i; label = 94; break }
      case 94:
        // var $v_334_i
        // var $rsize_333_i
        // var $t_232_i
        var $445 = (($t_232_i + 4) | 0)
        var $446 = HEAP32[(($445) >> 2)]
        var $447 = $446 & -8
        var $448 = ((($447) - ($348)) | 0)
        var $449 = ($448 >>> 0) < ($rsize_333_i >>> 0)
        var $_rsize_3_i = ($449 ? $448 : $rsize_333_i)
        var $t_2_v_3_i = ($449 ? $t_232_i : $v_334_i)
        var $450 = (($t_232_i + 16) | 0)
        var $451 = HEAP32[(($450) >> 2)]
        var $452 = ($451 | 0) === 0
        if ($452) { label = 95; break } else { $t_232_i = $451; $rsize_333_i = $_rsize_3_i; $v_334_i = $t_2_v_3_i; label = 94; break }
      case 95:
        var $453 = (($t_232_i + 20) | 0)
        var $454 = HEAP32[(($453) >> 2)]
        var $455 = ($454 | 0) === 0
        if ($455) { $rsize_3_lcssa_i = $_rsize_3_i; $v_3_lcssa_i = $t_2_v_3_i; label = 96; break } else { $t_232_i = $454; $rsize_333_i = $_rsize_3_i; $v_334_i = $t_2_v_3_i; label = 94; break }
      case 96:
        // var $v_3_lcssa_i
        // var $rsize_3_lcssa_i
        var $456 = ($v_3_lcssa_i | 0) === 0
        if ($456) { $nb_0 = $348; label = 160; break } else { label = 97; break }
      case 97:
        var $458 = HEAP32[((48) >> 2)]
        var $459 = ((($458) - ($348)) | 0)
        var $460 = ($rsize_3_lcssa_i >>> 0) < ($459 >>> 0)
        if ($460) { label = 98; break } else { $nb_0 = $348; label = 160; break }
      case 98:
        var $462 = $v_3_lcssa_i
        var $463 = HEAP32[((56) >> 2)]
        var $464 = ($462 >>> 0) < ($463 >>> 0)
        if ($464) { label = 158; break } else { label = 99; break }
      case 99:
        var $466 = (($462 + $348) | 0)
        var $467 = $466
        var $468 = ($462 >>> 0) < ($466 >>> 0)
        if ($468) { label = 100; break } else { label = 158; break }
      case 100:
        var $470 = (($v_3_lcssa_i + 24) | 0)
        var $471 = HEAP32[(($470) >> 2)]
        var $472 = (($v_3_lcssa_i + 12) | 0)
        var $473 = HEAP32[(($472) >> 2)]
        var $474 = ($473 | 0) === ($v_3_lcssa_i | 0)
        if ($474) { label = 106; break } else { label = 101; break }
      case 101:
        var $476 = (($v_3_lcssa_i + 8) | 0)
        var $477 = HEAP32[(($476) >> 2)]
        var $478 = $477
        var $479 = ($478 >>> 0) < ($463 >>> 0)
        if ($479) { label = 105; break } else { label = 102; break }
      case 102:
        var $481 = (($477 + 12) | 0)
        var $482 = HEAP32[(($481) >> 2)]
        var $483 = ($482 | 0) === ($v_3_lcssa_i | 0)
        if ($483) { label = 103; break } else { label = 105; break }
      case 103:
        var $485 = (($473 + 8) | 0)
        var $486 = HEAP32[(($485) >> 2)]
        var $487 = ($486 | 0) === ($v_3_lcssa_i | 0)
        if ($487) { label = 104; break } else { label = 105; break }
      case 104:
        HEAP32[(($481) >> 2)] = $473
        HEAP32[(($485) >> 2)] = $477
        var $R_1_i22 = $473; label = 113; break
      case 105:

        throw new Error('Reached an unreachable!')
      case 106:
        var $490 = (($v_3_lcssa_i + 20) | 0)
        var $491 = HEAP32[(($490) >> 2)]
        var $492 = ($491 | 0) === 0
        if ($492) { label = 107; break } else { var $R_0_i20 = $491; var $RP_0_i19 = $490; label = 108; break }
      case 107:
        var $494 = (($v_3_lcssa_i + 16) | 0)
        var $495 = HEAP32[(($494) >> 2)]
        var $496 = ($495 | 0) === 0
        if ($496) { $R_1_i22 = 0; label = 113; break } else { $R_0_i20 = $495; $RP_0_i19 = $494; label = 108; break }
      case 108:
        // var $RP_0_i19
        // var $R_0_i20
        var $497 = (($R_0_i20 + 20) | 0)
        var $498 = HEAP32[(($497) >> 2)]
        var $499 = ($498 | 0) === 0
        if ($499) { label = 109; break } else { $R_0_i20 = $498; $RP_0_i19 = $497; label = 108; break }
      case 109:
        var $501 = (($R_0_i20 + 16) | 0)
        var $502 = HEAP32[(($501) >> 2)]
        var $503 = ($502 | 0) === 0
        if ($503) { label = 110; break } else { $R_0_i20 = $502; $RP_0_i19 = $501; label = 108; break }
      case 110:
        var $505 = $RP_0_i19
        var $506 = ($505 >>> 0) < ($463 >>> 0)
        if ($506) { label = 112; break } else { label = 111; break }
      case 111:
        HEAP32[(($RP_0_i19) >> 2)] = 0
        $R_1_i22 = $R_0_i20; label = 113; break
      case 112:

        throw new Error('Reached an unreachable!')
      case 113:
        // var $R_1_i22
        var $510 = ($471 | 0) === 0
        if ($510) { label = 133; break } else { label = 114; break }
      case 114:
        var $512 = (($v_3_lcssa_i + 28) | 0)
        var $513 = HEAP32[(($512) >> 2)]
        var $514 = ((344 + ($513 << 2)) | 0)
        var $515 = HEAP32[(($514) >> 2)]
        var $516 = ($v_3_lcssa_i | 0) === ($515 | 0)
        if ($516) { label = 115; break } else { label = 117; break }
      case 115:
        HEAP32[(($514) >> 2)] = $R_1_i22
        var $cond_i23 = ($R_1_i22 | 0) === 0
        if ($cond_i23) { label = 116; break } else { label = 123; break }
      case 116:
        var $518 = HEAP32[(($512) >> 2)]
        var $519 = 1 << $518
        var $520 = $519 ^ -1
        var $521 = HEAP32[((44) >> 2)]
        var $522 = $521 & $520
        HEAP32[((44) >> 2)] = $522
        label = 133; break
      case 117:
        var $524 = $471
        var $525 = HEAP32[((56) >> 2)]
        var $526 = ($524 >>> 0) < ($525 >>> 0)
        if ($526) { label = 121; break } else { label = 118; break }
      case 118:
        var $528 = (($471 + 16) | 0)
        var $529 = HEAP32[(($528) >> 2)]
        var $530 = ($529 | 0) === ($v_3_lcssa_i | 0)
        if ($530) { label = 119; break } else { label = 120; break }
      case 119:
        HEAP32[(($528) >> 2)] = $R_1_i22
        label = 122; break
      case 120:
        var $533 = (($471 + 20) | 0)
        HEAP32[(($533) >> 2)] = $R_1_i22
        label = 122; break
      case 121:

        throw new Error('Reached an unreachable!')
      case 122:
        var $536 = ($R_1_i22 | 0) === 0
        if ($536) { label = 133; break } else { label = 123; break }
      case 123:
        var $538 = $R_1_i22
        var $539 = HEAP32[((56) >> 2)]
        var $540 = ($538 >>> 0) < ($539 >>> 0)
        if ($540) { label = 132; break } else { label = 124; break }
      case 124:
        var $542 = (($R_1_i22 + 24) | 0)
        HEAP32[(($542) >> 2)] = $471
        var $543 = (($v_3_lcssa_i + 16) | 0)
        var $544 = HEAP32[(($543) >> 2)]
        var $545 = ($544 | 0) === 0
        if ($545) { label = 128; break } else { label = 125; break }
      case 125:
        var $547 = $544
        var $548 = HEAP32[((56) >> 2)]
        var $549 = ($547 >>> 0) < ($548 >>> 0)
        if ($549) { label = 127; break } else { label = 126; break }
      case 126:
        var $551 = (($R_1_i22 + 16) | 0)
        HEAP32[(($551) >> 2)] = $544
        var $552 = (($544 + 24) | 0)
        HEAP32[(($552) >> 2)] = $R_1_i22
        label = 128; break
      case 127:

        throw new Error('Reached an unreachable!')
      case 128:
        var $555 = (($v_3_lcssa_i + 20) | 0)
        var $556 = HEAP32[(($555) >> 2)]
        var $557 = ($556 | 0) === 0
        if ($557) { label = 133; break } else { label = 129; break }
      case 129:
        var $559 = $556
        var $560 = HEAP32[((56) >> 2)]
        var $561 = ($559 >>> 0) < ($560 >>> 0)
        if ($561) { label = 131; break } else { label = 130; break }
      case 130:
        var $563 = (($R_1_i22 + 20) | 0)
        HEAP32[(($563) >> 2)] = $556
        var $564 = (($556 + 24) | 0)
        HEAP32[(($564) >> 2)] = $R_1_i22
        label = 133; break
      case 131:

        throw new Error('Reached an unreachable!')
      case 132:

        throw new Error('Reached an unreachable!')
      case 133:
        var $568 = ($rsize_3_lcssa_i >>> 0) < 16
        if ($568) { label = 134; break } else { label = 135; break }
      case 134:
        var $570 = ((($rsize_3_lcssa_i) + ($348)) | 0)
        var $571 = $570 | 3
        var $572 = (($v_3_lcssa_i + 4) | 0)
        HEAP32[(($572) >> 2)] = $571
        var $_sum19_i = ((($570) + (4)) | 0)
        var $573 = (($462 + $_sum19_i) | 0)
        var $574 = $573
        var $575 = HEAP32[(($574) >> 2)]
        var $576 = $575 | 1
        HEAP32[(($574) >> 2)] = $576
        label = 159; break
      case 135:
        var $578 = $348 | 3
        var $579 = (($v_3_lcssa_i + 4) | 0)
        HEAP32[(($579) >> 2)] = $578
        var $580 = $rsize_3_lcssa_i | 1
        var $_sum_i2540 = $348 | 4
        var $581 = (($462 + $_sum_i2540) | 0)
        var $582 = $581
        HEAP32[(($582) >> 2)] = $580
        var $_sum1_i26 = ((($rsize_3_lcssa_i) + ($348)) | 0)
        var $583 = (($462 + $_sum1_i26) | 0)
        var $584 = $583
        HEAP32[(($584) >> 2)] = $rsize_3_lcssa_i
        var $585 = $rsize_3_lcssa_i >>> 3
        var $586 = ($rsize_3_lcssa_i >>> 0) < 256
        if ($586) { label = 136; break } else { label = 141; break }
      case 136:
        var $588 = $585 << 1
        var $589 = ((80 + ($588 << 2)) | 0)
        var $590 = $589
        var $591 = HEAP32[((40) >> 2)]
        var $592 = 1 << $585
        var $593 = $591 & $592
        var $594 = ($593 | 0) === 0
        if ($594) { label = 137; break } else { label = 138; break }
      case 137:
        var $596 = $591 | $592
        HEAP32[((40) >> 2)] = $596
        var $_sum15_pre_i = ((($588) + (2)) | 0)
        var $_pre_i27 = ((80 + ($_sum15_pre_i << 2)) | 0)
        var $F5_0_i = $590; var $_pre_phi_i28 = $_pre_i27; label = 140; break
      case 138:
        var $_sum18_i = ((($588) + (2)) | 0)
        var $598 = ((80 + ($_sum18_i << 2)) | 0)
        var $599 = HEAP32[(($598) >> 2)]
        var $600 = $599
        var $601 = HEAP32[((56) >> 2)]
        var $602 = ($600 >>> 0) < ($601 >>> 0)
        if ($602) { label = 139; break } else { $F5_0_i = $599; $_pre_phi_i28 = $598; label = 140; break }
      case 139:

        throw new Error('Reached an unreachable!')
      case 140:
        // var $_pre_phi_i28
        // var $F5_0_i
        HEAP32[(($_pre_phi_i28) >> 2)] = $467
        var $605 = (($F5_0_i + 12) | 0)
        HEAP32[(($605) >> 2)] = $467
        var $_sum16_i = ((($348) + (8)) | 0)
        var $606 = (($462 + $_sum16_i) | 0)
        var $607 = $606
        HEAP32[(($607) >> 2)] = $F5_0_i
        var $_sum17_i = ((($348) + (12)) | 0)
        var $608 = (($462 + $_sum17_i) | 0)
        var $609 = $608
        HEAP32[(($609) >> 2)] = $590
        label = 159; break
      case 141:
        var $611 = $466
        var $612 = $rsize_3_lcssa_i >>> 8
        var $613 = ($612 | 0) === 0
        if ($613) { var $I7_0_i = 0; label = 144; break } else { label = 142; break }
      case 142:
        var $615 = ($rsize_3_lcssa_i >>> 0) > 16777215
        if ($615) { $I7_0_i = 31; label = 144; break } else { label = 143; break }
      case 143:
        var $617 = ((($612) + (1048320)) | 0)
        var $618 = $617 >>> 16
        var $619 = $618 & 8
        var $620 = $612 << $619
        var $621 = ((($620) + (520192)) | 0)
        var $622 = $621 >>> 16
        var $623 = $622 & 4
        var $624 = $623 | $619
        var $625 = $620 << $623
        var $626 = ((($625) + (245760)) | 0)
        var $627 = $626 >>> 16
        var $628 = $627 & 2
        var $629 = $624 | $628
        var $630 = (((14) - ($629)) | 0)
        var $631 = $625 << $628
        var $632 = $631 >>> 15
        var $633 = ((($630) + ($632)) | 0)
        var $634 = $633 << 1
        var $635 = ((($633) + (7)) | 0)
        var $636 = $rsize_3_lcssa_i >>> ($635 >>> 0)
        var $637 = $636 & 1
        var $638 = $637 | $634
        $I7_0_i = $638; label = 144; break
      case 144:
        // var $I7_0_i
        var $640 = ((344 + ($I7_0_i << 2)) | 0)
        var $_sum2_i = ((($348) + (28)) | 0)
        var $641 = (($462 + $_sum2_i) | 0)
        var $642 = $641
        HEAP32[(($642) >> 2)] = $I7_0_i
        var $_sum3_i29 = ((($348) + (16)) | 0)
        var $643 = (($462 + $_sum3_i29) | 0)
        var $_sum4_i30 = ((($348) + (20)) | 0)
        var $644 = (($462 + $_sum4_i30) | 0)
        var $645 = $644
        HEAP32[(($645) >> 2)] = 0
        var $646 = $643
        HEAP32[(($646) >> 2)] = 0
        var $647 = HEAP32[((44) >> 2)]
        var $648 = 1 << $I7_0_i
        var $649 = $647 & $648
        var $650 = ($649 | 0) === 0
        if ($650) { label = 145; break } else { label = 146; break }
      case 145:
        var $652 = $647 | $648
        HEAP32[((44) >> 2)] = $652
        HEAP32[(($640) >> 2)] = $611
        var $653 = $640
        var $_sum5_i = ((($348) + (24)) | 0)
        var $654 = (($462 + $_sum5_i) | 0)
        var $655 = $654
        HEAP32[(($655) >> 2)] = $653
        var $_sum6_i = ((($348) + (12)) | 0)
        var $656 = (($462 + $_sum6_i) | 0)
        var $657 = $656
        HEAP32[(($657) >> 2)] = $611
        var $_sum7_i = ((($348) + (8)) | 0)
        var $658 = (($462 + $_sum7_i) | 0)
        var $659 = $658
        HEAP32[(($659) >> 2)] = $611
        label = 159; break
      case 146:
        var $661 = HEAP32[(($640) >> 2)]
        var $662 = ($I7_0_i | 0) === 31
        if ($662) { var $667 = 0; label = 148; break } else { label = 147; break }
      case 147:
        var $664 = $I7_0_i >>> 1
        var $665 = (((25) - ($664)) | 0)
        $667 = $665; label = 148; break
      case 148:
        // var $667
        var $668 = (($661 + 4) | 0)
        var $669 = HEAP32[(($668) >> 2)]
        var $670 = $669 & -8
        var $671 = ($670 | 0) === ($rsize_3_lcssa_i | 0)
        if ($671) { var $T_0_lcssa_i = $661; label = 155; break } else { label = 149; break }
      case 149:
        var $672 = $rsize_3_lcssa_i << $667
        var $T_028_i = $661; var $K12_029_i = $672; label = 151; break
      case 150:
        var $682 = 0
        var $674 = $K12_029_i << 1
        var $675 = (($682 + 4) | 0)
        var $676 = HEAP32[(($675) >> 2)]
        var $677 = $676 & -8
        var $678 = ($677 | 0) === ($rsize_3_lcssa_i | 0)
        if ($678) { $T_0_lcssa_i = $682; label = 155; break } else { $T_028_i = $682; $K12_029_i = $674; label = 151; break }
      case 151:
        // var $K12_029_i
        // var $T_028_i
        var $680 = $K12_029_i >>> 31
        var $681 = (($T_028_i + 16 + ($680 << 2)) | 0)
        $682 = HEAP32[(($681) >> 2)]
        var $683 = ($682 | 0) === 0
        if ($683) { label = 152; break } else { label = 150; break }
      case 152:
        var $685 = $681
        var $686 = HEAP32[((56) >> 2)]
        var $687 = ($685 >>> 0) < ($686 >>> 0)
        if ($687) { label = 154; break } else { label = 153; break }
      case 153:
        HEAP32[(($681) >> 2)] = $611
        var $_sum12_i = ((($348) + (24)) | 0)
        var $689 = (($462 + $_sum12_i) | 0)
        var $690 = $689
        HEAP32[(($690) >> 2)] = $T_028_i
        var $_sum13_i = ((($348) + (12)) | 0)
        var $691 = (($462 + $_sum13_i) | 0)
        var $692 = $691
        HEAP32[(($692) >> 2)] = $611
        var $_sum14_i = ((($348) + (8)) | 0)
        var $693 = (($462 + $_sum14_i) | 0)
        var $694 = $693
        HEAP32[(($694) >> 2)] = $611
        label = 159; break
      case 154:

        throw new Error('Reached an unreachable!')
      case 155:
        // var $T_0_lcssa_i
        var $696 = (($T_0_lcssa_i + 8) | 0)
        var $697 = HEAP32[(($696) >> 2)]
        var $698 = $T_0_lcssa_i
        var $699 = HEAP32[((56) >> 2)]
        var $700 = ($698 >>> 0) >= ($699 >>> 0)
        var $701 = $697
        var $702 = ($701 >>> 0) >= ($699 >>> 0)
        var $or_cond26_i = $700 & $702
        if ($or_cond26_i) { label = 156; break } else { label = 157; break }
      case 156:
        var $704 = (($697 + 12) | 0)
        HEAP32[(($704) >> 2)] = $611
        HEAP32[(($696) >> 2)] = $611
        var $_sum9_i = ((($348) + (8)) | 0)
        var $705 = (($462 + $_sum9_i) | 0)
        var $706 = $705
        HEAP32[(($706) >> 2)] = $697
        var $_sum10_i = ((($348) + (12)) | 0)
        var $707 = (($462 + $_sum10_i) | 0)
        var $708 = $707
        HEAP32[(($708) >> 2)] = $T_0_lcssa_i
        var $_sum11_i = ((($348) + (24)) | 0)
        var $709 = (($462 + $_sum11_i) | 0)
        var $710 = $709
        HEAP32[(($710) >> 2)] = 0
        label = 159; break
      case 157:

        throw new Error('Reached an unreachable!')
      case 158:

        throw new Error('Reached an unreachable!')
      case 159:
        var $712 = (($v_3_lcssa_i + 8) | 0)
        var $713 = $712
        $mem_0 = $713; label = 341; break
      case 160:
        // var $nb_0
        var $714 = HEAP32[((48) >> 2)]
        var $715 = ($714 >>> 0) < ($nb_0 >>> 0)
        if ($715) { label = 165; break } else { label = 161; break }
      case 161:
        var $717 = ((($714) - ($nb_0)) | 0)
        var $718 = HEAP32[((60) >> 2)]
        var $719 = ($717 >>> 0) > 15
        if ($719) { label = 162; break } else { label = 163; break }
      case 162:
        var $721 = $718
        var $722 = (($721 + $nb_0) | 0)
        var $723 = $722
        HEAP32[((60) >> 2)] = $723
        HEAP32[((48) >> 2)] = $717
        var $724 = $717 | 1
        var $_sum2 = ((($nb_0) + (4)) | 0)
        var $725 = (($721 + $_sum2) | 0)
        var $726 = $725
        HEAP32[(($726) >> 2)] = $724
        var $727 = (($721 + $714) | 0)
        var $728 = $727
        HEAP32[(($728) >> 2)] = $717
        var $729 = $nb_0 | 3
        var $730 = (($718 + 4) | 0)
        HEAP32[(($730) >> 2)] = $729
        label = 164; break
      case 163:
        HEAP32[((48) >> 2)] = 0
        HEAP32[((60) >> 2)] = 0
        var $732 = $714 | 3
        var $733 = (($718 + 4) | 0)
        HEAP32[(($733) >> 2)] = $732
        var $734 = $718
        var $_sum1 = ((($714) + (4)) | 0)
        var $735 = (($734 + $_sum1) | 0)
        var $736 = $735
        var $737 = HEAP32[(($736) >> 2)]
        var $738 = $737 | 1
        HEAP32[(($736) >> 2)] = $738
        label = 164; break
      case 164:
        var $740 = (($718 + 8) | 0)
        var $741 = $740
        $mem_0 = $741; label = 341; break
      case 165:
        var $743 = HEAP32[((52) >> 2)]
        var $744 = ($743 >>> 0) > ($nb_0 >>> 0)
        if ($744) { label = 166; break } else { label = 167; break }
      case 166:
        var $746 = ((($743) - ($nb_0)) | 0)
        HEAP32[((52) >> 2)] = $746
        var $747 = HEAP32[((64) >> 2)]
        var $748 = $747
        var $749 = (($748 + $nb_0) | 0)
        var $750 = $749
        HEAP32[((64) >> 2)] = $750
        var $751 = $746 | 1
        var $_sum = ((($nb_0) + (4)) | 0)
        var $752 = (($748 + $_sum) | 0)
        var $753 = $752
        HEAP32[(($753) >> 2)] = $751
        var $754 = $nb_0 | 3
        var $755 = (($747 + 4) | 0)
        HEAP32[(($755) >> 2)] = $754
        var $756 = (($747 + 8) | 0)
        var $757 = $756
        $mem_0 = $757; label = 341; break
      case 167:
        var $759 = HEAP32[((16) >> 2)]
        var $760 = ($759 | 0) === 0
        if ($760) { label = 168; break } else { label = 171; break }
      case 168:
        var $762 = _sysconf(30)
        var $763 = ((($762) - (1)) | 0)
        var $764 = $763 & $762
        var $765 = ($764 | 0) === 0
        if ($765) { label = 170; break } else { label = 169; break }
      case 169:

        throw new Error('Reached an unreachable!')
      case 170:
        HEAP32[((24) >> 2)] = $762
        HEAP32[((20) >> 2)] = $762
        HEAP32[((28) >> 2)] = -1
        HEAP32[((32) >> 2)] = -1
        HEAP32[((36) >> 2)] = 0
        HEAP32[((484) >> 2)] = 0
        var $767 = _time(0)
        var $768 = $767 & -16
        var $769 = $768 ^ 1431655768
        HEAP32[((16) >> 2)] = $769
        label = 171; break
      case 171:
        var $771 = ((($nb_0) + (48)) | 0)
        var $772 = HEAP32[((24) >> 2)]
        var $773 = ((($nb_0) + (47)) | 0)
        var $774 = ((($772) + ($773)) | 0)
        var $775 = (((-$772)) | 0)
        var $776 = $774 & $775
        var $777 = ($776 >>> 0) > ($nb_0 >>> 0)
        if ($777) { label = 172; break } else { $mem_0 = 0; label = 341; break }
      case 172:
        var $779 = HEAP32[((480) >> 2)]
        var $780 = ($779 | 0) === 0
        if ($780) { label = 174; break } else { label = 173; break }
      case 173:
        var $782 = HEAP32[((472) >> 2)]
        var $783 = ((($782) + ($776)) | 0)
        var $784 = ($783 >>> 0) <= ($782 >>> 0)
        var $785 = ($783 >>> 0) > ($779 >>> 0)
        var $or_cond1_i = $784 | $785
        if ($or_cond1_i) { $mem_0 = 0; label = 341; break } else { label = 174; break }
      case 174:
        var $787 = HEAP32[((484) >> 2)]
        var $788 = $787 & 4
        var $789 = ($788 | 0) === 0
        if ($789) { label = 175; break } else { var $tsize_1_i = 0; label = 198; break }
      case 175:
        var $791 = HEAP32[((64) >> 2)]
        var $792 = ($791 | 0) === 0
        if ($792) { label = 181; break } else { label = 176; break }
      case 176:
        var $794 = $791
        var $sp_0_i_i = 488; label = 177; break
      case 177:
        // var $sp_0_i_i
        var $796 = (($sp_0_i_i) | 0)
        var $797 = HEAP32[(($796) >> 2)]
        var $798 = ($797 >>> 0) > ($794 >>> 0)
        if ($798) { label = 179; break } else { label = 178; break }
      case 178:
        var $800 = (($sp_0_i_i + 4) | 0)
        var $801 = HEAP32[(($800) >> 2)]
        var $802 = (($797 + $801) | 0)
        var $803 = ($802 >>> 0) > ($794 >>> 0)
        if ($803) { label = 180; break } else { label = 179; break }
      case 179:
        var $805 = (($sp_0_i_i + 8) | 0)
        var $806 = HEAP32[(($805) >> 2)]
        var $807 = ($806 | 0) === 0
        if ($807) { label = 181; break } else { $sp_0_i_i = $806; label = 177; break }
      case 180:
        var $808 = ($sp_0_i_i | 0) === 0
        if ($808) { label = 181; break } else { label = 188; break }
      case 181:
        var $809 = _sbrk(0)
        var $810 = ($809 | 0) === -1
        if ($810) { var $tsize_03141_i = 0; label = 197; break } else { label = 182; break }
      case 182:
        var $812 = $809
        var $813 = HEAP32[((20) >> 2)]
        var $814 = ((($813) - (1)) | 0)
        var $815 = $814 & $812
        var $816 = ($815 | 0) === 0
        if ($816) { var $ssize_0_i = $776; label = 184; break } else { label = 183; break }
      case 183:
        var $818 = ((($814) + ($812)) | 0)
        var $819 = (((-$813)) | 0)
        var $820 = $818 & $819
        var $821 = ((($776) - ($812)) | 0)
        var $822 = ((($821) + ($820)) | 0)
        var $ssize_0_i = $822; label = 184; break
      case 184:
        var $ssize_0_i
        var $824 = HEAP32[((472) >> 2)]
        var $825 = ((($824) + ($ssize_0_i)) | 0)
        var $826 = ($ssize_0_i >>> 0) > ($nb_0 >>> 0)
        var $827 = ($ssize_0_i >>> 0) < 2147483647
        var $or_cond_i31 = $826 & $827
        if ($or_cond_i31) { label = 185; break } else { var $tsize_03141_i = 0; label = 197; break }
      case 185:
        var $829 = HEAP32[((480) >> 2)]
        var $830 = ($829 | 0) === 0
        if ($830) { label = 187; break } else { label = 186; break }
      case 186:
        var $832 = ($825 >>> 0) <= ($824 >>> 0)
        var $833 = ($825 >>> 0) > ($829 >>> 0)
        var $or_cond2_i = $832 | $833
        if ($or_cond2_i) { var $tsize_03141_i = 0; label = 197; break } else { label = 187; break }
      case 187:
        var $835 = _sbrk($ssize_0_i)
        var $836 = ($835 | 0) === ($809 | 0)
        if ($836) { var $br_0_i = $809; var $ssize_1_i = $ssize_0_i; label = 190; break } else { var $ssize_129_i = $ssize_0_i; var $br_030_i = $835; label = 191; break }
      case 188:
        var $838 = HEAP32[((52) >> 2)]
        var $839 = ((($774) - ($838)) | 0)
        var $840 = $839 & $775
        var $841 = ($840 >>> 0) < 2147483647
        if ($841) { label = 189; break } else { var $tsize_03141_i = 0; label = 197; break }
      case 189:
        var $843 = _sbrk($840)
        var $844 = HEAP32[(($796) >> 2)]
        var $845 = HEAP32[(($800) >> 2)]
        var $846 = (($844 + $845) | 0)
        var $847 = ($843 | 0) === ($846 | 0)
        if ($847) { var $br_0_i = $843; var $ssize_1_i = $840; label = 190; break } else { var $ssize_129_i = $840; var $br_030_i = $843; label = 191; break }
      case 190:
        var $ssize_1_i
        var $br_0_i
        var $849 = ($br_0_i | 0) === -1
        if ($849) { var $tsize_03141_i = $ssize_1_i; label = 197; break } else { var $tsize_244_i = $ssize_1_i; var $tbase_245_i = $br_0_i; label = 201; break }
      case 191:
        var $br_030_i
        var $ssize_129_i
        var $850 = (((-$ssize_129_i)) | 0)
        var $851 = ($br_030_i | 0) != -1
        var $852 = ($ssize_129_i >>> 0) < 2147483647
        var $or_cond5_i = $851 & $852
        var $853 = ($771 >>> 0) > ($ssize_129_i >>> 0)
        var $or_cond4_i = $or_cond5_i & $853
        if ($or_cond4_i) { label = 192; break } else { var $ssize_2_i = $ssize_129_i; label = 196; break }
      case 192:
        var $855 = HEAP32[((24) >> 2)]
        var $856 = ((($773) - ($ssize_129_i)) | 0)
        var $857 = ((($856) + ($855)) | 0)
        var $858 = (((-$855)) | 0)
        var $859 = $857 & $858
        var $860 = ($859 >>> 0) < 2147483647
        if ($860) { label = 193; break } else { var $ssize_2_i = $ssize_129_i; label = 196; break }
      case 193:
        var $862 = _sbrk($859)
        var $863 = ($862 | 0) === -1
        if ($863) { label = 195; break } else { label = 194; break }
      case 194:
        var $865 = ((($859) + ($ssize_129_i)) | 0)
        var $ssize_2_i = $865; label = 196; break
      case 195:
        var $866 = _sbrk($850)
        var $tsize_03141_i = 0; label = 197; break
      case 196:
        var $ssize_2_i
        var $868 = ($br_030_i | 0) === -1
        if ($868) { var $tsize_03141_i = 0; label = 197; break } else { var $tsize_244_i = $ssize_2_i; var $tbase_245_i = $br_030_i; label = 201; break }
      case 197:
        var $tsize_03141_i
        var $869 = HEAP32[((484) >> 2)]
        var $870 = $869 | 4
        HEAP32[((484) >> 2)] = $870
        var $tsize_1_i = $tsize_03141_i; label = 198; break
      case 198:
        var $tsize_1_i
        var $872 = ($776 >>> 0) < 2147483647
        if ($872) { label = 199; break } else { label = 340; break }
      case 199:
        var $874 = _sbrk($776)
        var $875 = _sbrk(0)
        var $876 = ($874 | 0) != -1
        var $877 = ($875 | 0) != -1
        var $or_cond3_i = $876 & $877
        var $878 = ($874 >>> 0) < ($875 >>> 0)
        var $or_cond6_i = $or_cond3_i & $878
        if ($or_cond6_i) { label = 200; break } else { label = 340; break }
      case 200:
        var $880 = $875
        var $881 = $874
        var $882 = ((($880) - ($881)) | 0)
        var $883 = ((($nb_0) + (40)) | 0)
        var $884 = ($882 >>> 0) > ($883 >>> 0)
        var $_tsize_1_i = ($884 ? $882 : $tsize_1_i)
        if ($884) { var $tsize_244_i = $_tsize_1_i; var $tbase_245_i = $874; label = 201; break } else { label = 340; break }
      case 201:
        var $tbase_245_i
        var $tsize_244_i
        var $885 = HEAP32[((472) >> 2)]
        var $886 = ((($885) + ($tsize_244_i)) | 0)
        HEAP32[((472) >> 2)] = $886
        var $887 = HEAP32[((476) >> 2)]
        var $888 = ($886 >>> 0) > ($887 >>> 0)
        if ($888) { label = 202; break } else { label = 203; break }
      case 202:
        HEAP32[((476) >> 2)] = $886
        label = 203; break
      case 203:
        var $891 = HEAP32[((64) >> 2)]
        var $892 = ($891 | 0) === 0
        if ($892) { label = 204; break } else { var $sp_073_i = 488; label = 211; break }
      case 204:
        var $894 = HEAP32[((56) >> 2)]
        var $895 = ($894 | 0) === 0
        var $896 = ($tbase_245_i >>> 0) < ($894 >>> 0)
        var $or_cond8_i = $895 | $896
        if ($or_cond8_i) { label = 205; break } else { label = 206; break }
      case 205:
        HEAP32[((56) >> 2)] = $tbase_245_i
        label = 206; break
      case 206:
        HEAP32[((488) >> 2)] = $tbase_245_i
        HEAP32[((492) >> 2)] = $tsize_244_i
        HEAP32[((500) >> 2)] = 0
        var $899 = HEAP32[((16) >> 2)]
        HEAP32[((76) >> 2)] = $899
        HEAP32[((72) >> 2)] = -1
        var $i_02_i_i = 0; label = 207; break
      case 207:
        var $i_02_i_i
        var $901 = $i_02_i_i << 1
        var $902 = ((80 + ($901 << 2)) | 0)
        var $903 = $902
        var $_sum_i_i = ((($901) + (3)) | 0)
        var $904 = ((80 + ($_sum_i_i << 2)) | 0)
        HEAP32[(($904) >> 2)] = $903
        var $_sum1_i_i = ((($901) + (2)) | 0)
        var $905 = ((80 + ($_sum1_i_i << 2)) | 0)
        HEAP32[(($905) >> 2)] = $903
        var $906 = ((($i_02_i_i) + (1)) | 0)
        var $907 = ($906 >>> 0) < 32
        if ($907) { var $i_02_i_i = $906; label = 207; break } else { label = 208; break }
      case 208:
        var $908 = ((($tsize_244_i) - (40)) | 0)
        var $909 = (($tbase_245_i + 8) | 0)
        var $910 = $909
        var $911 = $910 & 7
        var $912 = ($911 | 0) === 0
        if ($912) { var $916 = 0; label = 210; break } else { label = 209; break }
      case 209:
        var $914 = (((-$910)) | 0)
        var $915 = $914 & 7
        var $916 = $915; label = 210; break
      case 210:
        var $916
        var $917 = (($tbase_245_i + $916) | 0)
        var $918 = $917
        var $919 = ((($908) - ($916)) | 0)
        HEAP32[((64) >> 2)] = $918
        HEAP32[((52) >> 2)] = $919
        var $920 = $919 | 1
        var $_sum_i12_i = ((($916) + (4)) | 0)
        var $921 = (($tbase_245_i + $_sum_i12_i) | 0)
        var $922 = $921
        HEAP32[(($922) >> 2)] = $920
        var $_sum2_i_i = ((($tsize_244_i) - (36)) | 0)
        var $923 = (($tbase_245_i + $_sum2_i_i) | 0)
        var $924 = $923
        HEAP32[(($924) >> 2)] = 40
        var $925 = HEAP32[((32) >> 2)]
        HEAP32[((68) >> 2)] = $925
        label = 338; break
      case 211:
        var $sp_073_i
        var $926 = (($sp_073_i) | 0)
        var $927 = HEAP32[(($926) >> 2)]
        var $928 = (($sp_073_i + 4) | 0)
        var $929 = HEAP32[(($928) >> 2)]
        var $930 = (($927 + $929) | 0)
        var $931 = ($tbase_245_i | 0) === ($930 | 0)
        if ($931) { label = 213; break } else { label = 212; break }
      case 212:
        var $933 = (($sp_073_i + 8) | 0)
        var $934 = HEAP32[(($933) >> 2)]
        var $935 = ($934 | 0) === 0
        if ($935) { label = 218; break } else { var $sp_073_i = $934; label = 211; break }
      case 213:
        var $936 = (($sp_073_i + 12) | 0)
        var $937 = HEAP32[(($936) >> 2)]
        var $938 = $937 & 8
        var $939 = ($938 | 0) === 0
        if ($939) { label = 214; break } else { label = 218; break }
      case 214:
        var $941 = $891
        var $942 = ($941 >>> 0) >= ($927 >>> 0)
        var $943 = ($941 >>> 0) < ($tbase_245_i >>> 0)
        var $or_cond47_i = $942 & $943
        if ($or_cond47_i) { label = 215; break } else { label = 218; break }
      case 215:
        var $945 = ((($929) + ($tsize_244_i)) | 0)
        HEAP32[(($928) >> 2)] = $945
        var $946 = HEAP32[((64) >> 2)]
        var $947 = HEAP32[((52) >> 2)]
        var $948 = ((($947) + ($tsize_244_i)) | 0)
        var $949 = $946
        var $950 = (($946 + 8) | 0)
        var $951 = $950
        var $952 = $951 & 7
        var $953 = ($952 | 0) === 0
        if ($953) { var $957 = 0; label = 217; break } else { label = 216; break }
      case 216:
        var $955 = (((-$951)) | 0)
        var $956 = $955 & 7
        var $957 = $956; label = 217; break
      case 217:
        var $957
        var $958 = (($949 + $957) | 0)
        var $959 = $958
        var $960 = ((($948) - ($957)) | 0)
        HEAP32[((64) >> 2)] = $959
        HEAP32[((52) >> 2)] = $960
        var $961 = $960 | 1
        var $_sum_i16_i = ((($957) + (4)) | 0)
        var $962 = (($949 + $_sum_i16_i) | 0)
        var $963 = $962
        HEAP32[(($963) >> 2)] = $961
        var $_sum2_i17_i = ((($948) + (4)) | 0)
        var $964 = (($949 + $_sum2_i17_i) | 0)
        var $965 = $964
        HEAP32[(($965) >> 2)] = 40
        var $966 = HEAP32[((32) >> 2)]
        HEAP32[((68) >> 2)] = $966
        label = 338; break
      case 218:
        var $967 = HEAP32[((56) >> 2)]
        var $968 = ($tbase_245_i >>> 0) < ($967 >>> 0)
        if ($968) { label = 219; break } else { label = 220; break }
      case 219:
        HEAP32[((56) >> 2)] = $tbase_245_i
        label = 220; break
      case 220:
        var $970 = (($tbase_245_i + $tsize_244_i) | 0)
        var $sp_166_i = 488; label = 221; break
      case 221:
        var $sp_166_i
        var $972 = (($sp_166_i) | 0)
        var $973 = HEAP32[(($972) >> 2)]
        var $974 = ($973 | 0) === ($970 | 0)
        if ($974) { label = 223; break } else { label = 222; break }
      case 222:
        var $976 = (($sp_166_i + 8) | 0)
        var $977 = HEAP32[(($976) >> 2)]
        var $978 = ($977 | 0) === 0
        if ($978) { label = 304; break } else { var $sp_166_i = $977; label = 221; break }
      case 223:
        var $979 = (($sp_166_i + 12) | 0)
        var $980 = HEAP32[(($979) >> 2)]
        var $981 = $980 & 8
        var $982 = ($981 | 0) === 0
        if ($982) { label = 224; break } else { label = 304; break }
      case 224:
        HEAP32[(($972) >> 2)] = $tbase_245_i
        var $984 = (($sp_166_i + 4) | 0)
        var $985 = HEAP32[(($984) >> 2)]
        var $986 = ((($985) + ($tsize_244_i)) | 0)
        HEAP32[(($984) >> 2)] = $986
        var $987 = (($tbase_245_i + 8) | 0)
        var $988 = $987
        var $989 = $988 & 7
        var $990 = ($989 | 0) === 0
        if ($990) { var $995 = 0; label = 226; break } else { label = 225; break }
      case 225:
        var $992 = (((-$988)) | 0)
        var $993 = $992 & 7
        var $995 = $993; label = 226; break
      case 226:
        var $995
        var $996 = (($tbase_245_i + $995) | 0)
        var $_sum102_i = ((($tsize_244_i) + (8)) | 0)
        var $997 = (($tbase_245_i + $_sum102_i) | 0)
        var $998 = $997
        var $999 = $998 & 7
        var $1000 = ($999 | 0) === 0
        if ($1000) { var $1005 = 0; label = 228; break } else { label = 227; break }
      case 227:
        var $1002 = (((-$998)) | 0)
        var $1003 = $1002 & 7
        var $1005 = $1003; label = 228; break
      case 228:
        var $1005
        var $_sum103_i = ((($1005) + ($tsize_244_i)) | 0)
        var $1006 = (($tbase_245_i + $_sum103_i) | 0)
        var $1007 = $1006
        var $1008 = $1006
        var $1009 = $996
        var $1010 = ((($1008) - ($1009)) | 0)
        var $_sum_i19_i = ((($995) + ($nb_0)) | 0)
        var $1011 = (($tbase_245_i + $_sum_i19_i) | 0)
        var $1012 = $1011
        var $1013 = ((($1010) - ($nb_0)) | 0)
        var $1014 = $nb_0 | 3
        var $_sum1_i20_i = ((($995) + (4)) | 0)
        var $1015 = (($tbase_245_i + $_sum1_i20_i) | 0)
        var $1016 = $1015
        HEAP32[(($1016) >> 2)] = $1014
        var $1017 = HEAP32[((64) >> 2)]
        var $1018 = ($1007 | 0) === ($1017 | 0)
        if ($1018) { label = 229; break } else { label = 230; break }
      case 229:
        var $1020 = HEAP32[((52) >> 2)]
        var $1021 = ((($1020) + ($1013)) | 0)
        HEAP32[((52) >> 2)] = $1021
        HEAP32[((64) >> 2)] = $1012
        var $1022 = $1021 | 1
        var $_sum46_i_i = ((($_sum_i19_i) + (4)) | 0)
        var $1023 = (($tbase_245_i + $_sum46_i_i) | 0)
        var $1024 = $1023
        HEAP32[(($1024) >> 2)] = $1022
        label = 303; break
      case 230:
        var $1026 = HEAP32[((60) >> 2)]
        var $1027 = ($1007 | 0) === ($1026 | 0)
        if ($1027) { label = 231; break } else { label = 232; break }
      case 231:
        var $1029 = HEAP32[((48) >> 2)]
        var $1030 = ((($1029) + ($1013)) | 0)
        HEAP32[((48) >> 2)] = $1030
        HEAP32[((60) >> 2)] = $1012
        var $1031 = $1030 | 1
        var $_sum44_i_i = ((($_sum_i19_i) + (4)) | 0)
        var $1032 = (($tbase_245_i + $_sum44_i_i) | 0)
        var $1033 = $1032
        HEAP32[(($1033) >> 2)] = $1031
        var $_sum45_i_i = ((($1030) + ($_sum_i19_i)) | 0)
        var $1034 = (($tbase_245_i + $_sum45_i_i) | 0)
        var $1035 = $1034
        HEAP32[(($1035) >> 2)] = $1030
        label = 303; break
      case 232:
        var $_sum2_i21_i = ((($tsize_244_i) + (4)) | 0)
        var $_sum104_i = ((($_sum2_i21_i) + ($1005)) | 0)
        var $1037 = (($tbase_245_i + $_sum104_i) | 0)
        var $1038 = $1037
        var $1039 = HEAP32[(($1038) >> 2)]
        var $1040 = $1039 & 3
        var $1041 = ($1040 | 0) === 1
        if ($1041) { label = 233; break } else { var $oldfirst_0_i_i = $1007; var $qsize_0_i_i = $1013; label = 280; break }
      case 233:
        var $1043 = $1039 & -8
        var $1044 = $1039 >>> 3
        var $1045 = ($1039 >>> 0) < 256
        if ($1045) { label = 234; break } else { label = 246; break }
      case 234:
        var $_sum3940_i_i = $1005 | 8
        var $_sum114_i = ((($_sum3940_i_i) + ($tsize_244_i)) | 0)
        var $1047 = (($tbase_245_i + $_sum114_i) | 0)
        var $1048 = $1047
        var $1049 = HEAP32[(($1048) >> 2)]
        var $_sum41_i_i = ((($tsize_244_i) + (12)) | 0)
        var $_sum115_i = ((($_sum41_i_i) + ($1005)) | 0)
        var $1050 = (($tbase_245_i + $_sum115_i) | 0)
        var $1051 = $1050
        var $1052 = HEAP32[(($1051) >> 2)]
        var $1053 = $1044 << 1
        var $1054 = ((80 + ($1053 << 2)) | 0)
        var $1055 = $1054
        var $1056 = ($1049 | 0) === ($1055 | 0)
        if ($1056) { label = 237; break } else { label = 235; break }
      case 235:
        var $1058 = $1049
        var $1059 = HEAP32[((56) >> 2)]
        var $1060 = ($1058 >>> 0) < ($1059 >>> 0)
        if ($1060) { label = 245; break } else { label = 236; break }
      case 236:
        var $1062 = (($1049 + 12) | 0)
        var $1063 = HEAP32[(($1062) >> 2)]
        var $1064 = ($1063 | 0) === ($1007 | 0)
        if ($1064) { label = 237; break } else { label = 245; break }
      case 237:
        var $1065 = ($1052 | 0) === ($1049 | 0)
        if ($1065) { label = 238; break } else { label = 239; break }
      case 238:
        var $1067 = 1 << $1044
        var $1068 = $1067 ^ -1
        var $1069 = HEAP32[((40) >> 2)]
        var $1070 = $1069 & $1068
        HEAP32[((40) >> 2)] = $1070
        label = 279; break
      case 239:
        var $1072 = ($1052 | 0) === ($1055 | 0)
        if ($1072) { label = 240; break } else { label = 241; break }
      case 240:
        var $_pre62_i_i = (($1052 + 8) | 0)
        var $_pre_phi63_i_i = $_pre62_i_i; label = 243; break
      case 241:
        var $1074 = $1052
        var $1075 = HEAP32[((56) >> 2)]
        var $1076 = ($1074 >>> 0) < ($1075 >>> 0)
        if ($1076) { label = 244; break } else { label = 242; break }
      case 242:
        var $1078 = (($1052 + 8) | 0)
        var $1079 = HEAP32[(($1078) >> 2)]
        var $1080 = ($1079 | 0) === ($1007 | 0)
        if ($1080) { var $_pre_phi63_i_i = $1078; label = 243; break } else { label = 244; break }
      case 243:
        var $_pre_phi63_i_i
        var $1081 = (($1049 + 12) | 0)
        HEAP32[(($1081) >> 2)] = $1052
        HEAP32[(($_pre_phi63_i_i) >> 2)] = $1049
        label = 279; break
      case 244:

        throw new Error('Reached an unreachable!')
      case 245:

        throw new Error('Reached an unreachable!')
      case 246:
        var $1083 = $1006
        var $_sum34_i_i = $1005 | 24
        var $_sum105_i = ((($_sum34_i_i) + ($tsize_244_i)) | 0)
        var $1084 = (($tbase_245_i + $_sum105_i) | 0)
        var $1085 = $1084
        var $1086 = HEAP32[(($1085) >> 2)]
        var $_sum5_i_i = ((($tsize_244_i) + (12)) | 0)
        var $_sum106_i = ((($_sum5_i_i) + ($1005)) | 0)
        var $1087 = (($tbase_245_i + $_sum106_i) | 0)
        var $1088 = $1087
        var $1089 = HEAP32[(($1088) >> 2)]
        var $1090 = ($1089 | 0) === ($1083 | 0)
        if ($1090) { label = 252; break } else { label = 247; break }
      case 247:
        var $_sum3637_i_i = $1005 | 8
        var $_sum107_i = ((($_sum3637_i_i) + ($tsize_244_i)) | 0)
        var $1092 = (($tbase_245_i + $_sum107_i) | 0)
        var $1093 = $1092
        var $1094 = HEAP32[(($1093) >> 2)]
        var $1095 = $1094
        var $1096 = HEAP32[((56) >> 2)]
        var $1097 = ($1095 >>> 0) < ($1096 >>> 0)
        if ($1097) { label = 251; break } else { label = 248; break }
      case 248:
        var $1099 = (($1094 + 12) | 0)
        var $1100 = HEAP32[(($1099) >> 2)]
        var $1101 = ($1100 | 0) === ($1083 | 0)
        if ($1101) { label = 249; break } else { label = 251; break }
      case 249:
        var $1103 = (($1089 + 8) | 0)
        var $1104 = HEAP32[(($1103) >> 2)]
        var $1105 = ($1104 | 0) === ($1083 | 0)
        if ($1105) { label = 250; break } else { label = 251; break }
      case 250:
        HEAP32[(($1099) >> 2)] = $1089
        HEAP32[(($1103) >> 2)] = $1094
        var $R_1_i_i = $1089; label = 259; break
      case 251:

        throw new Error('Reached an unreachable!')
      case 252:
        var $_sum67_i_i = $1005 | 16
        var $_sum112_i = ((($_sum2_i21_i) + ($_sum67_i_i)) | 0)
        var $1108 = (($tbase_245_i + $_sum112_i) | 0)
        var $1109 = $1108
        var $1110 = HEAP32[(($1109) >> 2)]
        var $1111 = ($1110 | 0) === 0
        if ($1111) { label = 253; break } else { var $R_0_i_i = $1110; var $RP_0_i_i = $1109; label = 254; break }
      case 253:
        var $_sum113_i = ((($_sum67_i_i) + ($tsize_244_i)) | 0)
        var $1113 = (($tbase_245_i + $_sum113_i) | 0)
        var $1114 = $1113
        var $1115 = HEAP32[(($1114) >> 2)]
        var $1116 = ($1115 | 0) === 0
        if ($1116) { var $R_1_i_i = 0; label = 259; break } else { var $R_0_i_i = $1115; var $RP_0_i_i = $1114; label = 254; break }
      case 254:
        var $RP_0_i_i
        var $R_0_i_i
        var $1117 = (($R_0_i_i + 20) | 0)
        var $1118 = HEAP32[(($1117) >> 2)]
        var $1119 = ($1118 | 0) === 0
        if ($1119) { label = 255; break } else { var $R_0_i_i = $1118; var $RP_0_i_i = $1117; label = 254; break }
      case 255:
        var $1121 = (($R_0_i_i + 16) | 0)
        var $1122 = HEAP32[(($1121) >> 2)]
        var $1123 = ($1122 | 0) === 0
        if ($1123) { label = 256; break } else { var $R_0_i_i = $1122; var $RP_0_i_i = $1121; label = 254; break }
      case 256:
        var $1125 = $RP_0_i_i
        var $1126 = HEAP32[((56) >> 2)]
        var $1127 = ($1125 >>> 0) < ($1126 >>> 0)
        if ($1127) { label = 258; break } else { label = 257; break }
      case 257:
        HEAP32[(($RP_0_i_i) >> 2)] = 0
        var $R_1_i_i = $R_0_i_i; label = 259; break
      case 258:

        throw new Error('Reached an unreachable!')
      case 259:
        var $R_1_i_i
        var $1131 = ($1086 | 0) === 0
        if ($1131) { label = 279; break } else { label = 260; break }
      case 260:
        var $_sum31_i_i = ((($tsize_244_i) + (28)) | 0)
        var $_sum108_i = ((($_sum31_i_i) + ($1005)) | 0)
        var $1133 = (($tbase_245_i + $_sum108_i) | 0)
        var $1134 = $1133
        var $1135 = HEAP32[(($1134) >> 2)]
        var $1136 = ((344 + ($1135 << 2)) | 0)
        var $1137 = HEAP32[(($1136) >> 2)]
        var $1138 = ($1083 | 0) === ($1137 | 0)
        if ($1138) { label = 261; break } else { label = 263; break }
      case 261:
        HEAP32[(($1136) >> 2)] = $R_1_i_i
        var $cond_i_i = ($R_1_i_i | 0) === 0
        if ($cond_i_i) { label = 262; break } else { label = 269; break }
      case 262:
        var $1140 = HEAP32[(($1134) >> 2)]
        var $1141 = 1 << $1140
        var $1142 = $1141 ^ -1
        var $1143 = HEAP32[((44) >> 2)]
        var $1144 = $1143 & $1142
        HEAP32[((44) >> 2)] = $1144
        label = 279; break
      case 263:
        var $1146 = $1086
        var $1147 = HEAP32[((56) >> 2)]
        var $1148 = ($1146 >>> 0) < ($1147 >>> 0)
        if ($1148) { label = 267; break } else { label = 264; break }
      case 264:
        var $1150 = (($1086 + 16) | 0)
        var $1151 = HEAP32[(($1150) >> 2)]
        var $1152 = ($1151 | 0) === ($1083 | 0)
        if ($1152) { label = 265; break } else { label = 266; break }
      case 265:
        HEAP32[(($1150) >> 2)] = $R_1_i_i
        label = 268; break
      case 266:
        var $1155 = (($1086 + 20) | 0)
        HEAP32[(($1155) >> 2)] = $R_1_i_i
        label = 268; break
      case 267:

        throw new Error('Reached an unreachable!')
      case 268:
        var $1158 = ($R_1_i_i | 0) === 0
        if ($1158) { label = 279; break } else { label = 269; break }
      case 269:
        var $1160 = $R_1_i_i
        var $1161 = HEAP32[((56) >> 2)]
        var $1162 = ($1160 >>> 0) < ($1161 >>> 0)
        if ($1162) { label = 278; break } else { label = 270; break }
      case 270:
        var $1164 = (($R_1_i_i + 24) | 0)
        HEAP32[(($1164) >> 2)] = $1086
        var $_sum3233_i_i = $1005 | 16
        var $_sum109_i = ((($_sum3233_i_i) + ($tsize_244_i)) | 0)
        var $1165 = (($tbase_245_i + $_sum109_i) | 0)
        var $1166 = $1165
        var $1167 = HEAP32[(($1166) >> 2)]
        var $1168 = ($1167 | 0) === 0
        if ($1168) { label = 274; break } else { label = 271; break }
      case 271:
        var $1170 = $1167
        var $1171 = HEAP32[((56) >> 2)]
        var $1172 = ($1170 >>> 0) < ($1171 >>> 0)
        if ($1172) { label = 273; break } else { label = 272; break }
      case 272:
        var $1174 = (($R_1_i_i + 16) | 0)
        HEAP32[(($1174) >> 2)] = $1167
        var $1175 = (($1167 + 24) | 0)
        HEAP32[(($1175) >> 2)] = $R_1_i_i
        label = 274; break
      case 273:

        throw new Error('Reached an unreachable!')
      case 274:
        var $_sum110_i = ((($_sum2_i21_i) + ($_sum3233_i_i)) | 0)
        var $1178 = (($tbase_245_i + $_sum110_i) | 0)
        var $1179 = $1178
        var $1180 = HEAP32[(($1179) >> 2)]
        var $1181 = ($1180 | 0) === 0
        if ($1181) { label = 279; break } else { label = 275; break }
      case 275:
        var $1183 = $1180
        var $1184 = HEAP32[((56) >> 2)]
        var $1185 = ($1183 >>> 0) < ($1184 >>> 0)
        if ($1185) { label = 277; break } else { label = 276; break }
      case 276:
        var $1187 = (($R_1_i_i + 20) | 0)
        HEAP32[(($1187) >> 2)] = $1180
        var $1188 = (($1180 + 24) | 0)
        HEAP32[(($1188) >> 2)] = $R_1_i_i
        label = 279; break
      case 277:

        throw new Error('Reached an unreachable!')
      case 278:

        throw new Error('Reached an unreachable!')
      case 279:
        var $_sum9_i_i = $1043 | $1005
        var $_sum111_i = ((($_sum9_i_i) + ($tsize_244_i)) | 0)
        var $1192 = (($tbase_245_i + $_sum111_i) | 0)
        var $1193 = $1192
        var $1194 = ((($1043) + ($1013)) | 0)
        var $oldfirst_0_i_i = $1193; var $qsize_0_i_i = $1194; label = 280; break
      case 280:
        var $qsize_0_i_i
        var $oldfirst_0_i_i
        var $1196 = (($oldfirst_0_i_i + 4) | 0)
        var $1197 = HEAP32[(($1196) >> 2)]
        var $1198 = $1197 & -2
        HEAP32[(($1196) >> 2)] = $1198
        var $1199 = $qsize_0_i_i | 1
        var $_sum10_i_i = ((($_sum_i19_i) + (4)) | 0)
        var $1200 = (($tbase_245_i + $_sum10_i_i) | 0)
        var $1201 = $1200
        HEAP32[(($1201) >> 2)] = $1199
        var $_sum11_i_i = ((($qsize_0_i_i) + ($_sum_i19_i)) | 0)
        var $1202 = (($tbase_245_i + $_sum11_i_i) | 0)
        var $1203 = $1202
        HEAP32[(($1203) >> 2)] = $qsize_0_i_i
        var $1204 = $qsize_0_i_i >>> 3
        var $1205 = ($qsize_0_i_i >>> 0) < 256
        if ($1205) { label = 281; break } else { label = 286; break }
      case 281:
        var $1207 = $1204 << 1
        var $1208 = ((80 + ($1207 << 2)) | 0)
        var $1209 = $1208
        var $1210 = HEAP32[((40) >> 2)]
        var $1211 = 1 << $1204
        var $1212 = $1210 & $1211
        var $1213 = ($1212 | 0) === 0
        if ($1213) { label = 282; break } else { label = 283; break }
      case 282:
        var $1215 = $1210 | $1211
        HEAP32[((40) >> 2)] = $1215
        var $_sum27_pre_i_i = ((($1207) + (2)) | 0)
        var $_pre_i22_i = ((80 + ($_sum27_pre_i_i << 2)) | 0)
        var $F4_0_i_i = $1209; var $_pre_phi_i23_i = $_pre_i22_i; label = 285; break
      case 283:
        var $_sum30_i_i = ((($1207) + (2)) | 0)
        var $1217 = ((80 + ($_sum30_i_i << 2)) | 0)
        var $1218 = HEAP32[(($1217) >> 2)]
        var $1219 = $1218
        var $1220 = HEAP32[((56) >> 2)]
        var $1221 = ($1219 >>> 0) < ($1220 >>> 0)
        if ($1221) { label = 284; break } else { var $F4_0_i_i = $1218; var $_pre_phi_i23_i = $1217; label = 285; break }
      case 284:

        throw new Error('Reached an unreachable!')
      case 285:
        var $_pre_phi_i23_i
        var $F4_0_i_i
        HEAP32[(($_pre_phi_i23_i) >> 2)] = $1012
        var $1224 = (($F4_0_i_i + 12) | 0)
        HEAP32[(($1224) >> 2)] = $1012
        var $_sum28_i_i = ((($_sum_i19_i) + (8)) | 0)
        var $1225 = (($tbase_245_i + $_sum28_i_i) | 0)
        var $1226 = $1225
        HEAP32[(($1226) >> 2)] = $F4_0_i_i
        var $_sum29_i_i = ((($_sum_i19_i) + (12)) | 0)
        var $1227 = (($tbase_245_i + $_sum29_i_i) | 0)
        var $1228 = $1227
        HEAP32[(($1228) >> 2)] = $1209
        label = 303; break
      case 286:
        var $1230 = $1011
        var $1231 = $qsize_0_i_i >>> 8
        var $1232 = ($1231 | 0) === 0
        if ($1232) { var $I7_0_i_i = 0; label = 289; break } else { label = 287; break }
      case 287:
        var $1234 = ($qsize_0_i_i >>> 0) > 16777215
        if ($1234) { var $I7_0_i_i = 31; label = 289; break } else { label = 288; break }
      case 288:
        var $1236 = ((($1231) + (1048320)) | 0)
        var $1237 = $1236 >>> 16
        var $1238 = $1237 & 8
        var $1239 = $1231 << $1238
        var $1240 = ((($1239) + (520192)) | 0)
        var $1241 = $1240 >>> 16
        var $1242 = $1241 & 4
        var $1243 = $1242 | $1238
        var $1244 = $1239 << $1242
        var $1245 = ((($1244) + (245760)) | 0)
        var $1246 = $1245 >>> 16
        var $1247 = $1246 & 2
        var $1248 = $1243 | $1247
        var $1249 = (((14) - ($1248)) | 0)
        var $1250 = $1244 << $1247
        var $1251 = $1250 >>> 15
        var $1252 = ((($1249) + ($1251)) | 0)
        var $1253 = $1252 << 1
        var $1254 = ((($1252) + (7)) | 0)
        var $1255 = $qsize_0_i_i >>> ($1254 >>> 0)
        var $1256 = $1255 & 1
        var $1257 = $1256 | $1253
        var $I7_0_i_i = $1257; label = 289; break
      case 289:
        var $I7_0_i_i
        var $1259 = ((344 + ($I7_0_i_i << 2)) | 0)
        var $_sum12_i24_i = ((($_sum_i19_i) + (28)) | 0)
        var $1260 = (($tbase_245_i + $_sum12_i24_i) | 0)
        var $1261 = $1260
        HEAP32[(($1261) >> 2)] = $I7_0_i_i
        var $_sum13_i_i = ((($_sum_i19_i) + (16)) | 0)
        var $1262 = (($tbase_245_i + $_sum13_i_i) | 0)
        var $_sum14_i_i = ((($_sum_i19_i) + (20)) | 0)
        var $1263 = (($tbase_245_i + $_sum14_i_i) | 0)
        var $1264 = $1263
        HEAP32[(($1264) >> 2)] = 0
        var $1265 = $1262
        HEAP32[(($1265) >> 2)] = 0
        var $1266 = HEAP32[((44) >> 2)]
        var $1267 = 1 << $I7_0_i_i
        var $1268 = $1266 & $1267
        var $1269 = ($1268 | 0) === 0
        if ($1269) { label = 290; break } else { label = 291; break }
      case 290:
        var $1271 = $1266 | $1267
        HEAP32[((44) >> 2)] = $1271
        HEAP32[(($1259) >> 2)] = $1230
        var $1272 = $1259
        var $_sum15_i_i = ((($_sum_i19_i) + (24)) | 0)
        var $1273 = (($tbase_245_i + $_sum15_i_i) | 0)
        var $1274 = $1273
        HEAP32[(($1274) >> 2)] = $1272
        var $_sum16_i_i = ((($_sum_i19_i) + (12)) | 0)
        var $1275 = (($tbase_245_i + $_sum16_i_i) | 0)
        var $1276 = $1275
        HEAP32[(($1276) >> 2)] = $1230
        var $_sum17_i_i = ((($_sum_i19_i) + (8)) | 0)
        var $1277 = (($tbase_245_i + $_sum17_i_i) | 0)
        var $1278 = $1277
        HEAP32[(($1278) >> 2)] = $1230
        label = 303; break
      case 291:
        var $1280 = HEAP32[(($1259) >> 2)]
        var $1281 = ($I7_0_i_i | 0) === 31
        if ($1281) { var $1286 = 0; label = 293; break } else { label = 292; break }
      case 292:
        var $1283 = $I7_0_i_i >>> 1
        var $1284 = (((25) - ($1283)) | 0)
        var $1286 = $1284; label = 293; break
      case 293:
        var $1286
        var $1287 = (($1280 + 4) | 0)
        var $1288 = HEAP32[(($1287) >> 2)]
        var $1289 = $1288 & -8
        var $1290 = ($1289 | 0) === ($qsize_0_i_i | 0)
        if ($1290) { var $T_0_lcssa_i26_i = $1280; label = 300; break } else { label = 294; break }
      case 294:
        var $1291 = $qsize_0_i_i << $1286
        var $T_056_i_i = $1280; var $K8_057_i_i = $1291; label = 296; break
      case 295:
        var $1293 = $K8_057_i_i << 1
        var $1294 = (($1301 + 4) | 0)
        var $1295 = HEAP32[(($1294) >> 2)]
        var $1296 = $1295 & -8
        var $1297 = ($1296 | 0) === ($qsize_0_i_i | 0)
        if ($1297) { var $T_0_lcssa_i26_i = $1301; label = 300; break } else { var $T_056_i_i = $1301; var $K8_057_i_i = $1293; label = 296; break }
      case 296:
        var $K8_057_i_i
        var $T_056_i_i
        var $1299 = $K8_057_i_i >>> 31
        var $1300 = (($T_056_i_i + 16 + ($1299 << 2)) | 0)
        var $1301 = HEAP32[(($1300) >> 2)]
        var $1302 = ($1301 | 0) === 0
        if ($1302) { label = 297; break } else { label = 295; break }
      case 297:
        var $1304 = $1300
        var $1305 = HEAP32[((56) >> 2)]
        var $1306 = ($1304 >>> 0) < ($1305 >>> 0)
        if ($1306) { label = 299; break } else { label = 298; break }
      case 298:
        HEAP32[(($1300) >> 2)] = $1230
        var $_sum24_i_i = ((($_sum_i19_i) + (24)) | 0)
        var $1308 = (($tbase_245_i + $_sum24_i_i) | 0)
        var $1309 = $1308
        HEAP32[(($1309) >> 2)] = $T_056_i_i
        var $_sum25_i_i = ((($_sum_i19_i) + (12)) | 0)
        var $1310 = (($tbase_245_i + $_sum25_i_i) | 0)
        var $1311 = $1310
        HEAP32[(($1311) >> 2)] = $1230
        var $_sum26_i_i = ((($_sum_i19_i) + (8)) | 0)
        var $1312 = (($tbase_245_i + $_sum26_i_i) | 0)
        var $1313 = $1312
        HEAP32[(($1313) >> 2)] = $1230
        label = 303; break
      case 299:

        throw new Error('Reached an unreachable!')
      case 300:
        var $T_0_lcssa_i26_i
        var $1315 = (($T_0_lcssa_i26_i + 8) | 0)
        var $1316 = HEAP32[(($1315) >> 2)]
        var $1317 = $T_0_lcssa_i26_i
        var $1318 = HEAP32[((56) >> 2)]
        var $1319 = ($1317 >>> 0) >= ($1318 >>> 0)
        var $1320 = $1316
        var $1321 = ($1320 >>> 0) >= ($1318 >>> 0)
        var $or_cond_i27_i = $1319 & $1321
        if ($or_cond_i27_i) { label = 301; break } else { label = 302; break }
      case 301:
        var $1323 = (($1316 + 12) | 0)
        HEAP32[(($1323) >> 2)] = $1230
        HEAP32[(($1315) >> 2)] = $1230
        var $_sum21_i_i = ((($_sum_i19_i) + (8)) | 0)
        var $1324 = (($tbase_245_i + $_sum21_i_i) | 0)
        var $1325 = $1324
        HEAP32[(($1325) >> 2)] = $1316
        var $_sum22_i_i = ((($_sum_i19_i) + (12)) | 0)
        var $1326 = (($tbase_245_i + $_sum22_i_i) | 0)
        var $1327 = $1326
        HEAP32[(($1327) >> 2)] = $T_0_lcssa_i26_i
        var $_sum23_i_i = ((($_sum_i19_i) + (24)) | 0)
        var $1328 = (($tbase_245_i + $_sum23_i_i) | 0)
        var $1329 = $1328
        HEAP32[(($1329) >> 2)] = 0
        label = 303; break
      case 302:

        throw new Error('Reached an unreachable!')
      case 303:
        var $_sum1819_i_i = $995 | 8
        var $1330 = (($tbase_245_i + $_sum1819_i_i) | 0)
        var $mem_0 = $1330; label = 341; break
      case 304:
        var $1331 = $891
        var $sp_0_i_i_i = 488; label = 305; break
      case 305:
        var $sp_0_i_i_i
        var $1333 = (($sp_0_i_i_i) | 0)
        var $1334 = HEAP32[(($1333) >> 2)]
        var $1335 = ($1334 >>> 0) > ($1331 >>> 0)
        if ($1335) { label = 307; break } else { label = 306; break }
      case 306:
        var $1337 = (($sp_0_i_i_i + 4) | 0)
        var $1338 = HEAP32[(($1337) >> 2)]
        var $1339 = (($1334 + $1338) | 0)
        var $1340 = ($1339 >>> 0) > ($1331 >>> 0)
        if ($1340) { label = 308; break } else { label = 307; break }
      case 307:
        var $1342 = (($sp_0_i_i_i + 8) | 0)
        var $1343 = HEAP32[(($1342) >> 2)]
        var $sp_0_i_i_i = $1343; label = 305; break
      case 308:
        var $_sum_i13_i = ((($1338) - (47)) | 0)
        var $_sum1_i14_i = ((($1338) - (39)) | 0)
        var $1344 = (($1334 + $_sum1_i14_i) | 0)
        var $1345 = $1344
        var $1346 = $1345 & 7
        var $1347 = ($1346 | 0) === 0
        if ($1347) { var $1352 = 0; label = 310; break } else { label = 309; break }
      case 309:
        var $1349 = (((-$1345)) | 0)
        var $1350 = $1349 & 7
        var $1352 = $1350; label = 310; break
      case 310:
        var $1352
        var $_sum2_i15_i = ((($_sum_i13_i) + ($1352)) | 0)
        var $1353 = (($1334 + $_sum2_i15_i) | 0)
        var $1354 = (($891 + 16) | 0)
        var $1355 = $1354
        var $1356 = ($1353 >>> 0) < ($1355 >>> 0)
        var $1357 = ($1356 ? $1331 : $1353)
        var $1358 = (($1357 + 8) | 0)
        var $1359 = $1358
        var $1360 = ((($tsize_244_i) - (40)) | 0)
        var $1361 = (($tbase_245_i + 8) | 0)
        var $1362 = $1361
        var $1363 = $1362 & 7
        var $1364 = ($1363 | 0) === 0
        if ($1364) { var $1368 = 0; label = 312; break } else { label = 311; break }
      case 311:
        var $1366 = (((-$1362)) | 0)
        var $1367 = $1366 & 7
        var $1368 = $1367; label = 312; break
      case 312:
        var $1368
        var $1369 = (($tbase_245_i + $1368) | 0)
        var $1370 = $1369
        var $1371 = ((($1360) - ($1368)) | 0)
        HEAP32[((64) >> 2)] = $1370
        HEAP32[((52) >> 2)] = $1371
        var $1372 = $1371 | 1
        var $_sum_i_i_i = ((($1368) + (4)) | 0)
        var $1373 = (($tbase_245_i + $_sum_i_i_i) | 0)
        var $1374 = $1373
        HEAP32[(($1374) >> 2)] = $1372
        var $_sum2_i_i_i = ((($tsize_244_i) - (36)) | 0)
        var $1375 = (($tbase_245_i + $_sum2_i_i_i) | 0)
        var $1376 = $1375
        HEAP32[(($1376) >> 2)] = 40
        var $1377 = HEAP32[((32) >> 2)]
        HEAP32[((68) >> 2)] = $1377
        var $1378 = (($1357 + 4) | 0)
        var $1379 = $1378
        HEAP32[(($1379) >> 2)] = 27
        assert(16 % 1 === 0); HEAP32[(($1358) >> 2)] = HEAP32[((488) >> 2)]; HEAP32[((($1358) + (4)) >> 2)] = HEAP32[((492) >> 2)]; HEAP32[((($1358) + (8)) >> 2)] = HEAP32[((496) >> 2)]; HEAP32[((($1358) + (12)) >> 2)] = HEAP32[((500) >> 2)]
        HEAP32[((488) >> 2)] = $tbase_245_i
        HEAP32[((492) >> 2)] = $tsize_244_i
        HEAP32[((500) >> 2)] = 0
        HEAP32[((496) >> 2)] = $1359
        var $1380 = (($1357 + 28) | 0)
        var $1381 = $1380
        HEAP32[(($1381) >> 2)] = 7
        var $1382 = (($1357 + 32) | 0)
        var $1383 = ($1382 >>> 0) < ($1339 >>> 0)
        if ($1383) { var $1384 = $1381; label = 313; break } else { label = 314; break }
      case 313:
        var $1384
        var $1385 = (($1384 + 4) | 0)
        HEAP32[(($1385) >> 2)] = 7
        var $1386 = (($1384 + 8) | 0)
        var $1387 = $1386
        var $1388 = ($1387 >>> 0) < ($1339 >>> 0)
        if ($1388) { var $1384 = $1385; label = 313; break } else { label = 314; break }
      case 314:
        var $1389 = ($1357 | 0) === ($1331 | 0)
        if ($1389) { label = 338; break } else { label = 315; break }
      case 315:
        var $1391 = $1357
        var $1392 = $891
        var $1393 = ((($1391) - ($1392)) | 0)
        var $1394 = (($1331 + $1393) | 0)
        var $_sum3_i_i = ((($1393) + (4)) | 0)
        var $1395 = (($1331 + $_sum3_i_i) | 0)
        var $1396 = $1395
        var $1397 = HEAP32[(($1396) >> 2)]
        var $1398 = $1397 & -2
        HEAP32[(($1396) >> 2)] = $1398
        var $1399 = $1393 | 1
        var $1400 = (($891 + 4) | 0)
        HEAP32[(($1400) >> 2)] = $1399
        var $1401 = $1394
        HEAP32[(($1401) >> 2)] = $1393
        var $1402 = $1393 >>> 3
        var $1403 = ($1393 >>> 0) < 256
        if ($1403) { label = 316; break } else { label = 321; break }
      case 316:
        var $1405 = $1402 << 1
        var $1406 = ((80 + ($1405 << 2)) | 0)
        var $1407 = $1406
        var $1408 = HEAP32[((40) >> 2)]
        var $1409 = 1 << $1402
        var $1410 = $1408 & $1409
        var $1411 = ($1410 | 0) === 0
        if ($1411) { label = 317; break } else { label = 318; break }
      case 317:
        var $1413 = $1408 | $1409
        HEAP32[((40) >> 2)] = $1413
        var $_sum11_pre_i_i = ((($1405) + (2)) | 0)
        var $_pre_i_i = ((80 + ($_sum11_pre_i_i << 2)) | 0)
        var $F_0_i_i = $1407; var $_pre_phi_i_i = $_pre_i_i; label = 320; break
      case 318:
        var $_sum12_i_i = ((($1405) + (2)) | 0)
        var $1415 = ((80 + ($_sum12_i_i << 2)) | 0)
        var $1416 = HEAP32[(($1415) >> 2)]
        var $1417 = $1416
        var $1418 = HEAP32[((56) >> 2)]
        var $1419 = ($1417 >>> 0) < ($1418 >>> 0)
        if ($1419) { label = 319; break } else { var $F_0_i_i = $1416; var $_pre_phi_i_i = $1415; label = 320; break }
      case 319:

        throw new Error('Reached an unreachable!')
      case 320:
        var $_pre_phi_i_i
        var $F_0_i_i
        HEAP32[(($_pre_phi_i_i) >> 2)] = $891
        var $1422 = (($F_0_i_i + 12) | 0)
        HEAP32[(($1422) >> 2)] = $891
        var $1423 = (($891 + 8) | 0)
        HEAP32[(($1423) >> 2)] = $F_0_i_i
        var $1424 = (($891 + 12) | 0)
        HEAP32[(($1424) >> 2)] = $1407
        label = 338; break
      case 321:
        var $1426 = $891
        var $1427 = $1393 >>> 8
        var $1428 = ($1427 | 0) === 0
        if ($1428) { var $I1_0_i_i = 0; label = 324; break } else { label = 322; break }
      case 322:
        var $1430 = ($1393 >>> 0) > 16777215
        if ($1430) { var $I1_0_i_i = 31; label = 324; break } else { label = 323; break }
      case 323:
        var $1432 = ((($1427) + (1048320)) | 0)
        var $1433 = $1432 >>> 16
        var $1434 = $1433 & 8
        var $1435 = $1427 << $1434
        var $1436 = ((($1435) + (520192)) | 0)
        var $1437 = $1436 >>> 16
        var $1438 = $1437 & 4
        var $1439 = $1438 | $1434
        var $1440 = $1435 << $1438
        var $1441 = ((($1440) + (245760)) | 0)
        var $1442 = $1441 >>> 16
        var $1443 = $1442 & 2
        var $1444 = $1439 | $1443
        var $1445 = (((14) - ($1444)) | 0)
        var $1446 = $1440 << $1443
        var $1447 = $1446 >>> 15
        var $1448 = ((($1445) + ($1447)) | 0)
        var $1449 = $1448 << 1
        var $1450 = ((($1448) + (7)) | 0)
        var $1451 = $1393 >>> ($1450 >>> 0)
        var $1452 = $1451 & 1
        var $1453 = $1452 | $1449
        var $I1_0_i_i = $1453; label = 324; break
      case 324:
        var $I1_0_i_i
        var $1455 = ((344 + ($I1_0_i_i << 2)) | 0)
        var $1456 = (($891 + 28) | 0)
        var $I1_0_c_i_i = $I1_0_i_i
        HEAP32[(($1456) >> 2)] = $I1_0_c_i_i
        var $1457 = (($891 + 20) | 0)
        HEAP32[(($1457) >> 2)] = 0
        var $1458 = (($891 + 16) | 0)
        HEAP32[(($1458) >> 2)] = 0
        var $1459 = HEAP32[((44) >> 2)]
        var $1460 = 1 << $I1_0_i_i
        var $1461 = $1459 & $1460
        var $1462 = ($1461 | 0) === 0
        if ($1462) { label = 325; break } else { label = 326; break }
      case 325:
        var $1464 = $1459 | $1460
        HEAP32[((44) >> 2)] = $1464
        HEAP32[(($1455) >> 2)] = $1426
        var $1465 = (($891 + 24) | 0)
        var $_c_i_i = $1455
        HEAP32[(($1465) >> 2)] = $_c_i_i
        var $1466 = (($891 + 12) | 0)
        HEAP32[(($1466) >> 2)] = $891
        var $1467 = (($891 + 8) | 0)
        HEAP32[(($1467) >> 2)] = $891
        label = 338; break
      case 326:
        var $1469 = HEAP32[(($1455) >> 2)]
        var $1470 = ($I1_0_i_i | 0) === 31
        if ($1470) { var $1475 = 0; label = 328; break } else { label = 327; break }
      case 327:
        var $1472 = $I1_0_i_i >>> 1
        var $1473 = (((25) - ($1472)) | 0)
        var $1475 = $1473; label = 328; break
      case 328:
        var $1475
        var $1476 = (($1469 + 4) | 0)
        var $1477 = HEAP32[(($1476) >> 2)]
        var $1478 = $1477 & -8
        var $1479 = ($1478 | 0) === ($1393 | 0)
        if ($1479) { var $T_0_lcssa_i_i = $1469; label = 335; break } else { label = 329; break }
      case 329:
        var $1480 = $1393 << $1475
        var $T_015_i_i = $1469; var $K2_016_i_i = $1480; label = 331; break
      case 330:
        var $1482 = $K2_016_i_i << 1
        var $1483 = (($1490 + 4) | 0)
        var $1484 = HEAP32[(($1483) >> 2)]
        var $1485 = $1484 & -8
        var $1486 = ($1485 | 0) === ($1393 | 0)
        if ($1486) { var $T_0_lcssa_i_i = $1490; label = 335; break } else { var $T_015_i_i = $1490; var $K2_016_i_i = $1482; label = 331; break }
      case 331:
        var $K2_016_i_i
        var $T_015_i_i
        var $1488 = $K2_016_i_i >>> 31
        var $1489 = (($T_015_i_i + 16 + ($1488 << 2)) | 0)
        var $1490 = HEAP32[(($1489) >> 2)]
        var $1491 = ($1490 | 0) === 0
        if ($1491) { label = 332; break } else { label = 330; break }
      case 332:
        var $1493 = $1489
        var $1494 = HEAP32[((56) >> 2)]
        var $1495 = ($1493 >>> 0) < ($1494 >>> 0)
        if ($1495) { label = 334; break } else { label = 333; break }
      case 333:
        HEAP32[(($1489) >> 2)] = $1426
        var $1497 = (($891 + 24) | 0)
        var $T_0_c8_i_i = $T_015_i_i
        HEAP32[(($1497) >> 2)] = $T_0_c8_i_i
        var $1498 = (($891 + 12) | 0)
        HEAP32[(($1498) >> 2)] = $891
        var $1499 = (($891 + 8) | 0)
        HEAP32[(($1499) >> 2)] = $891
        label = 338; break
      case 334:

        throw new Error('Reached an unreachable!')
      case 335:
        var $T_0_lcssa_i_i
        var $1501 = (($T_0_lcssa_i_i + 8) | 0)
        var $1502 = HEAP32[(($1501) >> 2)]
        var $1503 = $T_0_lcssa_i_i
        var $1504 = HEAP32[((56) >> 2)]
        var $1505 = ($1503 >>> 0) >= ($1504 >>> 0)
        var $1506 = $1502
        var $1507 = ($1506 >>> 0) >= ($1504 >>> 0)
        var $or_cond_i_i = $1505 & $1507
        if ($or_cond_i_i) { label = 336; break } else { label = 337; break }
      case 336:
        var $1509 = (($1502 + 12) | 0)
        HEAP32[(($1509) >> 2)] = $1426
        HEAP32[(($1501) >> 2)] = $1426
        var $1510 = (($891 + 8) | 0)
        var $_c7_i_i = $1502
        HEAP32[(($1510) >> 2)] = $_c7_i_i
        var $1511 = (($891 + 12) | 0)
        var $T_0_c_i_i = $T_0_lcssa_i_i
        HEAP32[(($1511) >> 2)] = $T_0_c_i_i
        var $1512 = (($891 + 24) | 0)
        HEAP32[(($1512) >> 2)] = 0
        label = 338; break
      case 337:

        throw new Error('Reached an unreachable!')
      case 338:
        var $1513 = HEAP32[((52) >> 2)]
        var $1514 = ($1513 >>> 0) > ($nb_0 >>> 0)
        if ($1514) { label = 339; break } else { label = 340; break }
      case 339:
        var $1516 = ((($1513) - ($nb_0)) | 0)
        HEAP32[((52) >> 2)] = $1516
        var $1517 = HEAP32[((64) >> 2)]
        var $1518 = $1517
        var $1519 = (($1518 + $nb_0) | 0)
        var $1520 = $1519
        HEAP32[((64) >> 2)] = $1520
        var $1521 = $1516 | 1
        var $_sum_i34 = ((($nb_0) + (4)) | 0)
        var $1522 = (($1518 + $_sum_i34) | 0)
        var $1523 = $1522
        HEAP32[(($1523) >> 2)] = $1521
        var $1524 = $nb_0 | 3
        var $1525 = (($1517 + 4) | 0)
        HEAP32[(($1525) >> 2)] = $1524
        var $1526 = (($1517 + 8) | 0)
        var $1527 = $1526
        var $mem_0 = $1527; label = 341; break
      case 340:
        var $1528 = ___errno_location()
        HEAP32[(($1528) >> 2)] = 12
        var $mem_0 = 0; label = 341; break
      case 341:
        var $mem_0
        return $mem_0
      default: assert(0, 'bad label: ' + label)
    }
  }
}

function _free ($mem) {
  let label = 0

  label = 1
  while (1) {
    switch (label) {
      case 1:
        var $1 = ($mem | 0) === 0
        if ($1) { label = 140; break } else { label = 2; break }
      case 2:
        var $3 = ((($mem) - (8)) | 0)
        var $4 = $3
        var $5 = HEAP32[((56) >> 2)]
        var $6 = ($3 >>> 0) < ($5 >>> 0)
        if ($6) { label = 139; break } else { label = 3; break }
      case 3:
        var $8 = ((($mem) - (4)) | 0)
        var $9 = $8
        var $10 = HEAP32[(($9) >> 2)]
        var $11 = $10 & 3
        var $12 = ($11 | 0) === 1
        if ($12) { label = 139; break } else { label = 4; break }
      case 4:
        var $14 = $10 & -8
        var $_sum = ((($14) - (8)) | 0)
        var $15 = (($mem + $_sum) | 0)
        var $16 = $15
        var $17 = $10 & 1
        var $18 = ($17 | 0) === 0
        if ($18) { label = 5; break } else { var $p_0 = $4; var $psize_0 = $14; label = 56; break }
      case 5:
        var $20 = $3
        var $21 = HEAP32[(($20) >> 2)]
        var $22 = ($11 | 0) === 0
        if ($22) { label = 140; break } else { label = 6; break }
      case 6:
        var $_sum3 = (((-8) - ($21)) | 0)
        var $24 = (($mem + $_sum3) | 0)
        var $25 = $24
        var $26 = ((($21) + ($14)) | 0)
        var $27 = ($24 >>> 0) < ($5 >>> 0)
        if ($27) { label = 139; break } else { label = 7; break }
      case 7:
        var $29 = HEAP32[((60) >> 2)]
        var $30 = ($25 | 0) === ($29 | 0)
        if ($30) { label = 54; break } else { label = 8; break }
      case 8:
        var $32 = $21 >>> 3
        var $33 = ($21 >>> 0) < 256
        if ($33) { label = 9; break } else { label = 21; break }
      case 9:
        var $_sum47 = ((($_sum3) + (8)) | 0)
        var $35 = (($mem + $_sum47) | 0)
        var $36 = $35
        var $37 = HEAP32[(($36) >> 2)]
        var $_sum48 = ((($_sum3) + (12)) | 0)
        var $38 = (($mem + $_sum48) | 0)
        var $39 = $38
        var $40 = HEAP32[(($39) >> 2)]
        var $41 = $32 << 1
        var $42 = ((80 + ($41 << 2)) | 0)
        var $43 = $42
        var $44 = ($37 | 0) === ($43 | 0)
        if ($44) { label = 12; break } else { label = 10; break }
      case 10:
        var $46 = $37
        var $47 = ($46 >>> 0) < ($5 >>> 0)
        if ($47) { label = 20; break } else { label = 11; break }
      case 11:
        var $49 = (($37 + 12) | 0)
        var $50 = HEAP32[(($49) >> 2)]
        var $51 = ($50 | 0) === ($25 | 0)
        if ($51) { label = 12; break } else { label = 20; break }
      case 12:
        var $52 = ($40 | 0) === ($37 | 0)
        if ($52) { label = 13; break } else { label = 14; break }
      case 13:
        var $54 = 1 << $32
        var $55 = $54 ^ -1
        var $56 = HEAP32[((40) >> 2)]
        var $57 = $56 & $55
        HEAP32[((40) >> 2)] = $57
        var $p_0 = $25; var $psize_0 = $26; label = 56; break
      case 14:
        var $59 = ($40 | 0) === ($43 | 0)
        if ($59) { label = 15; break } else { label = 16; break }
      case 15:
        var $_pre82 = (($40 + 8) | 0)
        var $_pre_phi83 = $_pre82; label = 18; break
      case 16:
        var $61 = $40
        var $62 = ($61 >>> 0) < ($5 >>> 0)
        if ($62) { label = 19; break } else { label = 17; break }
      case 17:
        var $64 = (($40 + 8) | 0)
        var $65 = HEAP32[(($64) >> 2)]
        var $66 = ($65 | 0) === ($25 | 0)
        if ($66) { var $_pre_phi83 = $64; label = 18; break } else { label = 19; break }
      case 18:
        var $_pre_phi83
        var $67 = (($37 + 12) | 0)
        HEAP32[(($67) >> 2)] = $40
        HEAP32[(($_pre_phi83) >> 2)] = $37
        var $p_0 = $25; var $psize_0 = $26; label = 56; break
      case 19:

        throw new Error('Reached an unreachable!')
      case 20:

        throw new Error('Reached an unreachable!')
      case 21:
        var $69 = $24
        var $_sum37 = ((($_sum3) + (24)) | 0)
        var $70 = (($mem + $_sum37) | 0)
        var $71 = $70
        var $72 = HEAP32[(($71) >> 2)]
        var $_sum38 = ((($_sum3) + (12)) | 0)
        var $73 = (($mem + $_sum38) | 0)
        var $74 = $73
        var $75 = HEAP32[(($74) >> 2)]
        var $76 = ($75 | 0) === ($69 | 0)
        if ($76) { label = 27; break } else { label = 22; break }
      case 22:
        var $_sum44 = ((($_sum3) + (8)) | 0)
        var $78 = (($mem + $_sum44) | 0)
        var $79 = $78
        var $80 = HEAP32[(($79) >> 2)]
        var $81 = $80
        var $82 = ($81 >>> 0) < ($5 >>> 0)
        if ($82) { label = 26; break } else { label = 23; break }
      case 23:
        var $84 = (($80 + 12) | 0)
        var $85 = HEAP32[(($84) >> 2)]
        var $86 = ($85 | 0) === ($69 | 0)
        if ($86) { label = 24; break } else { label = 26; break }
      case 24:
        var $88 = (($75 + 8) | 0)
        var $89 = HEAP32[(($88) >> 2)]
        var $90 = ($89 | 0) === ($69 | 0)
        if ($90) { label = 25; break } else { label = 26; break }
      case 25:
        HEAP32[(($84) >> 2)] = $75
        HEAP32[(($88) >> 2)] = $80
        var $R_1 = $75; label = 34; break
      case 26:

        throw new Error('Reached an unreachable!')
      case 27:
        var $_sum40 = ((($_sum3) + (20)) | 0)
        var $93 = (($mem + $_sum40) | 0)
        var $94 = $93
        var $95 = HEAP32[(($94) >> 2)]
        var $96 = ($95 | 0) === 0
        if ($96) { label = 28; break } else { var $R_0 = $95; var $RP_0 = $94; label = 29; break }
      case 28:
        var $_sum39 = ((($_sum3) + (16)) | 0)
        var $98 = (($mem + $_sum39) | 0)
        var $99 = $98
        var $100 = HEAP32[(($99) >> 2)]
        var $101 = ($100 | 0) === 0
        if ($101) { var $R_1 = 0; label = 34; break } else { var $R_0 = $100; var $RP_0 = $99; label = 29; break }
      case 29:
        var $RP_0
        var $R_0
        var $102 = (($R_0 + 20) | 0)
        var $103 = HEAP32[(($102) >> 2)]
        var $104 = ($103 | 0) === 0
        if ($104) { label = 30; break } else { var $R_0 = $103; var $RP_0 = $102; label = 29; break }
      case 30:
        var $106 = (($R_0 + 16) | 0)
        var $107 = HEAP32[(($106) >> 2)]
        var $108 = ($107 | 0) === 0
        if ($108) { label = 31; break } else { var $R_0 = $107; var $RP_0 = $106; label = 29; break }
      case 31:
        var $110 = $RP_0
        var $111 = ($110 >>> 0) < ($5 >>> 0)
        if ($111) { label = 33; break } else { label = 32; break }
      case 32:
        HEAP32[(($RP_0) >> 2)] = 0
        var $R_1 = $R_0; label = 34; break
      case 33:

        throw new Error('Reached an unreachable!')
      case 34:
        var $R_1
        var $115 = ($72 | 0) === 0
        if ($115) { var $p_0 = $25; var $psize_0 = $26; label = 56; break } else { label = 35; break }
      case 35:
        var $_sum41 = ((($_sum3) + (28)) | 0)
        var $117 = (($mem + $_sum41) | 0)
        var $118 = $117
        var $119 = HEAP32[(($118) >> 2)]
        var $120 = ((344 + ($119 << 2)) | 0)
        var $121 = HEAP32[(($120) >> 2)]
        var $122 = ($69 | 0) === ($121 | 0)
        if ($122) { label = 36; break } else { label = 38; break }
      case 36:
        HEAP32[(($120) >> 2)] = $R_1
        var $cond = ($R_1 | 0) === 0
        if ($cond) { label = 37; break } else { label = 44; break }
      case 37:
        var $124 = HEAP32[(($118) >> 2)]
        var $125 = 1 << $124
        var $126 = $125 ^ -1
        var $127 = HEAP32[((44) >> 2)]
        var $128 = $127 & $126
        HEAP32[((44) >> 2)] = $128
        var $p_0 = $25; var $psize_0 = $26; label = 56; break
      case 38:
        var $130 = $72
        var $131 = HEAP32[((56) >> 2)]
        var $132 = ($130 >>> 0) < ($131 >>> 0)
        if ($132) { label = 42; break } else { label = 39; break }
      case 39:
        var $134 = (($72 + 16) | 0)
        var $135 = HEAP32[(($134) >> 2)]
        var $136 = ($135 | 0) === ($69 | 0)
        if ($136) { label = 40; break } else { label = 41; break }
      case 40:
        HEAP32[(($134) >> 2)] = $R_1
        label = 43; break
      case 41:
        var $139 = (($72 + 20) | 0)
        HEAP32[(($139) >> 2)] = $R_1
        label = 43; break
      case 42:

        throw new Error('Reached an unreachable!')
      case 43:
        var $142 = ($R_1 | 0) === 0
        if ($142) { var $p_0 = $25; var $psize_0 = $26; label = 56; break } else { label = 44; break }
      case 44:
        var $144 = $R_1
        var $145 = HEAP32[((56) >> 2)]
        var $146 = ($144 >>> 0) < ($145 >>> 0)
        if ($146) { label = 53; break } else { label = 45; break }
      case 45:
        var $148 = (($R_1 + 24) | 0)
        HEAP32[(($148) >> 2)] = $72
        var $_sum42 = ((($_sum3) + (16)) | 0)
        var $149 = (($mem + $_sum42) | 0)
        var $150 = $149
        var $151 = HEAP32[(($150) >> 2)]
        var $152 = ($151 | 0) === 0
        if ($152) { label = 49; break } else { label = 46; break }
      case 46:
        var $154 = $151
        var $155 = HEAP32[((56) >> 2)]
        var $156 = ($154 >>> 0) < ($155 >>> 0)
        if ($156) { label = 48; break } else { label = 47; break }
      case 47:
        var $158 = (($R_1 + 16) | 0)
        HEAP32[(($158) >> 2)] = $151
        var $159 = (($151 + 24) | 0)
        HEAP32[(($159) >> 2)] = $R_1
        label = 49; break
      case 48:

        throw new Error('Reached an unreachable!')
      case 49:
        var $_sum43 = ((($_sum3) + (20)) | 0)
        var $162 = (($mem + $_sum43) | 0)
        var $163 = $162
        var $164 = HEAP32[(($163) >> 2)]
        var $165 = ($164 | 0) === 0
        if ($165) { var $p_0 = $25; var $psize_0 = $26; label = 56; break } else { label = 50; break }
      case 50:
        var $167 = $164
        var $168 = HEAP32[((56) >> 2)]
        var $169 = ($167 >>> 0) < ($168 >>> 0)
        if ($169) { label = 52; break } else { label = 51; break }
      case 51:
        var $171 = (($R_1 + 20) | 0)
        HEAP32[(($171) >> 2)] = $164
        var $172 = (($164 + 24) | 0)
        HEAP32[(($172) >> 2)] = $R_1
        var $p_0 = $25; var $psize_0 = $26; label = 56; break
      case 52:

        throw new Error('Reached an unreachable!')
      case 53:

        throw new Error('Reached an unreachable!')
      case 54:
        var $_sum4 = ((($14) - (4)) | 0)
        var $176 = (($mem + $_sum4) | 0)
        var $177 = $176
        var $178 = HEAP32[(($177) >> 2)]
        var $179 = $178 & 3
        var $180 = ($179 | 0) === 3
        if ($180) { label = 55; break } else { var $p_0 = $25; var $psize_0 = $26; label = 56; break }
      case 55:
        HEAP32[((48) >> 2)] = $26
        var $182 = HEAP32[(($177) >> 2)]
        var $183 = $182 & -2
        HEAP32[(($177) >> 2)] = $183
        var $184 = $26 | 1
        var $_sum35 = ((($_sum3) + (4)) | 0)
        var $185 = (($mem + $_sum35) | 0)
        var $186 = $185
        HEAP32[(($186) >> 2)] = $184
        var $187 = $15
        HEAP32[(($187) >> 2)] = $26
        label = 140; break
      case 56:
        var $psize_0
        var $p_0
        var $189 = $p_0
        var $190 = ($189 >>> 0) < ($15 >>> 0)
        if ($190) { label = 57; break } else { label = 139; break }
      case 57:
        var $_sum34 = ((($14) - (4)) | 0)
        var $192 = (($mem + $_sum34) | 0)
        var $193 = $192
        var $194 = HEAP32[(($193) >> 2)]
        var $195 = $194 & 1
        var $phitmp = ($195 | 0) === 0
        if ($phitmp) { label = 139; break } else { label = 58; break }
      case 58:
        var $197 = $194 & 2
        var $198 = ($197 | 0) === 0
        if ($198) { label = 59; break } else { label = 112; break }
      case 59:
        var $200 = HEAP32[((64) >> 2)]
        var $201 = ($16 | 0) === ($200 | 0)
        if ($201) { label = 60; break } else { label = 62; break }
      case 60:
        var $203 = HEAP32[((52) >> 2)]
        var $204 = ((($203) + ($psize_0)) | 0)
        HEAP32[((52) >> 2)] = $204
        HEAP32[((64) >> 2)] = $p_0
        var $205 = $204 | 1
        var $206 = (($p_0 + 4) | 0)
        HEAP32[(($206) >> 2)] = $205
        var $207 = HEAP32[((60) >> 2)]
        var $208 = ($p_0 | 0) === ($207 | 0)
        if ($208) { label = 61; break } else { label = 140; break }
      case 61:
        HEAP32[((60) >> 2)] = 0
        HEAP32[((48) >> 2)] = 0
        label = 140; break
      case 62:
        var $211 = HEAP32[((60) >> 2)]
        var $212 = ($16 | 0) === ($211 | 0)
        if ($212) { label = 63; break } else { label = 64; break }
      case 63:
        var $214 = HEAP32[((48) >> 2)]
        var $215 = ((($214) + ($psize_0)) | 0)
        HEAP32[((48) >> 2)] = $215
        HEAP32[((60) >> 2)] = $p_0
        var $216 = $215 | 1
        var $217 = (($p_0 + 4) | 0)
        HEAP32[(($217) >> 2)] = $216
        var $218 = (($189 + $215) | 0)
        var $219 = $218
        HEAP32[(($219) >> 2)] = $215
        label = 140; break
      case 64:
        var $221 = $194 & -8
        var $222 = ((($221) + ($psize_0)) | 0)
        var $223 = $194 >>> 3
        var $224 = ($194 >>> 0) < 256
        if ($224) { label = 65; break } else { label = 77; break }
      case 65:
        var $226 = (($mem + $14) | 0)
        var $227 = $226
        var $228 = HEAP32[(($227) >> 2)]
        var $_sum2829 = $14 | 4
        var $229 = (($mem + $_sum2829) | 0)
        var $230 = $229
        var $231 = HEAP32[(($230) >> 2)]
        var $232 = $223 << 1
        var $233 = ((80 + ($232 << 2)) | 0)
        var $234 = $233
        var $235 = ($228 | 0) === ($234 | 0)
        if ($235) { label = 68; break } else { label = 66; break }
      case 66:
        var $237 = $228
        var $238 = HEAP32[((56) >> 2)]
        var $239 = ($237 >>> 0) < ($238 >>> 0)
        if ($239) { label = 76; break } else { label = 67; break }
      case 67:
        var $241 = (($228 + 12) | 0)
        var $242 = HEAP32[(($241) >> 2)]
        var $243 = ($242 | 0) === ($16 | 0)
        if ($243) { label = 68; break } else { label = 76; break }
      case 68:
        var $244 = ($231 | 0) === ($228 | 0)
        if ($244) { label = 69; break } else { label = 70; break }
      case 69:
        var $246 = 1 << $223
        var $247 = $246 ^ -1
        var $248 = HEAP32[((40) >> 2)]
        var $249 = $248 & $247
        HEAP32[((40) >> 2)] = $249
        label = 110; break
      case 70:
        var $251 = ($231 | 0) === ($234 | 0)
        if ($251) { label = 71; break } else { label = 72; break }
      case 71:
        var $_pre80 = (($231 + 8) | 0)
        var $_pre_phi81 = $_pre80; label = 74; break
      case 72:
        var $253 = $231
        var $254 = HEAP32[((56) >> 2)]
        var $255 = ($253 >>> 0) < ($254 >>> 0)
        if ($255) { label = 75; break } else { label = 73; break }
      case 73:
        var $257 = (($231 + 8) | 0)
        var $258 = HEAP32[(($257) >> 2)]
        var $259 = ($258 | 0) === ($16 | 0)
        if ($259) { var $_pre_phi81 = $257; label = 74; break } else { label = 75; break }
      case 74:
        var $_pre_phi81
        var $260 = (($228 + 12) | 0)
        HEAP32[(($260) >> 2)] = $231
        HEAP32[(($_pre_phi81) >> 2)] = $228
        label = 110; break
      case 75:

        throw new Error('Reached an unreachable!')
      case 76:

        throw new Error('Reached an unreachable!')
      case 77:
        var $262 = $15
        var $_sum6 = ((($14) + (16)) | 0)
        var $263 = (($mem + $_sum6) | 0)
        var $264 = $263
        var $265 = HEAP32[(($264) >> 2)]
        var $_sum78 = $14 | 4
        var $266 = (($mem + $_sum78) | 0)
        var $267 = $266
        var $268 = HEAP32[(($267) >> 2)]
        var $269 = ($268 | 0) === ($262 | 0)
        if ($269) { label = 83; break } else { label = 78; break }
      case 78:
        var $271 = (($mem + $14) | 0)
        var $272 = $271
        var $273 = HEAP32[(($272) >> 2)]
        var $274 = $273
        var $275 = HEAP32[((56) >> 2)]
        var $276 = ($274 >>> 0) < ($275 >>> 0)
        if ($276) { label = 82; break } else { label = 79; break }
      case 79:
        var $278 = (($273 + 12) | 0)
        var $279 = HEAP32[(($278) >> 2)]
        var $280 = ($279 | 0) === ($262 | 0)
        if ($280) { label = 80; break } else { label = 82; break }
      case 80:
        var $282 = (($268 + 8) | 0)
        var $283 = HEAP32[(($282) >> 2)]
        var $284 = ($283 | 0) === ($262 | 0)
        if ($284) { label = 81; break } else { label = 82; break }
      case 81:
        HEAP32[(($278) >> 2)] = $268
        HEAP32[(($282) >> 2)] = $273
        var $R7_1 = $268; label = 90; break
      case 82:

        throw new Error('Reached an unreachable!')
      case 83:
        var $_sum10 = ((($14) + (12)) | 0)
        var $287 = (($mem + $_sum10) | 0)
        var $288 = $287
        var $289 = HEAP32[(($288) >> 2)]
        var $290 = ($289 | 0) === 0
        if ($290) { label = 84; break } else { var $R7_0 = $289; var $RP9_0 = $288; label = 85; break }
      case 84:
        var $_sum9 = ((($14) + (8)) | 0)
        var $292 = (($mem + $_sum9) | 0)
        var $293 = $292
        var $294 = HEAP32[(($293) >> 2)]
        var $295 = ($294 | 0) === 0
        if ($295) { var $R7_1 = 0; label = 90; break } else { var $R7_0 = $294; var $RP9_0 = $293; label = 85; break }
      case 85:
        var $RP9_0
        var $R7_0
        var $296 = (($R7_0 + 20) | 0)
        var $297 = HEAP32[(($296) >> 2)]
        var $298 = ($297 | 0) === 0
        if ($298) { label = 86; break } else { var $R7_0 = $297; var $RP9_0 = $296; label = 85; break }
      case 86:
        var $300 = (($R7_0 + 16) | 0)
        var $301 = HEAP32[(($300) >> 2)]
        var $302 = ($301 | 0) === 0
        if ($302) { label = 87; break } else { var $R7_0 = $301; var $RP9_0 = $300; label = 85; break }
      case 87:
        var $304 = $RP9_0
        var $305 = HEAP32[((56) >> 2)]
        var $306 = ($304 >>> 0) < ($305 >>> 0)
        if ($306) { label = 89; break } else { label = 88; break }
      case 88:
        HEAP32[(($RP9_0) >> 2)] = 0
        var $R7_1 = $R7_0; label = 90; break
      case 89:

        throw new Error('Reached an unreachable!')
      case 90:
        var $R7_1
        var $310 = ($265 | 0) === 0
        if ($310) { label = 110; break } else { label = 91; break }
      case 91:
        var $_sum21 = ((($14) + (20)) | 0)
        var $312 = (($mem + $_sum21) | 0)
        var $313 = $312
        var $314 = HEAP32[(($313) >> 2)]
        var $315 = ((344 + ($314 << 2)) | 0)
        var $316 = HEAP32[(($315) >> 2)]
        var $317 = ($262 | 0) === ($316 | 0)
        if ($317) { label = 92; break } else { label = 94; break }
      case 92:
        HEAP32[(($315) >> 2)] = $R7_1
        var $cond69 = ($R7_1 | 0) === 0
        if ($cond69) { label = 93; break } else { label = 100; break }
      case 93:
        var $319 = HEAP32[(($313) >> 2)]
        var $320 = 1 << $319
        var $321 = $320 ^ -1
        var $322 = HEAP32[((44) >> 2)]
        var $323 = $322 & $321
        HEAP32[((44) >> 2)] = $323
        label = 110; break
      case 94:
        var $325 = $265
        var $326 = HEAP32[((56) >> 2)]
        var $327 = ($325 >>> 0) < ($326 >>> 0)
        if ($327) { label = 98; break } else { label = 95; break }
      case 95:
        var $329 = (($265 + 16) | 0)
        var $330 = HEAP32[(($329) >> 2)]
        var $331 = ($330 | 0) === ($262 | 0)
        if ($331) { label = 96; break } else { label = 97; break }
      case 96:
        HEAP32[(($329) >> 2)] = $R7_1
        label = 99; break
      case 97:
        var $334 = (($265 + 20) | 0)
        HEAP32[(($334) >> 2)] = $R7_1
        label = 99; break
      case 98:

        throw new Error('Reached an unreachable!')
      case 99:
        var $337 = ($R7_1 | 0) === 0
        if ($337) { label = 110; break } else { label = 100; break }
      case 100:
        var $339 = $R7_1
        var $340 = HEAP32[((56) >> 2)]
        var $341 = ($339 >>> 0) < ($340 >>> 0)
        if ($341) { label = 109; break } else { label = 101; break }
      case 101:
        var $343 = (($R7_1 + 24) | 0)
        HEAP32[(($343) >> 2)] = $265
        var $_sum22 = ((($14) + (8)) | 0)
        var $344 = (($mem + $_sum22) | 0)
        var $345 = $344
        var $346 = HEAP32[(($345) >> 2)]
        var $347 = ($346 | 0) === 0
        if ($347) { label = 105; break } else { label = 102; break }
      case 102:
        var $349 = $346
        var $350 = HEAP32[((56) >> 2)]
        var $351 = ($349 >>> 0) < ($350 >>> 0)
        if ($351) { label = 104; break } else { label = 103; break }
      case 103:
        var $353 = (($R7_1 + 16) | 0)
        HEAP32[(($353) >> 2)] = $346
        var $354 = (($346 + 24) | 0)
        HEAP32[(($354) >> 2)] = $R7_1
        label = 105; break
      case 104:

        throw new Error('Reached an unreachable!')
      case 105:
        var $_sum23 = ((($14) + (12)) | 0)
        var $357 = (($mem + $_sum23) | 0)
        var $358 = $357
        var $359 = HEAP32[(($358) >> 2)]
        var $360 = ($359 | 0) === 0
        if ($360) { label = 110; break } else { label = 106; break }
      case 106:
        var $362 = $359
        var $363 = HEAP32[((56) >> 2)]
        var $364 = ($362 >>> 0) < ($363 >>> 0)
        if ($364) { label = 108; break } else { label = 107; break }
      case 107:
        var $366 = (($R7_1 + 20) | 0)
        HEAP32[(($366) >> 2)] = $359
        var $367 = (($359 + 24) | 0)
        HEAP32[(($367) >> 2)] = $R7_1
        label = 110; break
      case 108:

        throw new Error('Reached an unreachable!')
      case 109:

        throw new Error('Reached an unreachable!')
      case 110:
        var $371 = $222 | 1
        var $372 = (($p_0 + 4) | 0)
        HEAP32[(($372) >> 2)] = $371
        var $373 = (($189 + $222) | 0)
        var $374 = $373
        HEAP32[(($374) >> 2)] = $222
        var $375 = HEAP32[((60) >> 2)]
        var $376 = ($p_0 | 0) === ($375 | 0)
        if ($376) { label = 111; break } else { var $psize_1 = $222; label = 113; break }
      case 111:
        HEAP32[((48) >> 2)] = $222
        label = 140; break
      case 112:
        var $379 = $194 & -2
        HEAP32[(($193) >> 2)] = $379
        var $380 = $psize_0 | 1
        var $381 = (($p_0 + 4) | 0)
        HEAP32[(($381) >> 2)] = $380
        var $382 = (($189 + $psize_0) | 0)
        var $383 = $382
        HEAP32[(($383) >> 2)] = $psize_0
        var $psize_1 = $psize_0; label = 113; break
      case 113:
        var $psize_1
        var $385 = $psize_1 >>> 3
        var $386 = ($psize_1 >>> 0) < 256
        if ($386) { label = 114; break } else { label = 119; break }
      case 114:
        var $388 = $385 << 1
        var $389 = ((80 + ($388 << 2)) | 0)
        var $390 = $389
        var $391 = HEAP32[((40) >> 2)]
        var $392 = 1 << $385
        var $393 = $391 & $392
        var $394 = ($393 | 0) === 0
        if ($394) { label = 115; break } else { label = 116; break }
      case 115:
        var $396 = $391 | $392
        HEAP32[((40) >> 2)] = $396
        var $_sum19_pre = ((($388) + (2)) | 0)
        var $_pre = ((80 + ($_sum19_pre << 2)) | 0)
        var $F16_0 = $390; var $_pre_phi = $_pre; label = 118; break
      case 116:
        var $_sum20 = ((($388) + (2)) | 0)
        var $398 = ((80 + ($_sum20 << 2)) | 0)
        var $399 = HEAP32[(($398) >> 2)]
        var $400 = $399
        var $401 = HEAP32[((56) >> 2)]
        var $402 = ($400 >>> 0) < ($401 >>> 0)
        if ($402) { label = 117; break } else { var $F16_0 = $399; var $_pre_phi = $398; label = 118; break }
      case 117:

        throw new Error('Reached an unreachable!')
      case 118:
        var $_pre_phi
        var $F16_0
        HEAP32[(($_pre_phi) >> 2)] = $p_0
        var $405 = (($F16_0 + 12) | 0)
        HEAP32[(($405) >> 2)] = $p_0
        var $406 = (($p_0 + 8) | 0)
        HEAP32[(($406) >> 2)] = $F16_0
        var $407 = (($p_0 + 12) | 0)
        HEAP32[(($407) >> 2)] = $390
        label = 140; break
      case 119:
        var $409 = $p_0
        var $410 = $psize_1 >>> 8
        var $411 = ($410 | 0) === 0
        if ($411) { var $I18_0 = 0; label = 122; break } else { label = 120; break }
      case 120:
        var $413 = ($psize_1 >>> 0) > 16777215
        if ($413) { var $I18_0 = 31; label = 122; break } else { label = 121; break }
      case 121:
        var $415 = ((($410) + (1048320)) | 0)
        var $416 = $415 >>> 16
        var $417 = $416 & 8
        var $418 = $410 << $417
        var $419 = ((($418) + (520192)) | 0)
        var $420 = $419 >>> 16
        var $421 = $420 & 4
        var $422 = $421 | $417
        var $423 = $418 << $421
        var $424 = ((($423) + (245760)) | 0)
        var $425 = $424 >>> 16
        var $426 = $425 & 2
        var $427 = $422 | $426
        var $428 = (((14) - ($427)) | 0)
        var $429 = $423 << $426
        var $430 = $429 >>> 15
        var $431 = ((($428) + ($430)) | 0)
        var $432 = $431 << 1
        var $433 = ((($431) + (7)) | 0)
        var $434 = $psize_1 >>> ($433 >>> 0)
        var $435 = $434 & 1
        var $436 = $435 | $432
        var $I18_0 = $436; label = 122; break
      case 122:
        var $I18_0
        var $438 = ((344 + ($I18_0 << 2)) | 0)
        var $439 = (($p_0 + 28) | 0)
        var $I18_0_c = $I18_0
        HEAP32[(($439) >> 2)] = $I18_0_c
        var $440 = (($p_0 + 20) | 0)
        HEAP32[(($440) >> 2)] = 0
        var $441 = (($p_0 + 16) | 0)
        HEAP32[(($441) >> 2)] = 0
        var $442 = HEAP32[((44) >> 2)]
        var $443 = 1 << $I18_0
        var $444 = $442 & $443
        var $445 = ($444 | 0) === 0
        if ($445) { label = 123; break } else { label = 124; break }
      case 123:
        var $447 = $442 | $443
        HEAP32[((44) >> 2)] = $447
        HEAP32[(($438) >> 2)] = $409
        var $448 = (($p_0 + 24) | 0)
        var $_c = $438
        HEAP32[(($448) >> 2)] = $_c
        var $449 = (($p_0 + 12) | 0)
        HEAP32[(($449) >> 2)] = $p_0
        var $450 = (($p_0 + 8) | 0)
        HEAP32[(($450) >> 2)] = $p_0
        label = 136; break
      case 124:
        var $452 = HEAP32[(($438) >> 2)]
        var $453 = ($I18_0 | 0) === 31
        if ($453) { var $458 = 0; label = 126; break } else { label = 125; break }
      case 125:
        var $455 = $I18_0 >>> 1
        var $456 = (((25) - ($455)) | 0)
        var $458 = $456; label = 126; break
      case 126:
        var $458
        var $459 = (($452 + 4) | 0)
        var $460 = HEAP32[(($459) >> 2)]
        var $461 = $460 & -8
        var $462 = ($461 | 0) === ($psize_1 | 0)
        if ($462) { var $T_0_lcssa = $452; label = 133; break } else { label = 127; break }
      case 127:
        var $463 = $psize_1 << $458
        var $T_072 = $452; var $K19_073 = $463; label = 129; break
      case 128:
        var $465 = $K19_073 << 1
        var $466 = (($473 + 4) | 0)
        var $467 = HEAP32[(($466) >> 2)]
        var $468 = $467 & -8
        var $469 = ($468 | 0) === ($psize_1 | 0)
        if ($469) { var $T_0_lcssa = $473; label = 133; break } else { var $T_072 = $473; var $K19_073 = $465; label = 129; break }
      case 129:
        var $K19_073
        var $T_072
        var $471 = $K19_073 >>> 31
        var $472 = (($T_072 + 16 + ($471 << 2)) | 0)
        var $473 = HEAP32[(($472) >> 2)]
        var $474 = ($473 | 0) === 0
        if ($474) { label = 130; break } else { label = 128; break }
      case 130:
        var $476 = $472
        var $477 = HEAP32[((56) >> 2)]
        var $478 = ($476 >>> 0) < ($477 >>> 0)
        if ($478) { label = 132; break } else { label = 131; break }
      case 131:
        HEAP32[(($472) >> 2)] = $409
        var $480 = (($p_0 + 24) | 0)
        var $T_0_c16 = $T_072
        HEAP32[(($480) >> 2)] = $T_0_c16
        var $481 = (($p_0 + 12) | 0)
        HEAP32[(($481) >> 2)] = $p_0
        var $482 = (($p_0 + 8) | 0)
        HEAP32[(($482) >> 2)] = $p_0
        label = 136; break
      case 132:

        throw new Error('Reached an unreachable!')
      case 133:
        var $T_0_lcssa
        var $484 = (($T_0_lcssa + 8) | 0)
        var $485 = HEAP32[(($484) >> 2)]
        var $486 = $T_0_lcssa
        var $487 = HEAP32[((56) >> 2)]
        var $488 = ($486 >>> 0) >= ($487 >>> 0)
        var $489 = $485
        var $490 = ($489 >>> 0) >= ($487 >>> 0)
        var $or_cond = $488 & $490
        if ($or_cond) { label = 134; break } else { label = 135; break }
      case 134:
        var $492 = (($485 + 12) | 0)
        HEAP32[(($492) >> 2)] = $409
        HEAP32[(($484) >> 2)] = $409
        var $493 = (($p_0 + 8) | 0)
        var $_c15 = $485
        HEAP32[(($493) >> 2)] = $_c15
        var $494 = (($p_0 + 12) | 0)
        var $T_0_c = $T_0_lcssa
        HEAP32[(($494) >> 2)] = $T_0_c
        var $495 = (($p_0 + 24) | 0)
        HEAP32[(($495) >> 2)] = 0
        label = 136; break
      case 135:

        throw new Error('Reached an unreachable!')
      case 136:
        var $497 = HEAP32[((72) >> 2)]
        var $498 = ((($497) - (1)) | 0)
        HEAP32[((72) >> 2)] = $498
        var $499 = ($498 | 0) === 0
        if ($499) { var $sp_0_in_i = 496; label = 137; break } else { label = 140; break }
      case 137:
        var $sp_0_in_i
        var $sp_0_i = HEAP32[(($sp_0_in_i) >> 2)]
        var $500 = ($sp_0_i | 0) === 0
        var $501 = (($sp_0_i + 8) | 0)
        if ($500) { label = 138; break } else { var $sp_0_in_i = $501; label = 137; break }
      case 138:
        HEAP32[((72) >> 2)] = -1
        label = 140; break
      case 139:

        throw new Error('Reached an unreachable!')
      case 140:
        return
      default: assert(0, 'bad label: ' + label)
    }
  }
}
function _bitmap_decompress_32 ($output, $output_width, $output_height, $input_width, $input_height, $input, $size) {
  let label = 0
  const sp = STACKTOP; (assert((STACKTOP | 0) < (STACK_MAX | 0)) | 0)
  label = 1
  while (1) {
    switch (label) {
      case 1:
        var $1
        var $2
        var $3
        var $4
        var $5
        var $6
        var $7
        var $temp
        var $rv
        var $y
        var $x
        var $r
        var $g
        var $b
        var $a
        $1 = $output
        $2 = $output_width
        $3 = $output_height
        $4 = $input_width
        $5 = $input_height
        $6 = $input
        $7 = $size
        var $8 = $4
        var $9 = $5
        var $10 = (Math_imul($8, $9) | 0)
        var $11 = ($10 << 2)
        var $12 = _malloc($11)
        $temp = $12
        var $13 = $temp
        var $14 = $4
        var $15 = $5
        var $16 = $6
        var $17 = $7
        var $18 = _bitmap_decompress4($13, $14, $15, $16, $17)
        $rv = $18
        $y = 0
        label = 2; break
      case 2:
        var $20 = $y
        var $21 = $3
        var $22 = ($20 | 0) < ($21 | 0)
        if ($22) { label = 3; break } else { label = 9; break }
      case 3:
        $x = 0
        label = 4; break
      case 4:
        var $25 = $x
        var $26 = $2
        var $27 = ($25 | 0) < ($26 | 0)
        if ($27) { label = 5; break } else { label = 7; break }
      case 5:
        var $29 = $y
        var $30 = $4
        var $31 = (Math_imul($29, $30) | 0)
        var $32 = $x
        var $33 = ((($31) + ($32)) | 0)
        var $34 = ($33 << 2)
        var $35 = $temp
        var $36 = (($35 + $34) | 0)
        var $37 = HEAP8[($36)]
        $r = $37
        var $38 = $y
        var $39 = $4
        var $40 = (Math_imul($38, $39) | 0)
        var $41 = $x
        var $42 = ((($40) + ($41)) | 0)
        var $43 = ($42 << 2)
        var $44 = ((($43) + (1)) | 0)
        var $45 = $temp
        var $46 = (($45 + $44) | 0)
        var $47 = HEAP8[($46)]
        $g = $47
        var $48 = $y
        var $49 = $4
        var $50 = (Math_imul($48, $49) | 0)
        var $51 = $x
        var $52 = ((($50) + ($51)) | 0)
        var $53 = ($52 << 2)
        var $54 = ((($53) + (2)) | 0)
        var $55 = $temp
        var $56 = (($55 + $54) | 0)
        var $57 = HEAP8[($56)]
        $b = $57
        var $58 = $y
        var $59 = $4
        var $60 = (Math_imul($58, $59) | 0)
        var $61 = $x
        var $62 = ((($60) + ($61)) | 0)
        var $63 = ($62 << 2)
        var $64 = ((($63) + (3)) | 0)
        var $65 = $temp
        var $66 = (($65 + $64) | 0)
        var $67 = HEAP8[($66)]
        $a = $67
        var $68 = $r
        var $69 = ($68 & 255)
        var $70 = $69 << 16
        var $71 = -16777216 | $70
        var $72 = $g
        var $73 = ($72 & 255)
        var $74 = $73 << 8
        var $75 = $71 | $74
        var $76 = $b
        var $77 = ($76 & 255)
        var $78 = $75 | $77
        var $79 = $y
        var $80 = $2
        var $81 = (Math_imul($79, $80) | 0)
        var $82 = $x
        var $83 = ((($81) + ($82)) | 0)
        var $84 = $1
        var $85 = $84
        var $86 = (($85 + ($83 << 2)) | 0)
        HEAP32[(($86) >> 2)] = $78
        label = 6; break
      case 6:
        var $88 = $x
        var $89 = ((($88) + (1)) | 0)
        $x = $89
        label = 4; break
      case 7:
        label = 8; break
      case 8:
        var $92 = $y
        var $93 = ((($92) + (1)) | 0)
        $y = $93
        label = 2; break
      case 9:
        var $95 = $temp
        _free($95)
        var $96 = $rv
        STACKTOP = sp; return $96
      default: assert(0, 'bad label: ' + label)
    }
  }
}
