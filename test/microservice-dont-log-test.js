// Copyright 2017 Fuzzy.ai
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//    http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.

const http = require('http')

const _ = require('lodash')
const vows = require('vows')
const assert = require('assert')
const async = require('async')
const request = require('request')
const debug = require('debug')('microservice:microservice-dont-log-test')

const microserviceBatch = require('./microservice-batch')

process.on('uncaughtException', err => console.error(err))

vows
  .describe('dontLog middleware')
  .addBatch(microserviceBatch({
    'and we hit an URL with no logging': {
      topic () {
        debug('Called')
        const { callback } = this
        debug('Starting request')
        request.get('http://localhost:2342/health', (err, response, body) => {
          debug('Finished request')
          if (err) {
            return callback(err)
          } else if ((response != null ? response.statusCode : undefined) !== 200) {
            return callback(new Error(`Bad status code: ${(response != null ? response.statusCode : undefined)}`))
          } else {
            return callback(null)
          }
        })
        return undefined
      },
      'it works' (err) {
        debug('Called test')
        return assert.ifError(err)
      }
    }
  })).export(module)
