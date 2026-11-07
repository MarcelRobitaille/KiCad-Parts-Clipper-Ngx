// popup.js - Firefox MV3, ASCII only

(function () {
  "use strict";

  var VENDOR_DOMAINS = {
    digikey: ["digikey.com", "digikey.com.br"],
    mouser:  ["mouser.com",  "mouser.com.br"],
    lcsc:    ["lcsc.com"],
  };

  function detectVendor(url) {
    try {
      var host = new URL(url).hostname.replace(/^www\./, "");
      var vendors = Object.keys(VENDOR_DOMAINS);
      for (var i = 0; i < vendors.length; i++) {
        var vendor = vendors[i];
        var domains = VENDOR_DOMAINS[vendor];
        for (var j = 0; j < domains.length; j++) {
          if (host === domains[j] || host.endsWith("." + domains[j])) return vendor;
        }
      }
    } catch (e) {}
    return null;
  }

  function vendorLabel(v) {
    return { digikey: "Digikey", mouser: "Mouser", lcsc: "LCSC" }[v] || "Unknown";
  }

  var FIELD_DISPLAY = [
    ["Value",          "value",            true ],
    ["Part#",          "partNumber",       false],
    ["eVendor Part#",  "vendorPartNumber", false],
    ["eVendor Price",  "vendorPrice",      false],
    ["Manufacturer",   "manufacturer",     false],
    ["Description",    "description",      false],
    ["Datasheet",      "datasheet",        false],
    ["MSRP",           "msrp",             false],
    ["Quantity",       "quantity",         false],
  ];

  function renderPreview(data, vendor) {
    var main = document.getElementById("main-content");

    var badge = document.createElement("div");
    badge.className = "vendor-badge " + (vendor || "unknown");
    badge.innerHTML = '<div class="vendor-dot"></div>' + vendorLabel(vendor);

    var fields = document.createElement("div");
    fields.className = "fields";

    for (var i = 0; i < FIELD_DISPLAY.length; i++) {
      var label = FIELD_DISPLAY[i][0];
      var key   = FIELD_DISPLAY[i][1];
      var hl    = FIELD_DISPLAY[i][2];
      var val   = data[key] || "";

      var row = document.createElement("div");
      row.className = "field-row";

      var nameEl = document.createElement("div");
      nameEl.className = "field-name";
      nameEl.textContent = label;

      var valEl = document.createElement("div");
      valEl.className = "field-value" + (val ? (hl ? " highlight" : "") : " empty");
      valEl.title = val || "-";

      if (key === "datasheet" && val) {
        try { valEl.textContent = new URL(val).hostname + "/..."; }
        catch (e) { valEl.textContent = val; }
      } else {
        valEl.textContent = val || "-";
      }

      row.appendChild(nameEl);
      row.appendChild(valEl);
      fields.appendChild(row);
    }

    var btn = document.createElement("button");
    btn.className = "btn-copy";
    btn.id = "btn-copy";
    btn.innerHTML =
      '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">' +
      '<rect x="9" y="9" width="13" height="13" rx="2" ry="2"/>' +
      '<path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>' +
      '</svg> COPY TO KICAD';

    var status = document.createElement("div");
    status.className = "status";
    status.id = "status";
    status.textContent = "Ready - paste into KiCad symbol fields";

    main.innerHTML = "";
    main.appendChild(badge);
    main.appendChild(fields);
    main.appendChild(btn);
    main.appendChild(status);

    return { btn: btn, status: status };
  }

  function setStatus(el, msg, type) {
    el.textContent = msg;
    el.className = "status " + (type || "");
  }

  function showError(html) {
    document.getElementById("main-content").innerHTML = html;
  }

  function init() {
    browser.tabs.query({ active: true, currentWindow: true }).then(function (tabs) {
      var tab = tabs[0];
      if (!tab) return;

      var vendor = detectVendor(tab.url);
      if (!vendor) return;

      browser.tabs.sendMessage(tab.id, { type: "KICAD_CLIPPER_GET" }).then(function (payload) {
        if (!payload || !payload.data) {
          showError(
            '<div class="not-supported"><div class="icon">&#128196;</div>' +
            '<p>Go to a <strong>product page</strong> on ' + vendorLabel(vendor) + '.</p></div>'
          );
          return;
        }
        var data = payload.data;
        var tsv  = payload.tsv;
        var ui   = renderPreview(data, vendor);

        ui.btn.addEventListener("click", function () {
          navigator.clipboard.writeText(tsv).then(function () {
            ui.btn.classList.add("success");
            ui.btn.innerHTML =
              '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">' +
              '<polyline points="20 6 9 17 4 12"/></svg> COPIED!';
            setStatus(ui.status, "Paste (Ctrl+V) into KiCad symbol fields editor", "ok");
            setTimeout(function () {
              ui.btn.classList.remove("success");
              ui.btn.innerHTML =
                '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">' +
                '<rect x="9" y="9" width="13" height="13" rx="2" ry="2"/>' +
                '<path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>' +
                '</svg> COPY TO KICAD';
              setStatus(ui.status, "Ready - paste into KiCad symbol fields", "");
            }, 3000);
          }).catch(function () {
            ui.btn.classList.add("error");
            setStatus(ui.status, "Clipboard denied. Try again.", "error");
          });
        });

      }).catch(function (err) {
        showError(
          '<div class="not-supported"><div class="icon">&#9888;</div>' +
          '<p><strong>Refresh the product page</strong> and try again.<br>' +
          '<small>' + (err && err.message ? err.message : "") + '</small></p></div>'
        );
      });
    });
  }

  init();
})();
