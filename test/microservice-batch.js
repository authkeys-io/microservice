// microservice-batch.coffee
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

const env = require('./env')

process.on('uncaughtException', err => console.error(err))

const microserviceBatch = function (rest) {
  const base = {
    'When we set up a mock Slack server': {
      topic () {
        const { callback } = this
        const slack = http.createServer((req, res) => {
          res.writeHead(200, {
            'Content-Type': 'text/plain',
            'Content-Length': '0'
          }
          )
          return res.end()
        })
        slack.listen(1516, () => callback(null, slack))
        return undefined
      },
      'it works' (err, slack) {
        return assert.ifError(err)
      },
      teardown (slack) {
        const { callback } = this
        slack.once('close', () => callback(null))
        slack.close()
        return undefined
      },
      'and we start a WidgetService': {
        topic () {
          const WidgetService = require('./widgetservice')
          const service = new WidgetService(env)
          service.start(err => {
            if (err) {
              return this.callback(err)
            } else {
              return this.callback(null, service)
            }
          })
          return undefined
        },
        'it works' (err, service) {
          return assert.ifError(err)
        },
        teardown (service) {
          const { callback } = this
          service.stop(err => callback(null))
          return undefined
        }
      }
    }
  }

  const batch = _.clone(base)

  _.assign(batch['When we set up a mock Slack server']['and we start a WidgetService'], rest)

  return batch
}

microserviceBatch.appKey = env.APP_KEY_UNIT_TEST

module.exports = microserviceBatch
