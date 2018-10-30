/**
 * sftp read/write file
 */

/*
const fs = require('fs')
const _ = require('lodash')
const {Readable, Writable} = require('stream')

function createReadStreamFromString(str) {
  const s = new Readable()
  s._read = () => {}
  s.push(str)
  s.push(null)
  return s
}


class FakeWrite extends Writable {
  constructor (opts) {
    super(opts)
    this.opts = opts
  }

  _write (data, encoding, done) {
    this.opts.onData(data)
    done()
  }
}
*/
