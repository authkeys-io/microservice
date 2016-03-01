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

process.on 'uncaughtException', (err) ->
  console.error err

vows
  .describe('microservice basics')
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
            service = new WidgetService env
            callback null, service
          catch err
            callback err
          undefined
        'it works': (err, service) ->
          assert.ifError err
        'it is an object': (err, service) ->
          assert.ifError err
          assert.isObject service
        'it has a start() method': (err, service) ->
          assert.ifError err
          assert.isObject service
          assert.isFunction service.start
        'it has a stop() method': (err, service) ->
          assert.ifError err
          assert.isObject service
          assert.isFunction service.stop
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
          'and we request the version':
            topic: () ->
              callback = @callback
              url = 'http://localhost:2342/version'
              request.get url, (err, response, body) ->
                if err
                  callback err
                else if response.statusCode != 200
                  callback new Error("Bad status code #{response.statusCode}")
                else
                  body = JSON.parse body
                  callback null, body
              undefined
            'it works': (err, version) ->
              assert.ifError err
            'it looks correct': (err, version) ->
              assert.ifError err
              assert.include version, "version"
              assert.include version, "name"
            'and we stop the server':
              topic: (version, server) ->
                callback = @callback
                server.stop (err) ->
                  if err
                    callback err
                  else
                    callback null
                undefined
              'it works': (err) ->
                assert.ifError err
              'and we request the version':
                topic: ->
                  callback = @callback
                  url = 'http://localhost:2342/version'
                  request.get url, (err, response, body) ->
                    if err
                      callback null
                    else
                      callback new Error("Unexpected success after server stop")
                  undefined
                'it fails correctly': (err) ->
                  assert.ifError err
  .export(module)
