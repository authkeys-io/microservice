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

APP_KEY = "soothlesseecovezqislam"

process.on 'uncaughtException', (err) ->
  console.error err

vows
  .describe('notify on error')
  .addBatch microserviceBatch
    'and we generate a server error':
      topic: (service, slack) ->
        callback = @callback
        async.parallel [
          (callback) ->
            slack.once 'request', (req, res) ->
              if req.url == '/error'
                callback null
              else
                callback new Error("Should ping /error, got #{req.url}")
          (callback) ->
            options =
              url: 'http://localhost:2342/error/500?message=Server+error'
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
      'and we generate a client error':
        topic: (service, slack) ->
          callback = @callback
          async.parallel [
            (callback) ->
              pinged = false
              to = null
              slack.once 'request', (req, res) ->
                if req.url == '/error'
                  pinged = true
                  clearTimeout to
                  callback new Error("Was pinged")
              checkPinged = ->
                if !pinged
                  callback null
              to = setTimeout checkPinged, 4000
            (callback) ->
              options =
                url: 'http://localhost:2342/error/400?message=Client+error'
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
