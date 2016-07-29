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

microserviceBatch = require './microservice-batch'
env = require './env'

BAD_KEY = "sceneaqethyl1776podia"

process.on 'uncaughtException', (err) ->
  process.stderr.write require('util').inspect(err) + "\n"

authfail = (key) ->
  batch =
    topic: () ->
      callback = @callback
      options =
        url: 'http://localhost:2342/widget'
        headers:
          authorization: "Bearer #{key}"
      request.get options, (err, response, body) ->
        wa = response?.headers?['www-authenticate']
        if err
          callback err
        else if response.statusCode != 401
          callback new Error("Unexpected code #{response.statusCode}")
        else if wa != "Bearer"
          callback new Error("Wrong WWW-Authenticate header: #{wa}")
        else
          callback null
      undefined
    'it fails correctly': (err) ->
      assert.ifError err
  batch

authsucc = (key) ->
  batch =
    topic: () ->
      callback = @callback
      options =
        url: 'http://localhost:2342/widget'
        headers:
          authorization: "Bearer #{key}"
      request.get options, (err, response, body) ->
        if err
          callback err
        else if response.statusCode != 200
          callback new Error("Unexpected code #{response.statusCode}")
        else
          results = JSON.parse(body)
          callback null, results
      undefined
    'it works': (err, results) ->
      assert.ifError err
  batch

qsucc = (key) ->
  batch =
    topic: () ->
      callback = @callback
      options =
        url: "http://localhost:2342/widget?access_token=#{key}"
      request.get options, (err, response, body) ->
        if err
          callback err
        else if response.statusCode != 200
          callback new Error("Unexpected code #{response.statusCode}")
        else
          results = JSON.parse(body)
          callback null, results
      undefined
    'it works': (err, widgets) ->
      assert.ifError err
    'it is an array': (err, widgets) ->
      assert.ifError err
      assert.isArray widgets
  batch

qfail = (key) ->
  batch =
    topic: () ->
      callback = @callback
      options =
        url: "http://localhost:2342/widget?access_token=#{key}"
      request.get options, (err, response, body) ->
        wa = response?.headers?['www-authenticate']
        if err
          callback err
        else if response.statusCode != 401
          callback new Error("Unexpected code #{response.statusCode}")
        else if wa != "Bearer"
          callback new Error("Wrong WWW-Authenticate header: #{wa}")
        else
          callback null
      undefined
    'it fails correctly': (err) ->
      assert.ifError err
  batch

vows
  .describe('authentication')
  .addBatch microserviceBatch
    'and we request the list of widgets without any auth':
      topic: () ->
        callback = @callback
        url = 'http://localhost:2342/widget'
        request.get url, (err, response, body) ->
          if err
            callback err
          else if response.statusCode != 401
            callback new Error("Unexpected code #{response.statusCode}")
          else
            callback null
        undefined
      'it fails correctly': (err) ->
        assert.ifError err
    'and we request the list of widgets with bad Authorization header':
      authfail BAD_KEY
    'and we request the list of widgets with the Authorization header':
      authsucc microserviceBatch.appKey
    'and we request the list of widgets with a good access_token parameter':
      qsucc microserviceBatch.appKey
    'and we request the list of widgets with a bad access_token parameter':
      qfail BAD_KEY
    'and we use a key with underscores in the Authorization header':
      authsucc env.APP_KEY_UNDERSCORE
    'and we use a key with underscores as an access_token parameter':
      qsucc env.APP_KEY_UNDERSCORE
    'and we use a key with periods in the Authorization header':
      authsucc env.APP_KEY_PERIOD
    'and we use a key with periods as an access_token parameter':
      qsucc env.APP_KEY_PERIOD
    'and we use a key with slashes in the Authorization header':
      authsucc env.APP_KEY_SLASH
    'and we use a key with slashes as an access_token parameter':
      qsucc env.APP_KEY_SLASH

  .export(module)
