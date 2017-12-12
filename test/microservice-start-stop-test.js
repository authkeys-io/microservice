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

const async = require('async')
const vows = require('perjury')
const {assert} = vows

const WidgetService = require('./widgetservice')

const APP_KEY = 'soothlesseecovezqislam'

process.on('uncaughtException', err => process.stderr.write(`${require('util').inspect(err)}\n`))

vows
  .describe('start-stop-start-stop')
  .addBatch({
    'When we instantiate a microservice': {
      topic () {
        const { callback } = this
        try {
          const env = {
            PORT: '2342',
            HOSTNAME: 'localhost',
            DRIVER: 'memory',
            LOG_FILE: '/dev/null',
            APP_KEY_UNIT_TEST: APP_KEY
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
      'and we start and stop the service a few times': {
        topic (service) {
          const { callback } = this
          async.waterfall([
            callback => service.start(callback),
            callback => service.stop(callback),
            callback => service.start(callback),
            callback => service.stop(callback),
            callback => service.start(callback),
            callback => service.stop(callback)
          ], callback)
          return undefined
        },
        'it works' (err) {
          return assert.ifError(err)
        }
      }
    }}).export(module)
