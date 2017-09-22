/*
 * Copyright (C) 2012, 2016 DuckDuckGo, Inc.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */


var debugRequest = false;
var trackers = require('trackers');
var utils = require('utils');
var settings = require('settings');

function Background() {
  $this = this;
}

var background = new Background();


/** 
 * Before each request:
 * - Add ATB param
 * - Block tracker requests
 * - Upgrade http -> https per HTTPS Everywhere rules
 */
var onBeforeRequest = function (requestData) { 
    let potentialTracker = requestData.message
    let currentURL = requestData.target.url

    var tracker =  trackers.isTracker(potentialTracker, currentURL, 0, requestData);
    
    if (tracker) {
        console.info("[" + tracker.parentCompany + "] " + tracker.url);
        return {cancel: true};
    }   
}

safari.application.addEventListener("message", onBeforeRequest, true);
