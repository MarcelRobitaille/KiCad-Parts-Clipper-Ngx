// popup.js - Firefox MV3, ASCII only

(function () {
  "use strict";

  var VENDOR_DOMAINS = {
    digikey: ["digikey.com", "digikey.com.br", "digikey.de"],
    mouser:  ["mouser.com",  "mouser.com.br",  "mouser.de"],
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

  function renderPreview(data, vendor, settings) {
    var main = document.getElementById("main-content");

    var badge = document.createElement("div");
    badge.className = "vendor-badge " + (vendor || "unknown");
    badge.innerHTML = '<div class="vendor-dot"></div>' + vendorLabel(vendor);

    var fields = document.createElement("div");
    fields.className = "fields";

    var configured = KiCadClipperSettings.normalizeSettings(settings);
    for (var i = 0; i < KiCadClipperSettings.FIELDS.length; i++) {
      var field = KiCadClipperSettings.FIELDS[i];
      var config = configured.fields[field.key];
      if (!config.enabled) continue;

      var val = field.dataKey ? data[field.dataKey] || "" : "";

      var row = document.createElement("div");
      row.className = "field-row";

      var nameEl = document.createElement("div");
      nameEl.className = "field-name";
      nameEl.textContent = config.name;

      var valEl = document.createElement("div");
      valEl.className = "field-value" + (val ? (field.visible ? " highlight" : "") : " empty");
      valEl.title = val || "-";

      if (field.dataKey === "datasheet" && val) {
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
    Promise.all([
      browser.tabs.query({ active: true, currentWindow: true }),
      KiCadClipperSettings.loadSettings(),
    ]).then(function (results) {
      var tab = results[0][0];
      var settings = results[1];
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
        var ui   = renderPreview(data, vendor, settings);

        ui.btn.addEventListener("click", function () {
          var tsv = KiCadClipperSettings.buildTSV(data, settings);
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

  var settingsButton = document.getElementById("btn-settings");
  if (settingsButton) {
    settingsButton.addEventListener("click", function () {
      browser.runtime.openOptionsPage();
    });
  }

  init();
})();
