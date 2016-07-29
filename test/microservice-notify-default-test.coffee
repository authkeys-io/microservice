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

microserviceBatch = require './microservice-batch'

process.on 'uncaughtException', (err) ->
  console.error err

vows
  .describe('notify default endpoint')
  .addBatch microserviceBatch
    'and we try to cause a "bar" message':
      topic: (service, slack) ->
        callback = @callback
        async.parallel [
          (callback) ->
            slack.once 'request', (req, res) ->
              if req.url == '/default'
                callback null
              else
                callback new Error("Should ping /default, got #{req.url}")
          (callback) ->
            options =
              url: 'http://localhost:2342/message'
              json:
                message: "My dog also has fleas"
                type: "bar"
              headers:
                authorization: "Bearer #{microserviceBatch.appKey}"
            request.post options, (err, response, body) ->
              if err
                callback err
              else
                callback null, body
        ], (err) ->
          if err
            callback err
          else
            callback null
        undefined
      'it works': (err) ->
        assert.ifError err
  .export(module)
