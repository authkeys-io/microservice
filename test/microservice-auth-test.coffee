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

_ = require 'lodash'
vows = require 'vows'
assert = require 'assert'
request = require 'request'

Widget = require './widget'
WidgetService = require './widgetservice'

APP_KEY = "soothlesseecovezqislam"
BAD_KEY = "thisisabadkey"

process.on 'uncaughtException', (err) ->
  process.stderr.write require('util').inspect(err) + "\n"

vows
  .describe('microservice unit test')
  .addBatch
    'When we instantiate a microservice':
        topic: ->
          callback = @callback
          try
            env =
              PORT: "2342"
              HOSTNAME: "localhost"
              DRIVER: "memory"
              LOG_FILE: "/dev/null"
              APP_KEY_UNIT_TEST: APP_KEY
            service = new WidgetService env
            callback null, service
          catch err
            callback err
          undefined
        'it works': (err, service) ->
          assert.ifError err
        'and we start the service':
          topic: (service) ->
            callback = @callback
            service.start (err) ->
              if err
                callback err
              else
                callback null
            undefined
          'it works': (err) ->
            assert.ifError err
          teardown: (server) ->
            callback = @callback
            server.stop (err) ->
              callback null
            undefined
          'and we request the list of widgets without any auth':
            topic: () ->
              callback = @callback
              url = 'http://localhost:2342/widget'
              request.get url, (err, response, body) ->
                if err
                  callback err
                else if response.statusCode != 401
                  callback new Error("Unexpected status code #{response.statusCode}")
                else
                  callback null
              undefined
            'it fails correctly': (err) ->
              assert.ifError err
          'and we request the list of widgets with bad Authorization header':
            topic: () ->
              callback = @callback
              options =
                url: 'http://localhost:2342/widget'
                headers:
                  authorization: "Bearer #{BAD_KEY}"
              request.get options, (err, response, body) ->
                if err
                  callback err
                else if response.statusCode != 403
                  callback new Error("Unexpected status code #{response.statusCode}")
                else
                  callback null
              undefined
            'it fails correctly': (err) ->
              assert.ifError err
          'and we request the list of widgets with the Authorization header':
            topic: () ->
              callback = @callback
              options =
                url: 'http://localhost:2342/widget'
                headers:
                  authorization: "Bearer #{APP_KEY}"
              request.get options, (err, response, body) ->
                if err
                  callback err
                else if response.statusCode != 200
                  callback new Error("Unexpected status code #{response.statusCode}")
                else
                  results = JSON.parse(body)
                  callback null, results
              undefined
          'and we request the list of widgets with a good access_token parameter':
            topic: () ->
              callback = @callback
              options =
                url: "http://localhost:2342/widget?access_token=#{APP_KEY}"
              request.get options, (err, response, body) ->
                if err
                  callback err
                else if response.statusCode != 200
                  callback new Error("Unexpected status code #{response.statusCode}")
                else
                  results = JSON.parse(body)
                  callback null, results
              undefined
            'it works': (err, widgets) ->
              assert.ifError err
            'it is an array': (err, widgets) ->
              assert.ifError err
              assert.isArray widgets
          'and we request the list of widgets with a bad access_token parameter':
            topic: () ->
              callback = @callback
              options =
                url: "http://localhost:2342/widget?access_token=#{BAD_KEY}"
              request.get options, (err, response, body) ->
                if err
                  callback err
                else if response.statusCode != 403
                  callback new Error("Unexpected status code #{response.statusCode}")
                else
                  callback null
              undefined
            'it fails correctly': (err) ->
              assert.ifError err


  .export(module)
