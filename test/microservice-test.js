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

const _ = require('lodash')
const vows = require('vows')
const assert = require('assert')
const request = require('request')

const Widget = require('./widget')
const WidgetService = require('./widgetservice')

process.on('uncaughtException', err => console.error(err))

vows
  .describe('microservice basics')
  .addBatch({
    'When we instantiate a microservice': {
      topic () {
        const { callback } = this
        try {
          const env = {
            PORT: '2342',
            HOSTNAME: 'localhost',
            DRIVER: 'memory',
            LOG_FILE: '/dev/null'
          }
          const service = new WidgetService(env)
          callback(null, service)
        } catch (err) {
          callback(err)
        }
        return undefined
      },
      'it works' (err, service) {
        return assert.ifError(err)
      },
      'it is an object' (err, service) {
        assert.ifError(err)
        return assert.isObject(service)
      },
      'it has a start() method' (err, service) {
        assert.ifError(err)
        assert.isObject(service)
        return assert.isFunction(service.start)
      },
      'it has a stop() method' (err, service) {
        assert.ifError(err)
        assert.isObject(service)
        return assert.isFunction(service.stop)
      },
      'and we start the service': {
        topic (service) {
          const { callback } = this
          service.start((err) => {
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
        'and we request the version': {
          topic () {
            const { callback } = this
            const url = 'http://localhost:2342/version'
            request.get(url, (err, response, body) => {
              if (err) {
                return callback(err)
              } else if (response.statusCode !== 200) {
                return callback(new Error(`Bad status code ${response.statusCode}`))
              } else {
                body = JSON.parse(body)
                return callback(null, body)
              }
            })
            return undefined
          },
          'it works' (err, version) {
            return assert.ifError(err)
          },
          'it looks correct' (err, version) {
            assert.ifError(err)
            assert.include(version, 'version')
            return assert.include(version, 'name')
          },
          'and we stop the server': {
            topic (version, server) {
              const { callback } = this
              server.stop((err) => {
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
            'and we request the version': {
              topic () {
                const { callback } = this
                const url = 'http://localhost:2342/version'
                request.get(url, (err, response, body) => {
                  if (err) {
                    return callback(null)
                  } else {
                    return callback(new Error('Unexpected success after server stop'))
                  }
                })
                return undefined
              },
              'it fails correctly' (err) {
                return assert.ifError(err)
              }
            }
          }
        }
      }
    }}).export(module)
