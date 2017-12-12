// Copyright 2016 Fuzzy.ai
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//    http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.

const http = require('http');

const _ = require('lodash');
const vows = require('vows');
const assert = require('assert');
const async = require('async');
const request = require('request');

const microserviceBatch = require('./microservice-batch');

process.on('uncaughtException', err => console.error(err));

vows
  .describe('generate a weird error')
  .addBatch(microserviceBatch({
    'and we hit an URL with no route': {
      topic() {
        const { callback } = this;
        const options = {
          url: 'http://localhost:2342/no-route-exist',
          headers: {
            authorization: `Bearer ${microserviceBatch.appKey}`
          }
        };
        request.get(options, function(err, response, body) {
          const sc = response != null ? response.statusCode : undefined;
          const ct = __guard__(response != null ? response.headers : undefined, x => x['content-type']);
          if (err) {
            return callback(err);
          } else if (sc !== 404) {
            return callback(new Error(`Unexpected status code: ${sc} (${body})`));
          } else if ((ct == null)) {
            return callback(new Error("No content type for response"));
          } else if (!ct.match(/^application\/json/)) {
            return callback(new Error(`${ct} is not JSON`));
          } else {
            const results = JSON.parse(body);
            return callback(null, results);
          }
        });
        return undefined;
      },
      'it works'(err, body) {
        assert.ifError(err);
        assert.isObject(body);
        assert.isString(body.status);
        return assert.equal(body.status, "error");
      }
    }
  })).export(module);

function __guard__(value, transform) {
  return (typeof value !== 'undefined' && value !== null) ? transform(value) : undefined;
}
