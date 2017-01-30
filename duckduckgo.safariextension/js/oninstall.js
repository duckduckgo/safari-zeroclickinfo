/*
   Copyright (C) 2016 DuckDuckGo, Inc.

   Licensed under the Apache License, Version 2.0 (the "License");
   you may not use this file except in compliance with the License.
   You may obtain a copy of the License at

       http://www.apache.org/licenses/LICENSE-2.0

   Unless required by applicable law or agreed to in writing, software
   distributed under the License is distributed on an "AS IS" BASIS,
   WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
   See the License for the specific language governing permissions and
   limitations under the License.

*/
"use strict";

if (window.top === window) {

  safari.self.tab.dispatchMessage("check_atb_set");
  safari.self.tab.dispatchMessage("get_atb_param");

  safari.self.addEventListener("message", function(event) {
    if (event.name === "get_atb") {
      setTimeout(function() {
        var atbParam = document.querySelector('html').getAttribute('data-atb');
        if (atbParam) {
          safari.self.tab.dispatchMessage("set_atb", atbParam);
        }
      }, 500);
    }

    if (event.name === "atb_param") {
      var atbParam = event.message;
      var input = document.createElement('input');
      input.type = 'hidden';
      input.name = 'atb';
      input.value = atbParam;
      var form = document.querySelector('#search_form_homepage');
      if (form) {
        form.appendChild(input);
      }
    }
  });

}
