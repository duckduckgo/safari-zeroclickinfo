'use strict';

var _abpFilterParser = require('./abp-filter-parser.js');

var _fs = require('fs');

var _fs2 = _interopRequireDefault(_fs);

var _bloomFilterJs = require('bloom-filter-js');

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

console.log((0, _abpFilterParser.getFingerprint)('oauth.googleusercontent.com/gadgets/js/core:rpc:shindig.random:shindig.sha1.js?c=2'));

function discoverMatchingPrefix(bloomFilter, str) {
  var prefixLen = arguments.length > 2 && arguments[2] !== undefined ? arguments[2] : 8;

  if (!bloomFilter.substringExists(str, prefixLen)) {
    console.log('no substring exists for url:', str);
  }
  for (var i = 0; i < str.length - prefixLen + 1; i++) {
    var sub = str.substring(i, i + prefixLen);
    var cleaned = sub.replace(/^https?:\/\//, '');
    if (bloomFilter.exists(cleaned)) {
      console.log('bad-fingerprint:', sub, 'for url:', str);
    }
  }
}

var sitesToCheck = ['http://c.s-microsoft.com/en-ca/CMSImages/store_symbol.png?version=e2eecca5-4550-10c6-57b1-5114804a4c01'];

_fs2.default.readFile('./test/data/easylist.txt', 'utf8', function (err, data) {
  if (err) {
    return console.log(err);
  }

  var parserData = {};
  (0, _abpFilterParser.parse)(data, parserData);

  // Write out the bloom filter data files
  _fs2.default.writeFileSync('dist/bloomFilterData', new Buffer(new Uint8Array(parserData.bloomFilter.toJSON())));
  _fs2.default.writeFileSync('dist/exceptionBloomFilterData', new Buffer(new Uint8Array(parserData.exceptionBloomFilter.toJSON())));

  var readData = _fs2.default.readFileSync('./dist/bloomFilterData');
  var bloomData = new _bloomFilterJs.BloomFilter(new Uint8Array(readData));
  console.log(bloomData);
  var bloomFilter = new _bloomFilterJs.BloomFilter(bloomData);

  //console.log('Number of filters processed: ', parserData.filterCount);


  console.log('-------');
  sitesToCheck.forEach(function (s) {
    return discoverMatchingPrefix(bloomFilter /*parserData.bloomFilter*/, s);
  });

  // WRite out the POD cached filter data JSM
  delete parserData.bloomFilter;
  delete parserData.exceptionBloomFilter;
  var cachedFilterDataJSM = 'dump("######Loaded cached-rules.jsm\\n");\nthis.EXPORTED_SYMBOLS = ["parserData"];\nthis.parserData = ' + JSON.stringify(parserData) + ';\n';
  _fs2.default.writeFileSync('cachedFilterData.jsm', cachedFilterDataJSM);
});
//# sourceMappingURL=extractInfo.js.map