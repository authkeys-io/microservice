// Copyright 2016 Fuzzy.ai
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

const microserviceBatch = require('./microservice-batch')

process.on('uncaughtException', err => console.error(err))

vows
  .describe('Use OPTIONS on an endpoint')
  .addBatch(microserviceBatch({
    'and we use OPTIONS on an URL': {
      topic () {
        const { callback } = this
        const options = {
          method: 'OPTIONS',
          url: 'http://localhost:2342/version',
          headers: {
            authorization: `Bearer ${microserviceBatch.appKey}`
          }
        }
        request(options, (err, response, body) => {
          const sc = response != null ? response.statusCode : undefined
          if (err) {
            return callback(err)
          } else if (sc !== 200) {
            return callback(new Error(`Unexpected status code: ${sc}`))
          } else {
            return callback(null, response.headers.allow, body)
          }
        })
        return undefined
      },
      'it works' (err, allow, body) {
        assert.ifError(err)
        assert.equal(allow, 'GET,HEAD')
        return assert.equal(body, 'GET,HEAD')
      }
    }
  })).export(module)
