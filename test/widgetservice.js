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

const Microservice = require('../lib/microservice');
const Widget = require('./widget');

class WidgetService extends Microservice {
  getSchema() {
    return { widget: Widget.schema };
  }

  setupParams(exp) {
    exp.param('code', (req, res, next, id) => {
      req.errorCode = id;
      setImmediate(next);
    });

    return exp.param('id', (req, res, next, id) =>
      Widget.get(id, (err, widget) => {
        if (err) {
          setImmediate(next, err);
        } else {
          req.widget = widget;
          setImmediate(next);
        }
      })
    );
  }

  setupRoutes(exp) {
    const appAuthc = this.appAuthc.bind(this);
    const dontLog = this.dontLog.bind(this);

    exp.get('/version', (req, res, next) => res.json({ name: 'widget', version: '0.1.0' }));

    exp.post('/widget', appAuthc, (req, res, next) =>
      Widget.create(req.body, (err, widget) => {
        if (err) {
          setImmediate(next, err);
        } else {
          return res.json(widget);
        }
      })
    );

    exp.get('/widget', appAuthc, (req, res, next) => {
      const allWidgets = [];
      const addWidget = widget => allWidgets.push(widget);
      return Widget.scan(addWidget, err => {
        if (err) {
          setImmediate(next, err);
        } else {
          return res.json(allWidgets);
        }
      });
    });

    exp.get('/widget/:id', appAuthc, (req, res, next) => res.json(req.widget));

    exp.put('/widget/:id', appAuthc, (req, res, next) => {});

    exp.patch('/widget/:id', appAuthc, (req, res, next) => {
      _.extend(req.widget, req.body);
      return req.widget.save((err, saved) => {
        if (err) {
          setImmediate(next, err);
        } else {
          return res.json(saved);
        }
      });
    });

    exp.delete('/widget/:id', appAuthc, (req, res, next) =>
      req.widget.del(err => {
        if (err) {
          setImmediate(next, err);
        } else {
          return res.json({ status: 'OK' });
        }
      })
    );

    // For generating slack messages

    exp.post('/message', appAuthc, (req, res, next) => {
      const { type, message } = req.body;
      return this.slackMessage(type, message, err => {
        if (err) {
          setImmediate(next, err);
        } else {
          return res.json({ type, message, status: 'OK' });
        }
      });
    });

    // For causing errors

    exp.get('/error/:code', appAuthc, (req, res, next) => {
      const message = req.query.message || 'Error';
      const code = parseInt(req.errorCode, 10);
      const err = new Microservice.HTTPError(message, code);
      setImmediate(next, err);
    });

    exp.get('/health', dontLog, (req, res, next) => res.json({ status: 'OK' }));

    return exp;
  }
}

module.exports = WidgetService;
