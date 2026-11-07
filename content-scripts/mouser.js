// content-scripts/mouser.js

(function () {
  "use strict";

  // Parse a localized integer quantity, e.g. "1,000" or "1.000".
  function parseQty(text) {
    var m = String(text || "").replace(/\s|\u00a0/g, "").match(/[0-9][0-9.,]*/);
    if (!m) return NaN;
    return parseInt(m[0].replace(/[.,]/g, ""), 10);
  }

  // Parse a localized price, e.g. "$1,234.56", "1.234,56 \u20ac" or "R$ 0,10".
  function parseMoney(text) {
    var s = String(text || "").replace(/\s|\u00a0/g, "");
    var m = s.match(/[0-9][0-9.,]*/);
    if (!m) return null;
    var n = m[0];
    var host = typeof location !== "undefined" ? location.hostname : "";
    var commaDecimal = /(^|\.)de$/.test(host) || /(^|\.)com\.br$/.test(host)
      || /\u20ac/.test(s) || /R\$/.test(s) || /,\d{1,2}$/.test(n);
    if (commaDecimal) {
      n = n.replace(/\./g, "").replace(",", ".");
    } else {
      var lastComma = n.lastIndexOf(",");
      var lastDot = n.lastIndexOf(".");
      if (lastComma !== -1 && lastDot !== -1) {
        n = lastComma > lastDot ? n.replace(/\./g, "").replace(",", ".") : n.replace(/,/g, "");
      } else if (lastComma !== -1) {
        var decimals = n.length - lastComma - 1;
        n = decimals === 3 ? n.replace(/,/g, "") : n.replace(",", ".");
      }
    }
    var value = parseFloat(n);
    return isNaN(value) ? null : value;
  }

  // Normalize European shop values: "4,7 kOhm" -> "4.7 kOhm", "4,7 \u00b5F" -> "4.7 uF".
  function normalizeNumberText(raw) {
    return String(raw || "")
      .replace(/[\u00b5\u03bc]/g, "u")
      .replace(/[\u03a9\u2126]/g, "Ohm")
      .replace(/(\d),(\d)/g, "$1.$2");
  }

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

  function getText(id) {
    var el = document.getElementById(id);
    return el ? el.textContent.trim() : "";
  }

  // Parse all price breaks from the page
  // Returns array of {qty, price} sorted by qty ascending
  function parsePriceBreaks() {
    var breaks = [];

    // Confirmed Mouser structure (from live page inspection):
    // row 0: 0td 3th  -> "Qty." | "Unit Price" | "Ext. Price"  (header)
    // row 1: 0td 1th  -> "Cut Tape / MouseReel" (section label)
    // row 2: 2td 1th  -> th="1"    td="$0.26"  td="$0.26"
    // row 3: 2td 1th  -> th="10"   td="$0.148" td="$1.48"
    // Each data row: 1 <th> = qty, 2 <td> = [unit price, ext price]

    var allTables = document.querySelectorAll("table");
    for (var t = 0; t < allTables.length; t++) {
      var rows = allTables[t].querySelectorAll("tr");
      var found = [];

      for (var r = 0; r < rows.length; r++) {
        var tds = rows[r].querySelectorAll("td");
        var ths = rows[r].querySelectorAll("th");

        // Data row: exactly 2 td + 1 th
        if (tds.length === 2 && ths.length === 1) {
          // th = qty (may be a link or plain text)
          var qty = parseQty(ths[0].textContent);
          if (isNaN(qty) || qty <= 0) continue;

          // tds[0] = unit price, tds[1] = ext price
          var priceText = tds[0].textContent;
          if (!/\$|\u20ac/.test(priceText)) continue;
          var price = parseMoney(priceText);
          if (price === null) continue;

          found.push({ qty: qty, price: price });
        }
      }

      if (found.length > 0) {
        found.sort(function(a, b) { return a.qty - b.qty; });
        breaks = found;
        break;
      }
    }

    return breaks;
  }

  function selectPriceBreak(breaks, targetQty) {
    if (breaks.length === 0) return null;

    // Exact match
    for (var i = 0; i < breaks.length; i++) {
      if (breaks[i].qty === targetQty) return breaks[i];
    }

    // Largest qty that is still <= target
    var best = null;
    for (var j = 0; j < breaks.length; j++) {
      if (breaks[j].qty <= targetQty) best = breaks[j];
    }
    if (best) return best;

    // All breaks are > target: return smallest (closest above)
    return breaks[0];
  }

  function scrape() {
    var data = {
      vendor: "Mouser",
      value: "", datasheet: "", description: "",
      manufacturer: "", partNumber: "",
      vendorPartNumber: "", vendorPrice: "",
      msrp: "", quantity: "",
    };

    console.log("[KiCad Clipper] Scraping Mouser...");

    data.vendorPartNumber = getText("divMouserPartNum")
      || getText("spnMouserPartNumFormattedForProdInfo");

    data.partNumber = getText("spnManufacturerPartNumber")
      || (document.querySelector("h1") ? document.querySelector("h1").textContent.trim() : "");

    data.manufacturer = getText("lnkManufacturerName");

    data.description = getText("spnDescription")
      || getText("detail-feature-desc");

    // Smart Value: extract R/C/L from specs table
    function findSpec(labelPattern) {
      var rows = document.querySelectorAll("table tr");
      for (var i = 0; i < rows.length; i++) {
        var cells = rows[i].querySelectorAll("td");
        if (cells.length < 2) continue;
        if (labelPattern.test(cells[0].textContent.trim())) {
          return cells[1].textContent.trim();
        }
      }
      return "";
    }

    function formatValue(raw, type) {
      if (!raw) return "";
      raw = normalizeNumberText(raw).trim();
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

    var resistance  = findSpec(/^(?:Resistance|Widerstand|Widerstandswert):?$/i);
    var capacitance = findSpec(/^(?:Capacitance|Kapazit(?:\u00e4|ae)t):?$/i);
    var inductance  = findSpec(/^(?:Inductance|Induktivit(?:\u00e4|ae)t):?$/i);

    if (resistance) {
      data.value = formatValue(resistance, "R");
    } else if (capacitance) {
      data.value = formatValue(capacitance, "C");
    } else if (inductance) {
      data.value = formatValue(inductance, "L");
    } else {
      data.value = data.partNumber || data.description;
    }

    // Datasheet
    var dsEl = document.getElementById("pdp-datasheet_0");
    if (dsEl) {
      var dsA = dsEl.tagName === "A" ? dsEl : (dsEl.closest("a") || dsEl.querySelector("a"));
      if (dsA && dsA.href) data.datasheet = dsA.href;
    }
    if (!data.datasheet) {
      var dsLinks = document.querySelectorAll('a[id*="datasheet"], a[href*="datasheet"]');
      for (var i = 0; i < dsLinks.length; i++) {
        if (dsLinks[i].href) { data.datasheet = dsLinks[i].href; break; }
      }
    }

    // Price breaks
    var breaks = parsePriceBreaks();
    console.log("[KiCad Clipper] Price breaks:", JSON.stringify(breaks));

    // eVendor Price = unit price at minimum qty (first break)
    if (breaks.length > 0) {
      data.vendorPrice = breaks[0].price.toFixed(2);
    }

    // MSRP = price at qty closest to 100
    var msrpBreak = selectPriceBreak(breaks, 100);
    if (msrpBreak) {
      data.msrp     = msrpBreak.price.toFixed(2);
      data.quantity  = String(msrpBreak.qty);
    }

    console.log("[KiCad Clipper] Result:", JSON.stringify(data, null, 2));
    return data;
  }

  function waitForProduct(callback) {
    var check = function() {
      var el = document.getElementById("spnManufacturerPartNumber")
        || document.getElementById("spnDescription");
      return el && el.textContent.trim().length > 0;
    };
    if (check()) { setTimeout(callback, 500); return; }
    var observer = new MutationObserver(function() {
      if (check()) { observer.disconnect(); setTimeout(callback, 600); }
    });
    observer.observe(document.body, { childList: true, subtree: true });
    setTimeout(function() { observer.disconnect(); callback(); }, 7000);
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

})();
