# Copyright 2017 Fuzzy.ai
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
debug = require('debug')('microservice:microservice-dont-log-test')

microserviceBatch = require './microservice-batch'

process.on 'uncaughtException', (err) ->
  console.error err

vows
  .describe('dontLog middleware')
  .addBatch microserviceBatch
    'and we hit an URL with no logging':
      topic: ->
        debug "Called"
        callback = @callback
        debug "Starting request"
        request.get 'http://localhost:2342/health', (err, response, body) ->
          debug "Finished request"
          if err
            callback err
          else if response?.statusCode != 200
            callback new Error("Bad status code: #{response?.statusCode}")
          else
            callback null
        undefined
      'it works': (err) ->
        debug 'Called test'
        assert.ifError err
  .export(module)
