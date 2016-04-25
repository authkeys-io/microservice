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

microserviceBatch = require './microservice-batch'

process.on 'uncaughtException', (err) ->
  console.error err

vows
  .describe('generate a weird error')
  .addBatch microserviceBatch
    'and we hit an URL with no route':
      topic: ->
        callback = @callback
        options =
          url: 'http://localhost:2342/no-route-exist'
          headers:
            authorization: "Bearer #{microserviceBatch.appKey}"
        request.get options, (err, response, body) ->
          sc = response?.statusCode
          ct = response?.headers?['content-type']
          if err
            callback err
          else if sc != 404
            callback new Error("Unexpected status code: #{sc}")
          else if !ct?
            callback new Error("No content type for response")
          else if !ct.match(/^application\/json/)
            callback new Error("#{ct} is not JSON")
          else
            results = JSON.parse(body)
            callback null, results
        undefined
      'it works': (err, body) ->
        assert.ifError err
        assert.isObject body
        assert.isString body.status
        assert.equal body.status, "error"

  .export(module)
