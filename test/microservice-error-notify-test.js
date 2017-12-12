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

const vows = require('perjury')
const {assert} = vows
const async = require('async')
const request = require('request')

const microserviceBatch = require('./microservice-batch')

process.on('uncaughtException', err => console.error(err))

vows
  .describe('notify on error')
  .addBatch(microserviceBatch({
    'and we generate a server error': {
      topic (service, slack) {
        const { callback } = this
        async.parallel([
          callback =>
            slack.once('request', (req, res) => {
              if (req.url === '/error') {
                return callback(null)
              } else {
                return callback(new Error(`Should ping /error, got ${req.url}`))
              }
            }),
          function (callback) {
            const options = {
              url: 'http://localhost:2342/error/500?message=Server+error',
              headers: {
                authorization: `Bearer ${microserviceBatch.appKey}`
              }
            }
            return request.get(options, (err, response, body) => {
              if (err) {
                return callback(err)
              } else {
                const results = JSON.parse(body)
                return callback(null, results)
              }
            })
          }
        ], (err) => {
          if (err) {
            return callback(err)
          } else {
            return callback(null)
          }
        })
        return undefined
      },
      'it works' (err) {
        return assert.ifError(err)
      },
      'and we generate a client error': {
        topic (service, slack) {
          const { callback } = this
          async.parallel([
            function (callback) {
              let pinged = false
              let to = null
              slack.once('request', (req, res) => {
                if (req.url === '/error') {
                  pinged = true
                  clearTimeout(to)
                  return callback(new Error('Was pinged'))
                }
              })
              const checkPinged = function () {
                if (!pinged) {
                  return callback(null)
                }
              }
              to = setTimeout(checkPinged, 4000)
              return to
            },
            function (callback) {
              const options = {
                url: 'http://localhost:2342/error/400?message=Client+error',
                headers: {
                  authorization: `Bearer ${microserviceBatch.appKey}`
                }
              }
              return request.get(options, (err, response, body) => {
                if (err) {
                  return callback(err)
                } else {
                  const results = JSON.parse(body)
                  return callback(null, results)
                }
              })
            }
          ], (err) => {
            if (err) {
              return callback(err)
            } else {
              return callback(null)
            }
          })
          return undefined
        },
        'it works' (err) {
          return assert.ifError(err)
        }
      }
    }
  })).export(module)
