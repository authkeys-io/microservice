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

const WidgetService = require('./widgetservice')

class BadWidgetService extends WidgetService {
  getSchema () {
    return null
  }
}

process.on('uncaughtException', err => console.error(err))

vows
  .describe('test for microservices without a getSchema()')
  .addBatch({
    'When we instantiate a microservice without a getSchema() method': {
      topic () {
        const { callback } = this
        try {
          const env = {
            PORT: '2342',
            HOSTNAME: 'localhost',
            DRIVER: 'memory',
            LOG_FILE: '/dev/null'
          }
          const service = new BadWidgetService(env)
          callback(null, service)
        } catch (err) {
          callback(err)
        }
        return undefined
      },
      'it works' (err, service) {
        return assert.ifError(err)
      },
      'and we start the service': {
        topic (service) {
          const { callback } = this
          service.start((err) => {
            if (err) {
              return callback(null, err)
            } else {
              return callback(new Error('Unexpected success'))
            }
          })
          return undefined
        },
        'it fails correctly' (err, received) {
          assert.ifError(err)
          const msg = 'No schema defined for this microservice class'
          return assert.equal(received.message, msg)
        }
      }
    }}).export(module)
