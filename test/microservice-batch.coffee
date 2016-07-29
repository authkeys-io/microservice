# microservice-batch.coffee
# Copyright 2016 Fuzzy.ai
#
# Licensed under the Apache License, Version 2.0 (the "License");
# you may not use this file except in compliance with the License.
# You may obtain a copy of the License at
#
#    http://www.apache.org/licenses/LICENSE-2.0
#
# Unless required by applicable law or agreed to in writing, software
# distributed under the License is distributed on an "AS IS" BASIS,
# WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
# See the License for the specific language governing permissions and
# limitations under the License.

http = require 'http'

_ = require 'lodash'
vows = require 'vows'
assert = require 'assert'
async = require 'async'
request = require 'request'

env = require './env'

process.on 'uncaughtException', (err) ->
  console.error err

microserviceBatch = (rest) ->
  base =
    'When we set up a mock Slack server':
      topic: ->
        callback = @callback
        slack = http.createServer (req, res) ->
          res.writeHead 200,
            'Content-Type': 'text/plain'
            'Content-Length': '0'
          res.end()
        slack.listen 1516, () ->
          callback null, slack
        undefined
      'it works': (err, slack) ->
        assert.ifError err
      teardown: (slack) ->
        callback = @callback
        slack.once 'close', ->
          callback null
        slack.close()
        undefined
      'and we start a WidgetService':
        topic: ->
          WidgetService = require './widgetservice'
          service = new WidgetService env
          service.start (err) =>
            if err
              @callback err
            else
              @callback null, service
          undefined
        'it works': (err, service) ->
          assert.ifError err
        teardown: (service) ->
          callback = @callback
          service.stop (err) ->
            callback null
          undefined

  batch = _.clone(base)

  _.assign batch['When we set up a mock Slack server']['and we start a WidgetService'], rest

  batch

microserviceBatch.appKey = env.APP_KEY_UNIT_TEST

module.exports = microserviceBatch
