# Copyright 2016 Fuzzy.io
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

APP_KEY = "soothlesseecovezqislam"

process.on 'uncaughtException', (err) ->
  console.error err

vows
  .describe('notify')
  .addBatch
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
          env =
            SLACK_HOOK: "http://localhost:1516/post-message"
            PORT: "2342"
            DRIVER: "memory"
            HOSTNAME: "localhost"
            LOG_FILE: "/dev/null"
            APP_KEY_UNIT_TEST: APP_KEY
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
        'and we ping it':
          topic: (service, slack) ->
            callback = @callback
            async.parallel [
              (callback) ->
                slack.once 'request', (req, res) ->
                  callback null
              (callback) ->
                options =
                  url: 'http://localhost:2342/widget/does-not-exist'
                  headers:
                    authorization: "Bearer #{APP_KEY}"
                request.get options, (err, response, body) ->
                  if err
                    callback err
                  else
                    results = JSON.parse(body)
                    callback null, results
            ], (err) ->
              if err
                callback err
              else
                callback null
            undefined
          'it works': (err) ->
            assert.ifError err
  .export(module)
