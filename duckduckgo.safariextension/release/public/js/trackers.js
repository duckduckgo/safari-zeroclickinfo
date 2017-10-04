(function e(t,n,r){function s(o,u){if(!n[o]){if(!t[o]){var a=typeof require=="function"&&require;if(!u&&a)return a(o,!0);if(i)return i(o,!0);var f=new Error("Cannot find module '"+o+"'");throw f.code="MODULE_NOT_FOUND",f}var l=n[o]={exports:{}};t[o][0].call(l.exports,function(e){var n=t[o][1][e];return s(n?n:e)},l,l.exports,e,t,n,r)}return n[o].exports}var i=typeof require=="function"&&require;for(var o=0;o<r.length;o++)s(r[o]);return s})({1:[function(require,module,exports){
'use strict';

var Parent = window.DDG.base.Model;

function Autocomplete(attrs) {

    Parent.call(this, attrs);
};

Autocomplete.prototype = $.extend({}, Parent.prototype, {

    modelName: 'autocomplete',

    fetchSuggestions: function fetchSuggestions(searchText) {
        var _this = this;

        return new Promise(function (resolve, reject) {
            // TODO: ajax call here to ddg autocomplete service
            // for now we'll just mock up an async xhr query result:
            _this.suggestions = [searchText + ' world', searchText + ' united', searchText + ' famfam'];
            resolve();
        });
    }

});

module.exports = Autocomplete;

},{}],2:[function(require,module,exports){
'use strict';

var Parent = window.DDG.base.Model;

/**
 * Background messaging is done via two methods:
 *
 * 1. Passive messages from background -> backgroundMessage model -> subscribing model
 *
 *    The background sends these messages using chrome.runtime.sendMessage({'name': 'value'})
 *    The backgroundMessage model (here) receives the message and sets the value
 *    Other modules that are subscribed to state changes in backgroundMessage are notified
 *
 * 2. Two-way messaging using this.model.fetch() as a passthrough
 *
 *    Each model can use a fetch method to send and receive a response from the background. 
 *    Ex: this.model.fetch({'name': 'value'}).then((response) => console.log(response))
 *    Listeners must be registered in the background to respond to messages with this 'name'.
 *
 *    The common fetch method is defined in base/model.es6.js
 */
function BackgroundMessage(attrs) {
    var _this = this;

    Parent.call(this, attrs);

    // listen for messages from background 
    safari.self.addEventListener("message", function (req) {
        if (req.whitelistChanged) {
            // notify subscribers that the whitelist has changed
            _this.set('whitelistChanged', true);
        } else if (req.updateTrackerCount) {
            _this.set('updateTrackerCount', true);
        }
    });
}

BackgroundMessage.prototype = $.extend({}, Parent.prototype, {
    modelName: 'backgroundMessage'
});

module.exports = BackgroundMessage;

},{}],3:[function(require,module,exports){
'use strict';

var Parent = window.DDG.base.Model;

function Linkable(attrs) {

    Parent.call(this, attrs);
};

Linkable.prototype = $.extend({}, Parent.prototype, {

    modelName: 'linkable'

});

module.exports = Linkable;

},{}],4:[function(require,module,exports){
"use strict";

var Parent = window.DDG.base.Model;

function Search(attrs) {

    Parent.call(this, attrs);
};

Search.prototype = $.extend({}, Parent.prototype, {

    modelName: 'search',

    doSearch: function doSearch(s) {
        this.searchText = s;
        console.log("doSearch() for " + s);

        chrome.tabs.create({
            url: "https://duckduckgo.com/?q=" + s + "&bext=" + localStorage['os'] + "cr"
        });
    }

});

module.exports = Search;

},{}],5:[function(require,module,exports){
'use strict';

var Parent = window.DDG.base.Model;

var httpsStates = {
    'default': 'Secure Connection',
    'upgraded': 'Forced Secure Connection',
    'none': 'Secure Connection Unavailable'
};

var whitelistStates = {
    'isWhitelisted': 'Blocking off (this domain)',
    'notWhitelisted': 'Blocking on (this domain)'
};

function Site(attrs) {

    attrs.disabled = true; // disabled by default
    attrs.httpsState = 'none';
    attrs.httpsStatusText = httpsStates[attrs.httpsState];
    Parent.call(this, attrs);
};

Site.prototype = $.extend({}, Parent.prototype, {

    modelName: 'site',

    setSiteObj: function setSiteObj() {
        this.tab = safari.extension.globalPage.contentWindow.tabManager.getActiveTab();
        if (!this.tab) {
            this.domain = 'new tab'; // tab can be null for firefox new tabs
            this.siteRating = '';
        } else {
            this.isWhitelisted = this.tab.site.whitelisted;
            this.setWhitelistStatusText();
            if (this.tab.site.isSpecialDomain) {
                this.domain = this.tab.site.isSpecialDomain; // eg "extensions", "options", "new tab"
            } else {
                this.disabled = false;
            }
        }
    },

    setHttpsMessage: function setHttpsMessage() {
        if (!this.tab) return;

        if (this.tab.upgradedHttps) {
            this.httpsState = 'upgraded';
        } else if (/^https/.exec(this.tab.url)) {
            this.httpsState = 'default';
        }

        this.httpsStatusText = httpsStates[this.httpsState];
    },

    setWhitelistStatusText: function setWhitelistStatusText() {
        if (this.isWhitelisted) {
            this.whitelistStatusText = whitelistStates['isWhitelisted'];
        } else {
            this.whitelistStatusText = whitelistStates['notWhitelisted'];
        }
    },

    update: function update(updatedSiteRating) {
        var rerenderFlag = false;

        if (this.tab) {
            var updatedTrackersCount = this._getUniqueTrackersCount();
            var updatedTrackersBlockedCount = this._getUniqueTrackersBlockedCount();

            if (updatedSiteRating !== this.siteRating) {
                this.siteRating = updatedSiteRating;
                rerenderFlag = true;
            }

            if (updatedTrackersCount !== this.trackersCount) {
                this.trackersCount = updatedTrackersCount;
                rerenderFlag = true;
            }
            if (updatedTrackersBlockedCount !== this.trackersBlockedCount) {
                this.trackersBlockedCount = updatedTrackersBlockedCount;
                rerenderFlag = true;
            }
        }

        return rerenderFlag;
    },

    toggleWhitelist: function toggleWhitelist() {
        if (this.tab && this.tab.site) {
            this.isWhitelisted = !this.isWhitelisted;

            this.fetch({ 'whitelisted': {
                    list: 'whitelisted',
                    domain: this.tab.site.domain,
                    value: this.isWhitelisted
                }
            });
            this.setWhitelistStatusText();
        }
    },

    _getUniqueTrackersCount: function _getUniqueTrackersCount() {
        var _this = this;

        return Object.keys(this.tab.trackers).reduce(function (total, name) {
            return _this.tab.trackers[name].urls.length + total;
        }, 0);
    },

    _getUniqueTrackersBlockedCount: function _getUniqueTrackersBlockedCount(tab) {
        var _this2 = this;

        return Object.keys(this.tab.trackersBlocked).reduce(function (total, name) {
            return _this2.tab.trackersBlocked[name].urls.length + total;
        }, 0);
    }
});

module.exports = Site;

},{}],6:[function(require,module,exports){
'use strict';

var Parent = window.DDG.base.Model;

function SiteTrackerList(attrs) {

    attrs = attrs || {};
    attrs.tab = null;
    attrs.potentialBlocked = [];
    attrs.companyListMap = [];
    Parent.call(this, attrs);
};

SiteTrackerList.prototype = $.extend({}, Parent.prototype, {

    modelName: 'siteTrackerList',

    fetchAsyncData: function fetchAsyncData() {
        var self = this;
        return new Promise(function (resolve, reject) {
            self.tab = safari.extension.globalPage.contentWindow.tabManager.getActiveTab();
            self._updateCompaniesList();
            resolve();
        });
    },

    _updateCompaniesList: function _updateCompaniesList() {
        var self = this;
        // list of all trackers on page (whether we blocked them or not)
        self.trackers = self.tab.trackers || {};
        var companyNames = Object.keys(self.trackers);

        // find largest number of trackers (by company)
        var maxCount = 0;
        if (self.trackers && companyNames.length > 0) {
            companyNames.map(function (name) {
                // don't count "unknown" trackers since they will
                // be listed individually at bottom of graph,
                // we don't want "unknown" tracker total as maxCount
                if (name !== 'unknown') {
                    // let compare = self.trackersBlocked[name].count;
                    var compare = self.trackers[name].count;
                    if (compare > maxCount) maxCount = compare;
                }
            });
        }

        // set trackerlist metadata for list display by company:
        self.companyListMap = companyNames.map(function (companyName) {
            var company = self.trackers[companyName];
            // calc max using pixels instead of % to make margins easier
            // max width: 270 - (horizontal margin + padding in css) = 228
            return {
                name: companyName,
                count: companyName === 'unknown' ? 0 : company.count,
                px: Math.floor(company.count * 228 / maxCount),
                urls: company.urls
            };
        }).sort(function (a, b) {
            return b.count - a.count;
        });
    }
});

module.exports = SiteTrackerList;

},{}],7:[function(require,module,exports){
'use strict';

var Parent = window.DDG.base.Model;

function TrackerListTopBlocked(attrs) {

    this.numCompanies = attrs.numCompanies;

    // TODO: clean this up a bit
    Parent.call(this, attrs);
};

TrackerListTopBlocked.prototype = $.extend({}, Parent.prototype, {

    modelName: 'trackerListTopBlocked',

    getTopBlocked: function getTopBlocked() {
        var _this = this;

        return new Promise(function (resolve, reject) {
            _this.fetch({ getTopBlocked: _this.numCompanies }).then(function (list) {
                _this.companyList = list;
                // find company with largest number of trackers

                var maxCount = 0;
                if (_this.companyList && _this.companyList.length) {
                    maxCount = _this.companyList[0].count;
                }

                _this.companyListMap = _this.companyList.map(function (company) {
                    // calc max using pixels instead of % to make margins easier
                    // max width: 270 - (horizontal margin + padding in css) = 228
                    return {
                        name: company.name,
                        count: company.count,
                        px: Math.floor(company.count * 228 / maxCount)
                    };
                });
                resolve();
            });
        });
    }
});

module.exports = TrackerListTopBlocked;

},{}],8:[function(require,module,exports){
'use strict';

module.exports = {
  setBrowserClassOnBodyTag: require('./set-browser-class.es6.js')
  // ...add more here!
};

},{"./set-browser-class.es6.js":9}],9:[function(require,module,exports){
'use strict';

module.exports = {
    setBrowserClassOnBodyTag: function setBrowserClassOnBodyTag() {
        var browser = 'safari';
        var browserClass = 'is-browser--' + browser;
        $('body').addClass(browserClass);
    }
};

},{}],10:[function(require,module,exports){
'use strict';

var Parent = window.DDG.base.Page;
var mixins = require('./mixins/index.es6.js');

var TrackerListView = require('./../views/trackerlist-truncated.es6.js');
var TrackerListModel = require('./../models/trackerlist-top-blocked.es6.js');
var trackerListTemplate = require('./../templates/trackerlist-truncated.es6.js');

var SiteView = require('./../views/site.es6.js');
var SiteModel = require('./../models/site.es6.js');
var siteTemplate = require('./../templates/site.es6.js');

var SearchView = require('./../views/search.es6.js');
var SearchModel = require('./../models/search.es6.js');
var searchTemplate = require('./../templates/search.es6.js');

var LinkableView = require('./../views/linkable.es6.js');
var LinkableModel = require('./../models/linkable.es6.js');
var linkableTemplate = require('./../templates/linkable.es6.js');

var AutocompleteView = require('./../views/autocomplete.es6.js');
var AutocompleteModel = require('./../models/autocomplete.es6.js');
var autocompleteTemplate = require('./../templates/autocomplete.es6.js');

var BackgroundMessageModel = require('./../models/backgroundMessage.es6.js');

function Trackers(ops) {
    this.$parent = $('#trackers-container');
    Parent.call(this, ops);
};

Trackers.prototype = $.extend({}, Parent.prototype, mixins.setBrowserClassOnBodyTag, {

    pageName: 'trackers',

    ready: function ready() {
        var _this = this;

        Parent.prototype.ready.call(this);

        this.message = new BackgroundMessageModel();

        this.openOptionsPage = function () {
            _this.message.fetch({ getBrowser: true }).then(function (browser) {
                if (browser === 'moz') {
                    _this.message.fetch({ firefoxOptionPage: true }).then(function (page) {
                        chrome.tabs.create({ url: page });
                    });
                } else if (browser === 'safari') {
                    safari.self.hide();
                    safari.extension.globalPage.contentWindow.tabManager.openOptionsPage();
                } else {
                    chrome.runtime.openOptionsPage();
                }
            });
        };

        this.setBrowserClassOnBodyTag();

        this.views.search = new SearchView({
            pageView: this,
            model: new SearchModel({ searchText: '' }), // TODO proper location of remembered query
            appendTo: this.$parent,
            template: searchTemplate
        });

        this.views.site = new SiteView({
            pageView: this,
            model: new SiteModel({
                domain: '-',
                isWhitelisted: false,
                siteRating: 'B',
                trackerCount: 0
            }),
            appendTo: this.$parent,
            template: siteTemplate
        });

        this.views.trackerlist = new TrackerListView({
            pageView: this,
            model: new TrackerListModel({ numCompanies: 4 }),
            appendTo: this.$parent,
            template: trackerListTemplate
        });

        this.views.options = new LinkableView({
            pageView: this,
            model: new LinkableModel({
                text: 'Settings',
                id: 'options-link',
                link: this.openOptionsPage,
                klass: 'link-secondary',
                spanClass: 'icon icon__settings pull-right'
            }),
            appendTo: this.$parent,
            template: linkableTemplate
        });

        // TODO: hook up model query to actual ddg ac endpoint.
        // For now this is just here to demonstrate how to
        // listen to another component via model.set() +
        // store.subscribe()
        this.views.autocomplete = new AutocompleteView({
            pageView: this,
            model: new AutocompleteModel({ suggestions: [] }),
            // appendTo: this.views.search.$el,
            appendTo: null,
            template: autocompleteTemplate
        });
    }
});

// kickoff!
window.DDG = window.DDG || {};
window.DDG.page = new Trackers();

},{"./../models/autocomplete.es6.js":1,"./../models/backgroundMessage.es6.js":2,"./../models/linkable.es6.js":3,"./../models/search.es6.js":4,"./../models/site.es6.js":5,"./../models/trackerlist-top-blocked.es6.js":7,"./../templates/autocomplete.es6.js":11,"./../templates/linkable.es6.js":12,"./../templates/search.es6.js":13,"./../templates/site.es6.js":16,"./../templates/trackerlist-truncated.es6.js":18,"./../views/autocomplete.es6.js":19,"./../views/linkable.es6.js":20,"./../views/search.es6.js":22,"./../views/site.es6.js":23,"./../views/trackerlist-truncated.es6.js":26,"./mixins/index.es6.js":8}],11:[function(require,module,exports){
'use strict';

var _templateObject = _taggedTemplateLiteral(['<ul class="js-autocomplete" style="', '">\n                  ', '\n              </ul>'], ['<ul class="js-autocomplete" style="', '">\n                  ', '\n              </ul>']),
    _templateObject2 = _taggedTemplateLiteral(['\n                      <li><a href="#">', '</a></li>'], ['\n                      <li><a href="#">', '</a></li>']);

function _taggedTemplateLiteral(strings, raw) { return Object.freeze(Object.defineProperties(strings, { raw: { value: Object.freeze(raw) } })); }

var bel = require('bel');

module.exports = function () {

    // TODO/REMOVE: remove marginTop style tag once this is actually hooked up
    //              this is just to demo model store for now!
    //              -> this is gross, don't do this:
    var marginTop = this.model.suggestions && this.model.suggestions.length > 0 ? 'margin-top: 50px;' : '';

    return bel(_templateObject, marginTop, this.model.suggestions.map(function (suggestion) {
        return bel(_templateObject2, suggestion);
    }));
};

},{"bel":27}],12:[function(require,module,exports){
'use strict';

var _templateObject = _taggedTemplateLiteral(['<a class="linkable ', '"\n                  id="js-linkable-', '"\n                  href="javascript:void(0)">\n            ', '\n            <span class="', '"></div>\n        </a>'], ['<a class="linkable ', '"\n                  id="js-linkable-', '"\n                  href="javascript:void(0)">\n            ', '\n            <span class="', '"></div>\n        </a>']);

function _taggedTemplateLiteral(strings, raw) { return Object.freeze(Object.defineProperties(strings, { raw: { value: Object.freeze(raw) } })); }

var bel = require('bel');

module.exports = function () {
    return bel(_templateObject, this.model.klass, this.model.id, this.model.text, this.model.spanClass);
};

},{"bel":27}],13:[function(require,module,exports){
'use strict';

var _templateObject = _taggedTemplateLiteral(['<section>\n        <form class="sliding-subview__header card search-form js-search-form" name="x">\n          <input type="text" autocomplete="off" placeholder="Search DuckDuckGo" \n                 name="q" class="search-form__input js-search-input" \n                 value="', '" />\n          <input class="search-form__go js-search-go" tabindex="2" value="" type="button" />\n          <input type="submit" class="search-form__submit" />\n          <span class="ddg-logo"></span>\n        </form>\n    </section>'], ['<section>\n        <form class="sliding-subview__header card search-form js-search-form" name="x">\n          <input type="text" autocomplete="off" placeholder="Search DuckDuckGo" \n                 name="q" class="search-form__input js-search-input" \n                 value="', '" />\n          <input class="search-form__go js-search-go" tabindex="2" value="" type="button" />\n          <input type="submit" class="search-form__submit" />\n          <span class="ddg-logo"></span>\n        </form>\n    </section>']);

function _taggedTemplateLiteral(strings, raw) { return Object.freeze(Object.defineProperties(strings, { raw: { value: Object.freeze(raw) } })); }

var bel = require('bel');

module.exports = function () {
    return bel(_templateObject, this.model.searchText);
};

},{"bel":27}],14:[function(require,module,exports){
'use strict';

var _templateObject = _taggedTemplateLiteral(['\n    <button class="toggle-button toggle-button--is-active-', ' ', '"\n            data-key="', '"\n            type="button">\n        <div class="toggle-button__bg">\n        </div>\n        <div class="toggle-button__knob"></div>\n    </button>'], ['\n    <button class="toggle-button toggle-button--is-active-', ' ', '"\n            data-key="', '"\n            type="button">\n        <div class="toggle-button__bg">\n        </div>\n        <div class="toggle-button__knob"></div>\n    </button>']);

function _taggedTemplateLiteral(strings, raw) { return Object.freeze(Object.defineProperties(strings, { raw: { value: Object.freeze(raw) } })); }

var bel = require('bel');

module.exports = function (isActiveBoolean, klass, dataKey) {

    // make `klass` and `dataKey` optional:
    klass = klass || '';
    dataKey = dataKey || '';

    return bel(_templateObject, isActiveBoolean, klass, dataKey);
};

},{"bel":27}],15:[function(require,module,exports){
'use strict';

var _templateObject = _taggedTemplateLiteral(['<li class="top-blocked__li">\n              <span class="top-blocked__li__company-name">', '</span>\n              <div class="top-blocked__li__blocker-count pull-right ', '">', '</div>\n              <div class="top-blocked__li__blocker-bar ', '">\n                  <div class="top-blocked__li__blocker-bar top-blocked__li__blocker-bar--fg js-top-blocked-graph-bar-fg"\n                  style="width: 0px" data-width="', 'px">\n                  </div>\n              </div>\n            </li>'], ['<li class="top-blocked__li">\n              <span class="top-blocked__li__company-name">', '</span>\n              <div class="top-blocked__li__blocker-count pull-right ', '">', '</div>\n              <div class="top-blocked__li__blocker-bar ', '">\n                  <div class="top-blocked__li__blocker-bar top-blocked__li__blocker-bar--fg js-top-blocked-graph-bar-fg"\n                  style="width: 0px" data-width="', 'px">\n                  </div>\n              </div>\n            </li>']);

function _taggedTemplateLiteral(strings, raw) { return Object.freeze(Object.defineProperties(strings, { raw: { value: Object.freeze(raw) } })); }

var bel = require('bel');

module.exports = function (trackerListMap) {
    return trackerListMap.map(function (obj) {

        // Special case: in a page's tracker list, "unkown" company contains
        // a list of trackers we can't resolve to a company. In this case,
        // we render each tracker domain individually with no count
        // (we don't have individual tracker count data for these yet)
        if (obj.name.toLowerCase() === 'unknown') {
            return obj.urls.map(function (url) {
                return generateLi({ name: url }, true);
            });
        } else {
            return generateLi(obj);
        }

        function generateLi(data, isUnknownCompany) {
            var isHidden = '';
            if (isUnknownCompany) {
                isHidden = 'is-hidden';
            }

            return bel(_templateObject, data.name, isHidden, data.count, isHidden, data.px);
        }
    });
};

},{"bel":27}],16:[function(require,module,exports){
'use strict';

var _templateObject = _taggedTemplateLiteral(['<section class="site-info card">\n        <ul class="menu-list">\n            <li class="border--bottom">\n                <h1 class="site-info__domain">', '</h1>\n                <div class="site-info__rating site-info__rating--', ' pull-right"></div>\n            </li>\n            <li class="border--bottom">\n                <h2>\n                    <span class="site-info__https-status site-info__https-status--', '">\n                    </span><span class="site-info__https-status-msg bold">', '</span>\n                </h3>\n            </li>\n            <li class="site-info__li--tracker-count border--bottom">\n                <h2>\n                    <a href="javascript: void(0)" class="js-site-show-all-trackers link-secondary">\n                        <span class="site-info__tracker-count">', '</span>Unique Trackers Blocked\n                        <span class="icon icon__arrow pull-right"></span>\n                    </a>\n                </h2>\n            </li>\n            <li class="site-info__li--toggle">\n                <span class="site-info__toggle-text">', '</span>\n                ', '\n            </li>\n        </ul>\n    </section>'], ['<section class="site-info card">\n        <ul class="menu-list">\n            <li class="border--bottom">\n                <h1 class="site-info__domain">', '</h1>\n                <div class="site-info__rating site-info__rating--', ' pull-right"></div>\n            </li>\n            <li class="border--bottom">\n                <h2>\n                    <span class="site-info__https-status site-info__https-status--', '">\n                    </span><span class="site-info__https-status-msg bold">', '</span>\n                </h3>\n            </li>\n            <li class="site-info__li--tracker-count border--bottom">\n                <h2>\n                    <a href="javascript: void(0)" class="js-site-show-all-trackers link-secondary">\n                        <span class="site-info__tracker-count">', '</span>Unique Trackers Blocked\n                        <span class="icon icon__arrow pull-right"></span>\n                    </a>\n                </h2>\n            </li>\n            <li class="site-info__li--toggle">\n                <span class="site-info__toggle-text">', '</span>\n                ', '\n            </li>\n        </ul>\n    </section>']);

function _taggedTemplateLiteral(strings, raw) { return Object.freeze(Object.defineProperties(strings, { raw: { value: Object.freeze(raw) } })); }

var bel = require('bel');
var toggleButton = require('./shared/toggle-button');

module.exports = function () {

    var countText = this.model.trackersBlockedCount || 0;
    if (this.model.trackersCount > 0 && this.model.trackersCount != countText) {
        countText = countText + '/' + this.model.trackersCount;
    }

    return bel(_templateObject, this.model.domain, this.model.siteRating, this.model.httpsState, this.model.httpsStatusText, countText, this.model.whitelistStatusText, toggleButton(!this.model.isWhitelisted, 'js-site-toggle pull-right'));
};

},{"./shared/toggle-button":14,"bel":27}],17:[function(require,module,exports){
'use strict';

var _templateObject = _taggedTemplateLiteral(['<section class="sliding-subview sliding-subview--trackers-blocked sliding-subview--has-fixed-header">\n            <nav class="sliding-subview__header card">\n                <a href="javascript:void(0)" class="sliding-subview__header__title sliding-subview__header__title--has-icon js-sliding-subview-close">\n                    <span class="icon icon__arrow icon__arrow--left pull-left"></span>\n                </a>\n                <ul class="sliding-subview__header__tabbed-nav">\n                    <a href="#" class="js-nav-tab js-nav-tab-page">This Page</a>\n                    <a href="#" class="js-nav-tab js-nav-tab-all">All Time</a>\n                </ul>\n            </nav>\n        </section>'], ['<section class="sliding-subview sliding-subview--trackers-blocked sliding-subview--has-fixed-header">\n            <nav class="sliding-subview__header card">\n                <a href="javascript:void(0)" class="sliding-subview__header__title sliding-subview__header__title--has-icon js-sliding-subview-close">\n                    <span class="icon icon__arrow icon__arrow--left pull-left"></span>\n                </a>\n                <ul class="sliding-subview__header__tabbed-nav">\n                    <a href="#" class="js-nav-tab js-nav-tab-page">This Page</a>\n                    <a href="#" class="js-nav-tab js-nav-tab-all">All Time</a>\n                </ul>\n            </nav>\n        </section>']),
    _templateObject2 = _taggedTemplateLiteral(['\n            <ol class="menu-list top-blocked__list card js-top-blocked-list">\n                ', '\n            </ol>'], ['\n            <ol class="menu-list top-blocked__list card js-top-blocked-list">\n                ', '\n            </ol>']),
    _templateObject3 = _taggedTemplateLiteral(['<ol class="menu-list top-blocked__list card js-top-blocked-list">\n                <li class="top-blocked__li top-blocked__li--no-trackers">No trackers found here... <br />Phew!</li>\n            </ol>'], ['<ol class="menu-list top-blocked__list card js-top-blocked-list">\n                <li class="top-blocked__li top-blocked__li--no-trackers">No trackers found here... <br />Phew!</li>\n            </ol>']);

function _taggedTemplateLiteral(strings, raw) { return Object.freeze(Object.defineProperties(strings, { raw: { value: Object.freeze(raw) } })); }

var bel = require('bel');
var trackerListItems = require('./shared/trackerlist-items.es6.js');

module.exports = function () {

    if (!this.model) {

        return bel(_templateObject);
    } else if (this.model.companyListMap) {
        if (this.model.companyListMap.length > 0) {
            return bel(_templateObject2, trackerListItems(this.model.companyListMap));
        } else {
            return bel(_templateObject3);
        }
    }
};

},{"./shared/trackerlist-items.es6.js":15,"bel":27}],18:[function(require,module,exports){
'use strict';

var _templateObject = _taggedTemplateLiteral(['<section class="top-blocked card">\n            <h3 class="menu-title border--bottom">Top blocked companies over time</h3>\n            <ul class="menu-list top-blocked__list">\n                ', '\n                <li class="top-blocked__li top-blocked__li--see-all border--top">\n                    <a href="javascript:void(0)" class="link-secondary js-top-blocked-see-all">\n                        <span class="icon icon__arrow pull-right"></span>\n                        See all\n                    </a>\n                </li>\n            </ul>\n        </section>'], ['<section class="top-blocked card">\n            <h3 class="menu-title border--bottom">Top blocked companies over time</h3>\n            <ul class="menu-list top-blocked__list">\n                ', '\n                <li class="top-blocked__li top-blocked__li--see-all border--top">\n                    <a href="javascript:void(0)" class="link-secondary js-top-blocked-see-all">\n                        <span class="icon icon__arrow pull-right"></span>\n                        See all\n                    </a>\n                </li>\n            </ul>\n        </section>']),
    _templateObject2 = _taggedTemplateLiteral(['<section class="top-blocked card">\n                    <h3 class="menu-title">Top blocked over time</h3>\n                    <ul class="menu-list top-blocked__list">\n                        <li class="top-blocked__li top-blocked__li--no-trackers">\n                            No data collected yet... <br />\n                            Start browsing the web and check back in a bit!\n                        </li>\n                    </ul>\n            </section>'], ['<section class="top-blocked card">\n                    <h3 class="menu-title">Top blocked over time</h3>\n                    <ul class="menu-list top-blocked__list">\n                        <li class="top-blocked__li top-blocked__li--no-trackers">\n                            No data collected yet... <br />\n                            Start browsing the web and check back in a bit!\n                        </li>\n                    </ul>\n            </section>']);

function _taggedTemplateLiteral(strings, raw) { return Object.freeze(Object.defineProperties(strings, { raw: { value: Object.freeze(raw) } })); }

var bel = require('bel');
var trackerListItems = require('./shared/trackerlist-items.es6.js');

module.exports = function () {

    if (this.model.companyListMap && this.model.companyListMap.length > 0) {

        return bel(_templateObject, trackerListItems(this.model.companyListMap));
    } else {

        return bel(_templateObject2);
    }
};

},{"./shared/trackerlist-items.es6.js":15,"bel":27}],19:[function(require,module,exports){
'use strict';

var Parent = window.DDG.base.View;

function Autocomplete(ops) {

    this.model = ops.model;
    this.pageView = ops.pageView;
    this.template = ops.template;

    Parent.call(this, ops);

    this.bindEvents([[this.store.subscribe, 'change:search', this._handleSearchText]]);
};

Autocomplete.prototype = $.extend({}, Parent.prototype, {

    _handleSearchText: function _handleSearchText(notification) {
        var _this = this;

        if (notification.change && notification.change.attribute === 'searchText') {
            if (!notification.change.value) {
                this.model.suggestions = [];
                this._rerender();
                return;
            }

            this.model.fetchSuggestions(notification.change.value).then(function () {
                return _this._rerender();
            });
        }
    }

});

module.exports = Autocomplete;

},{}],20:[function(require,module,exports){
'use strict';

var Parent = window.DDG.base.View;

function Linkable(ops) {

    this.model = ops.model;
    this.pageView = ops.pageView;
    this.template = ops.template;

    Parent.call(this, ops);

    this.$linkableItem = $('#js-linkable-' + this.model.id);

    this.bindEvents([[this.$linkableItem, 'click', this._handleClick]]);
};

Linkable.prototype = $.extend({}, Parent.prototype, {

    _handleClick: function _handleClick(e) {
        this.model.link();
    }

});

module.exports = Linkable;

},{}],21:[function(require,module,exports){
'use strict';

module.exports = {
    animateGraphBars: function animateGraphBars() {
        var self = this;

        window.setTimeout(function () {
            if (!self.$graphbarfg) return;
            self.$graphbarfg.each(function (i, el) {
                var $el = $(el);
                var w = $el.data().width;
                $el.css('width', w);
            });
        }, 250);
    }
};

},{}],22:[function(require,module,exports){
'use strict';

var Parent = window.DDG.base.View;

function Search(ops) {
    var _this = this;

    this.model = ops.model;
    this.pageView = ops.pageView;
    this.template = ops.template;

    Parent.call(this, ops);

    this._cacheElems('.js-search', ['form', 'input', 'go']);

    this.bindEvents([[this.$input, 'keyup', this._handleKeyup], [this.$go, 'click', this._handleSubmit], [this.$form, 'submit', this._handleSubmit]]);

    window.setTimeout(function () {
        _this.$input.focus();
    }, 200);
};

Search.prototype = $.extend({}, Parent.prototype, {

    _handleKeyup: function _handleKeyup(e) {
        this.model.set('searchText', this.$input.val());
    },

    _handleSubmit: function _handleSubmit(e) {
        console.log('Search submit for ' + this.$input.val());
        this.model.doSearch(this.$input.val());
    }
});

module.exports = Search;

},{}],23:[function(require,module,exports){
'use strict';

var Parent = window.DDG.base.View;
var TrackerListSlidingSubview = require('./../views/trackerlist-sliding-subview.es6.js');
var tabbedTrackerListTemplate = require('./../templates/trackerlist-tabbed.es6.js');

function Site(ops) {

    this.model = ops.model;
    this.pageView = ops.pageView;
    this.template = ops.template;

    Parent.call(this, ops);

    this.$body = $('body');

    // bind events
    this._setup();

    // get data from background page tab
    this.getBackgroundTabData();

    // edge case, should not happen
    // '-' is the domain default in the pages/trackers.es6.js call
    if (this.domain === '-') {
        this.model.disabled = true;
        this._setDisabled();
    }
};

Site.prototype = $.extend({}, Parent.prototype, {

    _setup: function _setup() {

        this._cacheElems('.js-site', ['toggle', 'show-all-trackers']);

        this.bindEvents([[this.$toggle, 'click', this._whitelistClick], [this.$showalltrackers, 'click', this._showAllTrackers], [this.store.subscribe, 'change:backgroundMessage', this.updateTrackerCount]]);
    },

    updateTrackerCount: function updateTrackerCount(message) {
        var self = this;
        if (message.change.attribute === 'updateTrackerCount') {
            if (!this.model.tab) return;

            var tabID = this.model.tab.id;

            this.model.fetch({ getTab: tabID }).then(function (backgroundTabObj) {
                self.model.tab = backgroundTabObj;
                self.model.update();
                self._getSiteRating();
            });
        }
    },

    getBackgroundTabData: function getBackgroundTabData() {
        var self = this;

        // get safari tab directly
        self.model.tab = safari.extension.globalPage.contentWindow.tabManager.getActiveTab();
        self.model.domain = self.model.tab.site.domain;
        self._getSiteRating();
        self.model.setSiteObj();

        if (self.model.disabled) {
            // determined in setSiteObj()
            self._setDisabled();
        }

        self.model.update();
        self.model.setHttpsMessage();
        self.rerender(); // our custom rerender below
    },

    _whitelistClick: function _whitelistClick(e) {
        this.model.toggleWhitelist();
        console.log('isWhitelisted: ', this.model.isWhitelisted);
        this.model.set('whitelisted', this.isWhitelisted);
        //chrome.tabs.reload(this.model.tab.id);
        safari.extension.globalPage.contentWindow.tabManager.reloadTab();
        //const w = chrome.extension.getViews({type: 'popup'})[0];
        //w.close()
        safari.self.hide();
    },

    rerender: function rerender() {
        this.unbindEvents();
        this._rerender();
        this._setup();
    },

    _setDisabled: function _setDisabled() {
        this.$body.addClass('disabled');
    },

    _showAllTrackers: function _showAllTrackers() {
        if (this.$body.hasClass('disabled')) return;
        this.views.slidingSubview = new TrackerListSlidingSubview({
            template: tabbedTrackerListTemplate,
            defaultTab: 'page'
        });
    },

    _getSiteRating: function _getSiteRating() {
        var _this = this;

        this.model.fetch({ getSiteScore: this.model.tab.id }).then(function (rating) {
            if (rating && _this.model.update(rating)) _this.rerender();
        });
    }
});

module.exports = Site;

},{"./../templates/trackerlist-tabbed.es6.js":17,"./../views/trackerlist-sliding-subview.es6.js":25}],24:[function(require,module,exports){
'use strict';

var Parent = window.DDG.base.View;

function SlidingSubview(ops) {

    ops.appendTo = $('.sliding-subview--root');
    Parent.call(this, ops);

    this.$root = $('.sliding-subview--root');
    this.$root.addClass('sliding-subview--open');

    this._cacheElems('.js-sliding-subview', ['close']);
    this.bindEvents([[this.$close, 'click', this._destroy]]);
}

SlidingSubview.prototype = $.extend({}, Parent.prototype, {

    _destroy: function _destroy() {
        var self = this;
        this.$root.removeClass('sliding-subview--open');
        window.setTimeout(function () {
            self.destroy();
        }, 400); // 400ms = 0.35s in .sliding-subview--root transition + 50ms padding
    }

});

module.exports = SlidingSubview;

},{}],25:[function(require,module,exports){
'use strict';

var Parent__SlidingSubview = require('./sliding-subview.es6.js');
var animateGraphBars = require('./mixins/animate-graph-bars.es6.js');
var SiteTrackersModel = require('./../models/trackerlist-site.es6.js');
var AllTrackersModel = require('./../models/trackerlist-top-blocked.es6.js');

function TrackerList(ops) {

    this.selectedTab = ops.defaultTab; // poss values: `page` or `all`
    ops.model = null;
    this.template = ops.template;
    Parent__SlidingSubview.call(this, ops);
    this.updateList();

    // tab clicks
    this.setActiveTab();
    this.$navtab = this.$el.find('.js-nav-tab');
    this.bindEvents([[this.$navtab, 'click', this.switchTabs]]);

    // animate graph bars
    this.$graphbarfg = this.$el.find('.js-top-blocked-graph-bar-fg');
    this.animateGraphBars();
};

TrackerList.prototype = $.extend({}, Parent__SlidingSubview.prototype, animateGraphBars, {

    setActiveTab: function setActiveTab() {
        var selector = '.js-nav-tab';
        this.$el.find(selector).removeClass('active');
        selector = selector + '-' + this.selectedTab;
        this.$el.find(selector).addClass('active');
    },

    switchTabs: function switchTabs(e) {
        e.preventDefault();
        var selector = '.js-nav-tab-' + this.selectedTab;
        var $elHasClass = $(e.currentTarget).hasClass;

        if (this.selectedTab === 'all') {
            if (!$(e.currentTarget).hasClass(selector)) {
                this.selectedTab = 'page';
                this.updateList();
                this.setActiveTab();
            }
        } else if (this.selectedTab === 'page') {
            if (!$(e.currentTarget).hasClass(selector)) {
                this.selectedTab = 'all';
                this.updateList();
                this.setActiveTab();
            }
        }
    },

    updateList: function updateList() {
        var _this = this;

        if (this.selectedTab === 'all') {
            var num = 10;
            this.model = new AllTrackersModel({
                modelName: 'trackerListTop' + num + 'Blocked' + Math.round(Math.random() * 100000),
                numCompanies: 10
            });
            this.model.getTopBlocked().then(function () {
                console.log("Render list");
                _this.renderList();
            });
        } else if (this.selectedTab === 'page') {
            this.model = new SiteTrackersModel({
                modelName: 'siteTrackerList-' + Math.round(Math.random() * 100000)
            });
            this.model.fetchAsyncData().then(function () {
                _this.renderList();
            });
        }
    },

    renderList: function renderList() {
        this.$el.find('.js-top-blocked-list').remove();
        var ol = this.template.call(this);
        this.$el.append(ol);
        this.$graphbarfg = this.$el.find('.js-top-blocked-graph-bar-fg');
        this.animateGraphBars();
    }
});

module.exports = TrackerList;

},{"./../models/trackerlist-site.es6.js":6,"./../models/trackerlist-top-blocked.es6.js":7,"./mixins/animate-graph-bars.es6.js":21,"./sliding-subview.es6.js":24}],26:[function(require,module,exports){
'use strict';

var Parent = window.DDG.base.View;
var animateGraphBars = require('./mixins/animate-graph-bars.es6.js');
var TrackerListSlidingSubview = require('./../views/trackerlist-sliding-subview.es6.js');
var tabbedTrackerListTemplate = require('./../templates/trackerlist-tabbed.es6.js');

function TrackerList(ops) {
    var _this = this;

    this.model = ops.model;
    this.pageView = ops.pageView;
    this.template = ops.template;

    Parent.call(this, ops);

    this.model.getTopBlocked().then(function () {
        _this.rerenderList();
    });
};

TrackerList.prototype = $.extend({}, Parent.prototype, animateGraphBars, {

    _seeAllClick: function _seeAllClick() {
        this.views.slidingSubview = new TrackerListSlidingSubview({
            template: tabbedTrackerListTemplate,
            defaultTab: 'all'
        });
    },

    _setup: function _setup() {
        this._cacheElems('.js-top-blocked', ['graph-bar-fg', 'see-all']);
        this.bindEvents([[this.$seeall, 'click', this._seeAllClick]]);
    },

    rerenderList: function rerenderList() {
        this._rerender();
        this._setup();
        this.animateGraphBars();
    }
});

module.exports = TrackerList;

},{"./../templates/trackerlist-tabbed.es6.js":17,"./../views/trackerlist-sliding-subview.es6.js":25,"./mixins/animate-graph-bars.es6.js":21}],27:[function(require,module,exports){
var document = require('global/document')
var hyperx = require('hyperx')
var onload = require('on-load')

var SVGNS = 'http://www.w3.org/2000/svg'
var XLINKNS = 'http://www.w3.org/1999/xlink'

var BOOL_PROPS = {
  autofocus: 1,
  checked: 1,
  defaultchecked: 1,
  disabled: 1,
  formnovalidate: 1,
  indeterminate: 1,
  readonly: 1,
  required: 1,
  selected: 1,
  willvalidate: 1
}
var COMMENT_TAG = '!--'
var SVG_TAGS = [
  'svg',
  'altGlyph', 'altGlyphDef', 'altGlyphItem', 'animate', 'animateColor',
  'animateMotion', 'animateTransform', 'circle', 'clipPath', 'color-profile',
  'cursor', 'defs', 'desc', 'ellipse', 'feBlend', 'feColorMatrix',
  'feComponentTransfer', 'feComposite', 'feConvolveMatrix', 'feDiffuseLighting',
  'feDisplacementMap', 'feDistantLight', 'feFlood', 'feFuncA', 'feFuncB',
  'feFuncG', 'feFuncR', 'feGaussianBlur', 'feImage', 'feMerge', 'feMergeNode',
  'feMorphology', 'feOffset', 'fePointLight', 'feSpecularLighting',
  'feSpotLight', 'feTile', 'feTurbulence', 'filter', 'font', 'font-face',
  'font-face-format', 'font-face-name', 'font-face-src', 'font-face-uri',
  'foreignObject', 'g', 'glyph', 'glyphRef', 'hkern', 'image', 'line',
  'linearGradient', 'marker', 'mask', 'metadata', 'missing-glyph', 'mpath',
  'path', 'pattern', 'polygon', 'polyline', 'radialGradient', 'rect',
  'set', 'stop', 'switch', 'symbol', 'text', 'textPath', 'title', 'tref',
  'tspan', 'use', 'view', 'vkern'
]

function belCreateElement (tag, props, children) {
  var el

  // If an svg tag, it needs a namespace
  if (SVG_TAGS.indexOf(tag) !== -1) {
    props.namespace = SVGNS
  }

  // If we are using a namespace
  var ns = false
  if (props.namespace) {
    ns = props.namespace
    delete props.namespace
  }

  // Create the element
  if (ns) {
    el = document.createElementNS(ns, tag)
  } else if (tag === COMMENT_TAG) {
    return document.createComment(props.comment)
  } else {
    el = document.createElement(tag)
  }

  // If adding onload events
  if (props.onload || props.onunload) {
    var load = props.onload || function () {}
    var unload = props.onunload || function () {}
    onload(el, function belOnload () {
      load(el)
    }, function belOnunload () {
      unload(el)
    },
    // We have to use non-standard `caller` to find who invokes `belCreateElement`
    belCreateElement.caller.caller.caller)
    delete props.onload
    delete props.onunload
  }

  // Create the properties
  for (var p in props) {
    if (props.hasOwnProperty(p)) {
      var key = p.toLowerCase()
      var val = props[p]
      // Normalize className
      if (key === 'classname') {
        key = 'class'
        p = 'class'
      }
      // The for attribute gets transformed to htmlFor, but we just set as for
      if (p === 'htmlFor') {
        p = 'for'
      }
      // If a property is boolean, set itself to the key
      if (BOOL_PROPS[key]) {
        if (val === 'true') val = key
        else if (val === 'false') continue
      }
      // If a property prefers being set directly vs setAttribute
      if (key.slice(0, 2) === 'on') {
        el[p] = val
      } else {
        if (ns) {
          if (p === 'xlink:href') {
            el.setAttributeNS(XLINKNS, p, val)
          } else if (/^xmlns($|:)/i.test(p)) {
            // skip xmlns definitions
          } else {
            el.setAttributeNS(null, p, val)
          }
        } else {
          el.setAttribute(p, val)
        }
      }
    }
  }

  function appendChild (childs) {
    if (!Array.isArray(childs)) return
    for (var i = 0; i < childs.length; i++) {
      var node = childs[i]
      if (Array.isArray(node)) {
        appendChild(node)
        continue
      }

      if (typeof node === 'number' ||
        typeof node === 'boolean' ||
        typeof node === 'function' ||
        node instanceof Date ||
        node instanceof RegExp) {
        node = node.toString()
      }

      if (typeof node === 'string') {
        if (el.lastChild && el.lastChild.nodeName === '#text') {
          el.lastChild.nodeValue += node
          continue
        }
        node = document.createTextNode(node)
      }

      if (node && node.nodeType) {
        el.appendChild(node)
      }
    }
  }
  appendChild(children)

  return el
}

module.exports = hyperx(belCreateElement, {comments: true})
module.exports.default = module.exports
module.exports.createElement = belCreateElement

},{"global/document":29,"hyperx":32,"on-load":34}],28:[function(require,module,exports){

},{}],29:[function(require,module,exports){
(function (global){
var topLevel = typeof global !== 'undefined' ? global :
    typeof window !== 'undefined' ? window : {}
var minDoc = require('min-document');

var doccy;

if (typeof document !== 'undefined') {
    doccy = document;
} else {
    doccy = topLevel['__GLOBAL_DOCUMENT_CACHE@4'];

    if (!doccy) {
        doccy = topLevel['__GLOBAL_DOCUMENT_CACHE@4'] = minDoc;
    }
}

module.exports = doccy;

}).call(this,typeof global !== "undefined" ? global : typeof self !== "undefined" ? self : typeof window !== "undefined" ? window : {})
},{"min-document":28}],30:[function(require,module,exports){
(function (global){
var win;

if (typeof window !== "undefined") {
    win = window;
} else if (typeof global !== "undefined") {
    win = global;
} else if (typeof self !== "undefined"){
    win = self;
} else {
    win = {};
}

module.exports = win;

}).call(this,typeof global !== "undefined" ? global : typeof self !== "undefined" ? self : typeof window !== "undefined" ? window : {})
},{}],31:[function(require,module,exports){
module.exports = attributeToProperty

var transform = {
  'class': 'className',
  'for': 'htmlFor',
  'http-equiv': 'httpEquiv'
}

function attributeToProperty (h) {
  return function (tagName, attrs, children) {
    for (var attr in attrs) {
      if (attr in transform) {
        attrs[transform[attr]] = attrs[attr]
        delete attrs[attr]
      }
    }
    return h(tagName, attrs, children)
  }
}

},{}],32:[function(require,module,exports){
var attrToProp = require('hyperscript-attribute-to-property')

var VAR = 0, TEXT = 1, OPEN = 2, CLOSE = 3, ATTR = 4
var ATTR_KEY = 5, ATTR_KEY_W = 6
var ATTR_VALUE_W = 7, ATTR_VALUE = 8
var ATTR_VALUE_SQ = 9, ATTR_VALUE_DQ = 10
var ATTR_EQ = 11, ATTR_BREAK = 12
var COMMENT = 13

module.exports = function (h, opts) {
  if (!opts) opts = {}
  var concat = opts.concat || function (a, b) {
    return String(a) + String(b)
  }
  if (opts.attrToProp !== false) {
    h = attrToProp(h)
  }

  return function (strings) {
    var state = TEXT, reg = ''
    var arglen = arguments.length
    var parts = []

    for (var i = 0; i < strings.length; i++) {
      if (i < arglen - 1) {
        var arg = arguments[i+1]
        var p = parse(strings[i])
        var xstate = state
        if (xstate === ATTR_VALUE_DQ) xstate = ATTR_VALUE
        if (xstate === ATTR_VALUE_SQ) xstate = ATTR_VALUE
        if (xstate === ATTR_VALUE_W) xstate = ATTR_VALUE
        if (xstate === ATTR) xstate = ATTR_KEY
        p.push([ VAR, xstate, arg ])
        parts.push.apply(parts, p)
      } else parts.push.apply(parts, parse(strings[i]))
    }

    var tree = [null,{},[]]
    var stack = [[tree,-1]]
    for (var i = 0; i < parts.length; i++) {
      var cur = stack[stack.length-1][0]
      var p = parts[i], s = p[0]
      if (s === OPEN && /^\//.test(p[1])) {
        var ix = stack[stack.length-1][1]
        if (stack.length > 1) {
          stack.pop()
          stack[stack.length-1][0][2][ix] = h(
            cur[0], cur[1], cur[2].length ? cur[2] : undefined
          )
        }
      } else if (s === OPEN) {
        var c = [p[1],{},[]]
        cur[2].push(c)
        stack.push([c,cur[2].length-1])
      } else if (s === ATTR_KEY || (s === VAR && p[1] === ATTR_KEY)) {
        var key = ''
        var copyKey
        for (; i < parts.length; i++) {
          if (parts[i][0] === ATTR_KEY) {
            key = concat(key, parts[i][1])
          } else if (parts[i][0] === VAR && parts[i][1] === ATTR_KEY) {
            if (typeof parts[i][2] === 'object' && !key) {
              for (copyKey in parts[i][2]) {
                if (parts[i][2].hasOwnProperty(copyKey) && !cur[1][copyKey]) {
                  cur[1][copyKey] = parts[i][2][copyKey]
                }
              }
            } else {
              key = concat(key, parts[i][2])
            }
          } else break
        }
        if (parts[i][0] === ATTR_EQ) i++
        var j = i
        for (; i < parts.length; i++) {
          if (parts[i][0] === ATTR_VALUE || parts[i][0] === ATTR_KEY) {
            if (!cur[1][key]) cur[1][key] = strfn(parts[i][1])
            else cur[1][key] = concat(cur[1][key], parts[i][1])
          } else if (parts[i][0] === VAR
          && (parts[i][1] === ATTR_VALUE || parts[i][1] === ATTR_KEY)) {
            if (!cur[1][key]) cur[1][key] = strfn(parts[i][2])
            else cur[1][key] = concat(cur[1][key], parts[i][2])
          } else {
            if (key.length && !cur[1][key] && i === j
            && (parts[i][0] === CLOSE || parts[i][0] === ATTR_BREAK)) {
              // https://html.spec.whatwg.org/multipage/infrastructure.html#boolean-attributes
              // empty string is falsy, not well behaved value in browser
              cur[1][key] = key.toLowerCase()
            }
            if (parts[i][0] === CLOSE) {
              i--
            }
            break
          }
        }
      } else if (s === ATTR_KEY) {
        cur[1][p[1]] = true
      } else if (s === VAR && p[1] === ATTR_KEY) {
        cur[1][p[2]] = true
      } else if (s === CLOSE) {
        if (selfClosing(cur[0]) && stack.length) {
          var ix = stack[stack.length-1][1]
          stack.pop()
          stack[stack.length-1][0][2][ix] = h(
            cur[0], cur[1], cur[2].length ? cur[2] : undefined
          )
        }
      } else if (s === VAR && p[1] === TEXT) {
        if (p[2] === undefined || p[2] === null) p[2] = ''
        else if (!p[2]) p[2] = concat('', p[2])
        if (Array.isArray(p[2][0])) {
          cur[2].push.apply(cur[2], p[2])
        } else {
          cur[2].push(p[2])
        }
      } else if (s === TEXT) {
        cur[2].push(p[1])
      } else if (s === ATTR_EQ || s === ATTR_BREAK) {
        // no-op
      } else {
        throw new Error('unhandled: ' + s)
      }
    }

    if (tree[2].length > 1 && /^\s*$/.test(tree[2][0])) {
      tree[2].shift()
    }

    if (tree[2].length > 2
    || (tree[2].length === 2 && /\S/.test(tree[2][1]))) {
      throw new Error(
        'multiple root elements must be wrapped in an enclosing tag'
      )
    }
    if (Array.isArray(tree[2][0]) && typeof tree[2][0][0] === 'string'
    && Array.isArray(tree[2][0][2])) {
      tree[2][0] = h(tree[2][0][0], tree[2][0][1], tree[2][0][2])
    }
    return tree[2][0]

    function parse (str) {
      var res = []
      if (state === ATTR_VALUE_W) state = ATTR
      for (var i = 0; i < str.length; i++) {
        var c = str.charAt(i)
        if (state === TEXT && c === '<') {
          if (reg.length) res.push([TEXT, reg])
          reg = ''
          state = OPEN
        } else if (c === '>' && !quot(state) && state !== COMMENT) {
          if (state === OPEN) {
            res.push([OPEN,reg])
          } else if (state === ATTR_KEY) {
            res.push([ATTR_KEY,reg])
          } else if (state === ATTR_VALUE && reg.length) {
            res.push([ATTR_VALUE,reg])
          }
          res.push([CLOSE])
          reg = ''
          state = TEXT
        } else if (state === COMMENT && /-$/.test(reg) && c === '-') {
          if (opts.comments) {
            res.push([ATTR_VALUE,reg.substr(0, reg.length - 1)],[CLOSE])
          }
          reg = ''
          state = TEXT
        } else if (state === OPEN && /^!--$/.test(reg)) {
          if (opts.comments) {
            res.push([OPEN, reg],[ATTR_KEY,'comment'],[ATTR_EQ])
          }
          reg = c
          state = COMMENT
        } else if (state === TEXT || state === COMMENT) {
          reg += c
        } else if (state === OPEN && /\s/.test(c)) {
          res.push([OPEN, reg])
          reg = ''
          state = ATTR
        } else if (state === OPEN) {
          reg += c
        } else if (state === ATTR && /[^\s"'=/]/.test(c)) {
          state = ATTR_KEY
          reg = c
        } else if (state === ATTR && /\s/.test(c)) {
          if (reg.length) res.push([ATTR_KEY,reg])
          res.push([ATTR_BREAK])
        } else if (state === ATTR_KEY && /\s/.test(c)) {
          res.push([ATTR_KEY,reg])
          reg = ''
          state = ATTR_KEY_W
        } else if (state === ATTR_KEY && c === '=') {
          res.push([ATTR_KEY,reg],[ATTR_EQ])
          reg = ''
          state = ATTR_VALUE_W
        } else if (state === ATTR_KEY) {
          reg += c
        } else if ((state === ATTR_KEY_W || state === ATTR) && c === '=') {
          res.push([ATTR_EQ])
          state = ATTR_VALUE_W
        } else if ((state === ATTR_KEY_W || state === ATTR) && !/\s/.test(c)) {
          res.push([ATTR_BREAK])
          if (/[\w-]/.test(c)) {
            reg += c
            state = ATTR_KEY
          } else state = ATTR
        } else if (state === ATTR_VALUE_W && c === '"') {
          state = ATTR_VALUE_DQ
        } else if (state === ATTR_VALUE_W && c === "'") {
          state = ATTR_VALUE_SQ
        } else if (state === ATTR_VALUE_DQ && c === '"') {
          res.push([ATTR_VALUE,reg],[ATTR_BREAK])
          reg = ''
          state = ATTR
        } else if (state === ATTR_VALUE_SQ && c === "'") {
          res.push([ATTR_VALUE,reg],[ATTR_BREAK])
          reg = ''
          state = ATTR
        } else if (state === ATTR_VALUE_W && !/\s/.test(c)) {
          state = ATTR_VALUE
          i--
        } else if (state === ATTR_VALUE && /\s/.test(c)) {
          res.push([ATTR_VALUE,reg],[ATTR_BREAK])
          reg = ''
          state = ATTR
        } else if (state === ATTR_VALUE || state === ATTR_VALUE_SQ
        || state === ATTR_VALUE_DQ) {
          reg += c
        }
      }
      if (state === TEXT && reg.length) {
        res.push([TEXT,reg])
        reg = ''
      } else if (state === ATTR_VALUE && reg.length) {
        res.push([ATTR_VALUE,reg])
        reg = ''
      } else if (state === ATTR_VALUE_DQ && reg.length) {
        res.push([ATTR_VALUE,reg])
        reg = ''
      } else if (state === ATTR_VALUE_SQ && reg.length) {
        res.push([ATTR_VALUE,reg])
        reg = ''
      } else if (state === ATTR_KEY) {
        res.push([ATTR_KEY,reg])
        reg = ''
      }
      return res
    }
  }

  function strfn (x) {
    if (typeof x === 'function') return x
    else if (typeof x === 'string') return x
    else if (x && typeof x === 'object') return x
    else return concat('', x)
  }
}

function quot (state) {
  return state === ATTR_VALUE_SQ || state === ATTR_VALUE_DQ
}

var hasOwn = Object.prototype.hasOwnProperty
function has (obj, key) { return hasOwn.call(obj, key) }

var closeRE = RegExp('^(' + [
  'area', 'base', 'basefont', 'bgsound', 'br', 'col', 'command', 'embed',
  'frame', 'hr', 'img', 'input', 'isindex', 'keygen', 'link', 'meta', 'param',
  'source', 'track', 'wbr', '!--',
  // SVG TAGS
  'animate', 'animateTransform', 'circle', 'cursor', 'desc', 'ellipse',
  'feBlend', 'feColorMatrix', 'feComposite',
  'feConvolveMatrix', 'feDiffuseLighting', 'feDisplacementMap',
  'feDistantLight', 'feFlood', 'feFuncA', 'feFuncB', 'feFuncG', 'feFuncR',
  'feGaussianBlur', 'feImage', 'feMergeNode', 'feMorphology',
  'feOffset', 'fePointLight', 'feSpecularLighting', 'feSpotLight', 'feTile',
  'feTurbulence', 'font-face-format', 'font-face-name', 'font-face-uri',
  'glyph', 'glyphRef', 'hkern', 'image', 'line', 'missing-glyph', 'mpath',
  'path', 'polygon', 'polyline', 'rect', 'set', 'stop', 'tref', 'use', 'view',
  'vkern'
].join('|') + ')(?:[\.#][a-zA-Z0-9\u007F-\uFFFF_:-]+)*$')
function selfClosing (tag) { return closeRE.test(tag) }

},{"hyperscript-attribute-to-property":31}],33:[function(require,module,exports){
assert.notEqual = notEqual
assert.notOk = notOk
assert.equal = equal
assert.ok = assert

module.exports = assert

function equal (a, b, m) {
  assert(a == b, m) // eslint-disable-line eqeqeq
}

function notEqual (a, b, m) {
  assert(a != b, m) // eslint-disable-line eqeqeq
}

function notOk (t, m) {
  assert(!t, m)
}

function assert (t, m) {
  if (!t) throw new Error(m || 'AssertionError')
}

},{}],34:[function(require,module,exports){
/* global MutationObserver */
var document = require('global/document')
var window = require('global/window')
var assert = require('assert')
var watch = Object.create(null)
var KEY_ID = 'onloadid' + (new Date() % 9e6).toString(36)
var KEY_ATTR = 'data-' + KEY_ID
var INDEX = 0

if (window && window.MutationObserver) {
  var observer = new MutationObserver(function (mutations) {
    if (Object.keys(watch).length < 1) return
    for (var i = 0; i < mutations.length; i++) {
      if (mutations[i].attributeName === KEY_ATTR) {
        eachAttr(mutations[i], turnon, turnoff)
        continue
      }
      eachMutation(mutations[i].removedNodes, turnoff)
      eachMutation(mutations[i].addedNodes, turnon)
    }
  })
  if (document.body) {
    beginObserve(observer)
  } else {
    document.addEventListener('DOMContentLoaded', function (event) {
      beginObserve(observer)
    })
  }
}

function beginObserve (observer) {
  observer.observe(document.body, {
    childList: true,
    subtree: true,
    attributes: true,
    attributeOldValue: true,
    attributeFilter: [KEY_ATTR]
  })
}

module.exports = function onload (el, on, off, caller) {
  assert(document.body, 'on-load: will not work prior to DOMContentLoaded')
  on = on || function () {}
  off = off || function () {}
  el.setAttribute(KEY_ATTR, 'o' + INDEX)
  watch['o' + INDEX] = [on, off, 0, caller || onload.caller]
  INDEX += 1
  return el
}

module.exports.KEY_ATTR = KEY_ATTR
module.exports.KEY_ID = KEY_ID

function turnon (index, el) {
  if (watch[index][0] && watch[index][2] === 0) {
    watch[index][0](el)
    watch[index][2] = 1
  }
}

function turnoff (index, el) {
  if (watch[index][1] && watch[index][2] === 1) {
    watch[index][1](el)
    watch[index][2] = 0
  }
}

function eachAttr (mutation, on, off) {
  var newValue = mutation.target.getAttribute(KEY_ATTR)
  if (sameOrigin(mutation.oldValue, newValue)) {
    watch[newValue] = watch[mutation.oldValue]
    return
  }
  if (watch[mutation.oldValue]) {
    off(mutation.oldValue, mutation.target)
  }
  if (watch[newValue]) {
    on(newValue, mutation.target)
  }
}

function sameOrigin (oldValue, newValue) {
  if (!oldValue || !newValue) return false
  return watch[oldValue][3] === watch[newValue][3]
}

function eachMutation (nodes, fn) {
  var keys = Object.keys(watch)
  for (var i = 0; i < nodes.length; i++) {
    if (nodes[i] && nodes[i].getAttribute && nodes[i].getAttribute(KEY_ATTR)) {
      var onloadid = nodes[i].getAttribute(KEY_ATTR)
      keys.forEach(function (k) {
        if (onloadid === k) {
          fn(k, nodes[i])
        }
      })
    }
    if (nodes[i].childNodes.length > 0) {
      eachMutation(nodes[i].childNodes, fn)
    }
  }
}

},{"assert":33,"global/document":29,"global/window":30}]},{},[10]);
