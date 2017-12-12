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

const {DatabankObject} = require('databank')

const Widget = DatabankObject.subClass('widget')
Widget.count = 0

Widget.schema = {
  pkey: 'id',
  fields: [
    'name',
    'createdAt',
    'updatedAt'
  ]
}

Widget.beforeCreate = function (props, callback) {
  props.id = Widget.count
  props.createdAt = (new Date()).toISOString()
  return callback(null, props)
}

Widget.prototype.afterCreate = function (callback) {
  Widget.count++
  return callback(null)
}

module.exports = Widget
