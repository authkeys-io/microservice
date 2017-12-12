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

const _ = require('lodash');
const vows = require('vows');
const assert = require('assert');
const request = require('request');

const Widget = require('./widget');
const WidgetService = require('./widgetservice');

const microserviceBatch = require('./microservice-batch');
const env = require('./env');

const BAD_KEY = "sceneaqethyl1776podia";

process.on('uncaughtException', err => process.stderr.write(require('util').inspect(err) + "\n"));

const authfail = function(key) {
  const batch = {
    topic() {
      const { callback } = this;
      const options = {
        url: 'http://localhost:2342/widget',
        headers: {
          authorization: `Bearer ${key}`
        }
      };
      request.get(options, function(err, response, body) {
        const wa = __guard__(response != null ? response.headers : undefined, x => x['www-authenticate']);
        if (err) {
          return callback(err);
        } else if (response.statusCode !== 401) {
          return callback(new Error(`Unexpected code ${response.statusCode}`));
        } else if (wa !== "Bearer") {
          return callback(new Error(`Wrong WWW-Authenticate header: ${wa}`));
        } else {
          return callback(null);
        }
      });
      return undefined;
    },
    'it fails correctly'(err) {
      return assert.ifError(err);
    }
  };
  return batch;
};

const authsucc = function(key) {
  const batch = {
    topic() {
      const { callback } = this;
      const options = {
        url: 'http://localhost:2342/widget',
        headers: {
          authorization: `Bearer ${key}`
        }
      };
      request.get(options, function(err, response, body) {
        if (err) {
          return callback(err);
        } else if (response.statusCode !== 200) {
          return callback(new Error(`Unexpected code ${response.statusCode}`));
        } else {
          const results = JSON.parse(body);
          return callback(null, results);
        }
      });
      return undefined;
    },
    'it works'(err, results) {
      return assert.ifError(err);
    }
  };
  return batch;
};

const qsucc = function(key) {
  const batch = {
    topic() {
      const { callback } = this;
      const options =
        {url: `http://localhost:2342/widget?access_token=${key}`};
      request.get(options, function(err, response, body) {
        if (err) {
          return callback(err);
        } else if (response.statusCode !== 200) {
          return callback(new Error(`Unexpected code ${response.statusCode}`));
        } else {
          const results = JSON.parse(body);
          return callback(null, results);
        }
      });
      return undefined;
    },
    'it works'(err, widgets) {
      return assert.ifError(err);
    },
    'it is an array'(err, widgets) {
      assert.ifError(err);
      return assert.isArray(widgets);
    }
  };
  return batch;
};

const qfail = function(key) {
  const batch = {
    topic() {
      const { callback } = this;
      const options =
        {url: `http://localhost:2342/widget?access_token=${key}`};
      request.get(options, function(err, response, body) {
        const wa = __guard__(response != null ? response.headers : undefined, x => x['www-authenticate']);
        if (err) {
          return callback(err);
        } else if (response.statusCode !== 401) {
          return callback(new Error(`Unexpected code ${response.statusCode}`));
        } else if (wa !== "Bearer") {
          return callback(new Error(`Wrong WWW-Authenticate header: ${wa}`));
        } else {
          return callback(null);
        }
      });
      return undefined;
    },
    'it fails correctly'(err) {
      return assert.ifError(err);
    }
  };
  return batch;
};

vows
  .describe('authentication')
  .addBatch(microserviceBatch({
    'and we request the list of widgets without any auth': {
      topic() {
        const { callback } = this;
        const url = 'http://localhost:2342/widget';
        request.get(url, function(err, response, body) {
          if (err) {
            return callback(err);
          } else if (response.statusCode !== 401) {
            return callback(new Error(`Unexpected code ${response.statusCode}`));
          } else {
            return callback(null);
          }
        });
        return undefined;
      },
      'it fails correctly'(err) {
        return assert.ifError(err);
      }
    },
    'and we request the list of widgets with bad Authorization header':
      authfail(BAD_KEY),
    'and we request the list of widgets with the Authorization header':
      authsucc(microserviceBatch.appKey),
    'and we request the list of widgets with a good access_token parameter':
      qsucc(microserviceBatch.appKey),
    'and we request the list of widgets with a bad access_token parameter':
      qfail(BAD_KEY),
    'and we use a key with underscores in the Authorization header':
      authsucc(env.APP_KEY_UNDERSCORE),
    'and we use a key with underscores as an access_token parameter':
      qsucc(env.APP_KEY_UNDERSCORE),
    'and we use a key with periods in the Authorization header':
      authsucc(env.APP_KEY_PERIOD),
    'and we use a key with periods as an access_token parameter':
      qsucc(env.APP_KEY_PERIOD),
    'and we use a key with slashes in the Authorization header':
      authsucc(env.APP_KEY_SLASH),
    'and we use a key with slashes as an access_token parameter':
      qsucc(env.APP_KEY_SLASH)
  })).export(module);

function __guard__(value, transform) {
  return (typeof value !== 'undefined' && value !== null) ? transform(value) : undefined;
}