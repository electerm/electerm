global.Promise = require('bluebird')
require('dotenv').config()
require('@babel/register')
require('./app')
