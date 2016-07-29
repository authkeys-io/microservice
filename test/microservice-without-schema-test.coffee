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

_ = require 'lodash'
vows = require 'vows'
assert = require 'assert'
request = require 'request'

Widget = require './widget'
WidgetService = require './widgetservice'

class BadWidgetService extends WidgetService
  getSchema: ->
    null

process.on 'uncaughtException', (err) ->
  console.error err

vows
  .describe('test for microservices without a getSchema()')
  .addBatch
    'When we instantiate a microservice without a getSchema() method':
      topic: ->
        callback = @callback
        try
          env =
            PORT: "2342"
            HOSTNAME: "localhost"
            DRIVER: "memory"
            LOG_FILE: "/dev/null"
          service = new BadWidgetService env
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
              callback null, err
            else
              callback new Error("Unexpected success")
          undefined
        'it fails correctly': (err, received) ->
          assert.ifError err
          msg = "No schema defined for this microservice class"
          assert.equal received.message, msg
  .export(module)
