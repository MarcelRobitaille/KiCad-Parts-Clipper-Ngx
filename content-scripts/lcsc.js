// content-scripts/lcsc.js

(function () {
  "use strict";

  function buildKiCadTSV(data) {
    var v = function(n, val) { return n + "\t" + val + "\t1\t0\tLeft\tCenter\t0\t0"; };
    var h = function(n, val) { return n + "\t" + val + "\t0\t0\tCenter\tCenter\t0\t0"; };
    return [
      v("Value",         data.value            || ""),
      h("Footprint",     ""),
      h("Datasheet",     data.datasheet        || ""),
      h("Description",   data.description      || ""),
      h("Manufacturer",  data.manufacturer     || ""),
      h("eVendor",       data.vendor           || ""),
      h("eVendor Part#", data.vendorPartNumber || ""),
      h("eVendor Price", data.vendorPrice      || ""),
      h("Part#",         data.partNumber       || ""),
      h("MSRP",          data.msrp             || ""),
      h("Quantity",      data.quantity         || ""),
    ].join("\n");
  }

  // Find sibling value by exact label text in TD
  function findByLabel(labelText) {
    var cells = document.querySelectorAll("td");
    for (var i = 0; i < cells.length; i++) {
      if (cells[i].textContent.trim() === labelText && cells[i].children.length === 0) {
        var next = cells[i].nextElementSibling;
        if (next) return next.textContent.trim();
      }
    }
    return "";
  }

  function parsePriceBreaks() {
    var breaks = [];
    var allRows = document.querySelectorAll("table tr");
    for (var r = 0; r < allRows.length; r++) {
      var cells = allRows[r].querySelectorAll("td");
      if (cells.length < 2) continue;
      // LCSC qty format: "100+" or "1,000+"
      var qtyText = cells[0].textContent.trim().replace(/,/g, "").replace(/\+/g, "").trim();
      var qty = parseInt(qtyText, 10);
      if (isNaN(qty) || qty <= 0) continue;
      for (var c = 1; c < cells.length; c++) {
        var m = cells[c].textContent.match(/\$\s*([\d,]+\.[\d]+)/);
        if (m) {
          breaks.push({ qty: qty, price: parseFloat(m[1].replace(/,/g, "")) });
          break;
        }
      }
    }
    breaks.sort(function(a, b) { return a.qty - b.qty; });
    var unique = [];
    for (var i = 0; i < breaks.length; i++) {
      if (unique.length === 0 || unique[unique.length-1].qty !== breaks[i].qty)
        unique.push(breaks[i]);
    }
    return unique;
  }

  function selectPriceBreak(breaks, targetQty) {
    if (breaks.length === 0) return null;
    for (var i = 0; i < breaks.length; i++) {
      if (breaks[i].qty === targetQty) return breaks[i];
    }
    var best = null;
    for (var j = 0; j < breaks.length; j++) {
      if (breaks[j].qty <= targetQty) best = breaks[j];
    }
    return best || breaks[0];
  }

  function scrape() {
    var data = {
      vendor: "LCSC",
      value: "", datasheet: "", description: "",
      manufacturer: "", partNumber: "",
      vendorPartNumber: "", vendorPrice: "",
      msrp: "", quantity: "",
    };

    console.log("[KiCad Clipper] Scraping LCSC...");

    data.partNumber       = findByLabel("Mfr. Part #");
    data.vendorPartNumber = findByLabel("LCSC Part #");
    data.description      = findByLabel("Description");

    // Smart Value: format R/C/L values, else use part#
    // LCSC formats: "10kOhm", "10kohm", "10k\u03a9", "47\u03a9", "100pF", "10uH"
    function formatValue(raw, type) {
      if (!raw) return "";
      raw = raw.trim();
      // Normalize omega symbol to "ohm"
      raw = raw.replace(/\u03a9/g, "ohm");
      var m = raw.match(/^([\d.]+)\s*([a-zA-Z]+)/);
      if (!m) return raw;
      var num = parseFloat(m[1]);
      var unit = m[2].toLowerCase();
      if (type === "R") {
        if (unit.match(/^mohm/)) return num + "M";
        if (unit.match(/^kohm/) || unit === "k") return num + "K";
        if (unit.match(/^ohm/)  || unit === "r") return (num === 0 ? "0R" : num + "R");
        return num + "R";
      }
      if (type === "C") {
        if (unit === "pf") return num + "pF";
        if (unit === "nf") return num + "nF";
        if (unit === "uf" || unit === "ufd") return num + "uF";
        if (unit === "mf") return num + "mF";
        return raw;
      }
      if (type === "L") {
        if (unit === "nh") return num + "nH";
        if (unit === "uh") return num + "uH";
        if (unit === "mh") return num + "mH";
        if (unit === "h")  return num + "H";
        return raw;
      }
      return raw;
    }

    var resistance  = findByLabel("Resistance");
    var capacitance = findByLabel("Capacitance");
    var inductance  = findByLabel("Inductance");

    if (resistance) {
      data.value = formatValue(resistance, "R");
    } else if (capacitance) {
      data.value = formatValue(capacitance, "C");
    } else if (inductance) {
      data.value = formatValue(inductance, "L");
    } else {
      data.value = data.partNumber || data.description;
    }

    // Manufacturer: two TDs match, prefer the one without "Asian Brands"
    var mfgCells = document.querySelectorAll("td");
    for (var i = 0; i < mfgCells.length; i++) {
      if (mfgCells[i].textContent.trim() === "Manufacturer" && mfgCells[i].children.length === 0) {
        var next = mfgCells[i].nextElementSibling;
        if (next) {
          // Strip badge text like "Asian Brands"
          var raw = next.textContent.trim();
          // Get first text node only (before badge spans)
          var firstNode = next.firstChild;
          if (firstNode && firstNode.nodeType === 3) {
            raw = firstNode.textContent.trim();
          } else {
            // fallback: take first word sequence before any badge
            raw = raw.replace(/Asian Brands|Hot|New/gi, "").trim();
          }
          if (raw) { data.manufacturer = raw; break; }
        }
      }
    }

    // Datasheet: first lcsc.com/datasheet URL
    var allLinks = document.querySelectorAll("a");
    for (var j = 0; j < allLinks.length; j++) {
      if (allLinks[j].href && allLinks[j].href.match(/lcsc\.com\/datasheet\/C\d+/i)) {
        data.datasheet = allLinks[j].href;
        break;
      }
    }

    // Price breaks
    var breaks = parsePriceBreaks();
    console.log("[KiCad Clipper] Price breaks:", JSON.stringify(breaks));

    if (breaks.length > 0) {
      data.vendorPrice = parseFloat(breaks[0].price).toFixed(4);
    }

    var msrpBreak = selectPriceBreak(breaks, 100);
    if (msrpBreak) {
      data.msrp     = parseFloat(msrpBreak.price).toFixed(4);
      data.quantity  = String(msrpBreak.qty);
    }

    console.log("[KiCad Clipper] Result:", JSON.stringify(data, null, 2));
    return data;
  }

  function isProductPage() {
    var cells = document.querySelectorAll("td");
    for (var i = 0; i < cells.length; i++) {
      if (cells[i].textContent.trim() === "Mfr. Part #" && cells[i].children.length === 0) return true;
    }
    return false;
  }

  function waitForProduct(callback) {
    var check = isProductPage;
    if (check()) { setTimeout(callback, 300); return; }
    var observer = new MutationObserver(function() {
      if (check()) { observer.disconnect(); setTimeout(callback, 400); }
    });
    observer.observe(document.body, { childList: true, subtree: true });
    setTimeout(function() { observer.disconnect(); callback(); }, 8000);
  }

  var cachedData = null;
  var cachedTsv  = null;

  browser.runtime.onMessage.addListener(function(msg, _sender, sendResponse) {
    if (msg.type !== "KICAD_CLIPPER_GET") return;
    if (cachedData) { sendResponse({ data: cachedData, tsv: cachedTsv }); return true; }
    waitForProduct(function() {
      cachedData = scrape();
      cachedTsv  = buildKiCadTSV(cachedData);
      sendResponse({ data: cachedData, tsv: cachedTsv });
    });
    return true;
  });

  waitForProduct(function() {
    cachedData = scrape();
    cachedTsv  = buildKiCadTSV(cachedData);
    console.log("[KiCad Clipper] Pre-scraped and ready.");
  });

  // Shared API for the on-page "Copy to KiCad" button.
  globalThis.__kicadClipperHost = {
    vendor: "lcsc",
    isProductPage: isProductPage,
    waitForProduct: waitForProduct,
    getData: function () {
      cachedData = scrape();
      cachedTsv  = buildKiCadTSV(cachedData);
      return cachedData;
    },
  };

})();
