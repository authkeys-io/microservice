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

const microserviceBatch = require('./microservice-batch')
const env = require('./env')

process.on('uncaughtException', err => console.error(err))

vows
  .describe('notify timing stats')
  .addBatch(microserviceBatch({
    'and we watch for timing information': {
      topic (service, slack) {
        const giveUp = () => {
          slack.removeAllListeners('request')
          return this.callback(new Error('No timing message received'))
        }
        slack.once('request', (req, res) => {
          if (req.url === '/timing') {
            clearTimeout(to)
            return this.callback(null)
          }
        })
        const to = setTimeout(giveUp, parseInt(env.TIMING_INTERVAL, 10) * 2)
        return undefined
      },
      'it works' (err) {
        return assert.ifError(err)
      }
    }
  })).export(module)
