// browser-polyfill.js - makes browser.* work in Chrome
if (typeof browser === "undefined") {
  var browser = chrome;
}
