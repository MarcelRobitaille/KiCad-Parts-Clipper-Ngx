// content-scripts/digikey.js

(function () {
  "use strict";

  // digikey.de is localized in German, so labels are matched in both languages.
  var LABELS = {
    manufacturerProductNumber: [
      "Manufacturer Product Number",
      "Herstellerproduktnummer",
      "Hersteller-Produktnummer",
      "Hersteller Produktnummer",
    ],
    category: ["Category", "Kategorie"],
    detailedDescription: [
      "Detailed Description",
      "Detaillierte Beschreibung",
      "Ausf\u00fchrliche Beschreibung",
    ],
    description: ["Description", "Beschreibung", "Produktbeschreibung"],
    manufacturer: ["Manufacturer", "Hersteller"],
    digikeyPartNumber: [
      "DigiKey Part Number",
      "DigiKey-Teilenummer",
      "DigiKey Teilenummer",
      "DigiKey Artikelnummer",
      "DigiKey-Bestellnummer",
    ],
    datasheet: ["Datasheet", "Datenblatt"],
  };

  function labelMatches(text, labels) {
    var normalized = String(text || "")
      .replace(/\s+/g, " ")
      .replace(/:\s*$/, "")
      .trim()
      .toLowerCase();
    for (var i = 0; i < labels.length; i++) {
      if (normalized === labels[i].toLowerCase()) return true;
    }
    return false;
  }

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

  // Find value cell by matching label text in sibling TD
  // Digikey layout: <tr><td>Label</td><td class="tdBold">Value</td></tr>
  function findByLabel(labels) {
    if (typeof labels === "string") labels = [labels];
    var cells = document.querySelectorAll("td");
    for (var i = 0; i < cells.length; i++) {
      if (labelMatches(cells[i].textContent, labels)) {
        var next = cells[i].nextElementSibling;
        if (next) return next.textContent.trim();
      }
    }
    return "";
  }

  // Same but returns href of first link in value cell
  function findHrefByLabel(labels) {
    if (typeof labels === "string") labels = [labels];
    var cells = document.querySelectorAll("td");
    for (var i = 0; i < cells.length; i++) {
      if (labelMatches(cells[i].textContent, labels)) {
        var next = cells[i].nextElementSibling;
        if (next) {
          var a = next.querySelector("a");
          if (a && a.href) return a.href;
        }
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
      var qty = parseQty(cells[0].textContent);
      if (isNaN(qty) || qty <= 0) continue;
      for (var c = 1; c < cells.length; c++) {
        var priceText = cells[c].textContent;
        if (!/\$|\u20ac/.test(priceText)) continue;
        var price = parseMoney(priceText);
        if (price !== null) {
          breaks.push({ qty: qty, price: price });
          break;
        }
      }
    }
    breaks.sort(function(a, b) { return a.qty - b.qty; });
    // Deduplicate
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
      vendor: "Digikey",
      value: "", datasheet: "", description: "",
      manufacturer: "", partNumber: "",
      vendorPartNumber: "", vendorPrice: "",
      msrp: "", quantity: "",
    };

    console.log("[KiCad Clipper] Scraping Digikey...");

    // Manufacturer Part# - exact label match (English or German)
    data.partNumber = findByLabel(LABELS.manufacturerProductNumber);

    // Smart Value: for R/C/L use the component value, otherwise use part#
    // Scan all spec labels using any div/span that is a label in the attribute table
    // Strategy: find element whose text matches label, get sibling text
    function findSpec(labelPattern) {
      var all = document.querySelectorAll("div, span, td");
      for (var i = 0; i < all.length; i++) {
        var el = all[i];
        if (el.children.length === 0 && labelPattern.test(el.textContent.trim())) {
          // Try next sibling
          var sib = el.nextElementSibling;
          if (sib && sib.textContent.trim() && sib.textContent.trim().length < 60) {
            return sib.textContent.trim();
          }
          // Try parent's next sibling
          var par = el.parentElement;
          if (par) {
            var parSib = par.nextElementSibling;
            if (parSib && parSib.textContent.trim() && parSib.textContent.trim().length < 60) {
              return parSib.textContent.trim();
            }
          }
        }
      }
      return "";
    }

    // Format component values to EE shorthand
    // Resistors: 4.7 kOhms -> 4.7k, 47 Ohms -> 47R, 0 Ohms -> 0R
    // Capacitors: 100 pF -> 100p, 4.7 uF -> 4.7u, 1 nF -> 1n
    // Inductors:  10 uH -> 10u, 1 mH -> 1m, 100 nH -> 100n
    function formatValue(raw, type) {
      if (!raw) return "";
      raw = normalizeNumberText(raw).trim();

      var m = raw.match(/^([\d.]+)\s*([a-zA-Z]+)/);
      if (!m) return raw;
      var num = parseFloat(m[1]);
      var unit = m[2].toLowerCase();

      if (type === "R") {
        if (unit.match(/^mohm/) || unit === "mohms") return num + "M";
        if (unit.match(/^kohm/) || unit === "kohms") return num + "K";
        if (unit.match(/^ohm/)  || unit === "ohms")  return (num === 0 ? "0R" : num + "R");
        if (unit === "m") return num + "M";
        if (unit === "k") return num + "K";
        return num + "R";
      }
      if (type === "C") {
        if (unit === "pf") return num + "pF";
        if (unit === "nf") return num + "nF";
        if (unit === "uf" || unit === "ufd") return num + "uF";
        if (unit === "mf" || unit === "mfd") return num + "mF";
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

    // Check category to detect R/C/L
    var category = findByLabel(LABELS.category) || "";
    var resistance  = findSpec(/^(Resistance|Widerstand|Widerstandswert)$/i);
    var capacitance = findSpec(/^(Capacitance|Kapazit(?:\u00e4|ae)t)$/i);
    var inductance  = findSpec(/^(Inductance|Induktivit(?:\u00e4|ae)t)$/i);

    if (resistance) {
      data.value = formatValue(resistance, "R");
    } else if (capacitance) {
      data.value = formatValue(capacitance, "C");
    } else if (inductance) {
      data.value = formatValue(inductance, "L");
    } else {
      data.value = data.partNumber;
    }

    // Description - prefer Detailed Description
    data.description = findByLabel(LABELS.detailedDescription)
      || findByLabel(LABELS.description);

    // Manufacturer
    data.manufacturer = findByLabel(LABELS.manufacturer);
    // Strip trailing whitespace/newlines from manufacturer (may contain link text)
    if (data.manufacturer) {
      data.manufacturer = data.manufacturer.split("\n")[0].trim();
    }

    // DigiKey Part# - cell contains multiple lines like:
    // "160-1179-2-ND - Tape & Reel\n160-1179-1-ND - Cut Tape (CT)\n..."
    // Prefer Cut Tape (CT), fallback to first line
    var dkRaw = findByLabel(LABELS.digikeyPartNumber);
    if (dkRaw) {
      var lines = dkRaw.split("\n").map(function(l) { return l.trim(); }).filter(Boolean);
      var ctLine = "";
      for (var i = 0; i < lines.length; i++) {
        if (lines[i].match(/Cut Tape|CT|Schnittband/i)) { ctLine = lines[i]; break; }
      }
      // Extract just the part number (before the dash separator)
      var chosen = ctLine || lines[0] || "";
      var pnMatch = chosen.match(/^([A-Z0-9\-]+)/i);
      data.vendorPartNumber = pnMatch ? pnMatch[1] : chosen.split(" ")[0];
    }

    // Datasheet - link with text "Datasheet" / "Datenblatt"
    var allLinks = document.querySelectorAll("a");
    for (var j = 0; j < allLinks.length; j++) {
      var a = allLinks[j];
      if (labelMatches(a.textContent, LABELS.datasheet) && a.href) {
        data.datasheet = a.href;
        break;
      }
    }

    // Price breaks
    var breaks = parsePriceBreaks();
    console.log("[KiCad Clipper] Price breaks:", JSON.stringify(breaks));

    if (breaks.length > 0) {
      data.vendorPrice = breaks[0].price.toFixed(5).replace(/\.?0+$/, "");
      // Use reasonable decimal places
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

  function waitForProduct(callback) {
    // Wait for the product table to appear
    var check = function() {
      var cells = document.querySelectorAll("td");
      for (var i = 0; i < cells.length; i++) {
        if (labelMatches(cells[i].textContent, LABELS.manufacturerProductNumber)) return true;
      }
      return false;
    };
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

})();
