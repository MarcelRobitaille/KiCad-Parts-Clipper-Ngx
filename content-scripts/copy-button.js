// content-scripts/copy-button.js
// Injects an inline "Copy to KiCad" button near the product attributes.

(function () {
  "use strict";

  var BUTTON_ID = "kicad-clipper-quick-copy";
  var WRAPPER_ID = BUTTON_ID + "-wrap";
  var root = typeof globalThis !== "undefined" ? globalThis : window;
  var host = root.__kicadClipperHost;
  if (!host || typeof host.getData !== "function") return;

  var RESET_DELAY = 2200;
  var ANCHOR_WAIT = 3000;
  var GIVE_UP = 12000;
  var resetTimer = null;

  function textOf(el) {
    return el && el.textContent ? el.textContent.replace(/\s+/g, " ").trim() : "";
  }

  function visible(el) {
    if (!el || el.hidden) return false;
    if (el.getClientRects && el.getClientRects().length === 0) return false;
    return true;
  }

  function setStyles(el, styles) {
    for (var prop in styles) {
      if (Object.prototype.hasOwnProperty.call(styles, prop)) {
        el.style.setProperty(prop, styles[prop], "important");
      }
    }
  }

  function closestTable(el) {
    while (el && el !== document.body) {
      if (el.tagName === "TABLE") return el;
      el = el.parentElement;
    }
    return null;
  }

  // placement: "before" | "after" | "inside"
  function makeAnchor(el, placement) {
    if (!el) return null;
    var table = closestTable(el);
    if (table) return { el: table, placement: "before" };
    return { el: el, placement: placement || "before" };
  }

  var HEADING_RE = /^(?:product\s+)?(?:attributes?|specifications?|technical\s+(?:specifications?|data)|produktattribute|eigenschaften|technische\s+daten|spezifikationen|caract[ée]ristiques(?:\s+techniques)?)$/i;

  function findHeadingAnchor() {
    var nodes = document.querySelectorAll(
      "h1, h2, h3, h4, h5, h6, [role='heading'], " +
      "[class*='attribute'], [class*='Attribute'], [class*='spec'], [class*='Spec']"
    );
    for (var i = 0; i < nodes.length; i++) {
      if (visible(nodes[i]) && HEADING_RE.test(textOf(nodes[i]))) {
        return makeAnchor(nodes[i], "after");
      }
    }
    return null;
  }

  function findGenericTable() {
    var tables = document.querySelectorAll("table");
    for (var t = 0; t < tables.length; t++) {
      if (!visible(tables[t])) continue;
      var rows = tables[t].querySelectorAll("tr");
      if (rows.length < 2) continue;

      var labelish = 0;
      var limit = Math.min(rows.length, 8);
      for (var r = 0; r < limit; r++) {
        var cells = rows[r].querySelectorAll("td, th");
        if (cells.length >= 2 && textOf(cells[0]) && textOf(cells[1])) labelish++;
      }
      if (labelish >= 3) return { el: tables[t], placement: "before" };
    }
    return null;
  }

  // Mouser shows the manufacturer part number in the product card header at
  // the very top of the page, above the Mouser/Mfr. number rows. Put the
  // button there instead of down at the specifications table.
  function findMouserHeaderAnchor() {
    var header = document.querySelector(
      ".pdp-product-card-header, #pdpProdInfo > .card-header, " +
      "#pdpProdInfo > .panel-heading, #pdpProdInfo .pdp-product-card-header"
    );
    if (header) return { el: header, placement: "inside" };

    var title = document.querySelector('[data-testid="ProductInfoHeader"]')
      || document.querySelector("#pdpProdInfo h1")
      || document.querySelector("h1");
    if (title) return { el: title, placement: "after" };

    return null;
  }

  function findAnchor() {
    var i, cells, table;

    if (host.vendor === "mouser") {
      var mouserHeader = findMouserHeaderAnchor();
      if (mouserHeader) return mouserHeader;

      var specRow = document.querySelector('[id*="pdp_specs_SpecList"]');
      if (specRow) {
        table = closestTable(specRow);
        if (table) return { el: table, placement: "before" };
      }
      var pdpSpecs = document.getElementById("pdp-specs");
      if (pdpSpecs) return makeAnchor(pdpSpecs, "before");
    }

    if (host.vendor === "lcsc") {
      cells = document.querySelectorAll("td, th");
      for (i = 0; i < cells.length; i++) {
        if (/^(?:mfr\.?\s*part\s*#|lcsc\s*part\s*#|manufacturer)$/i.test(textOf(cells[i]))) {
          table = closestTable(cells[i]);
          if (table) return { el: table, placement: "before" };
        }
      }
    }

    var heading = findHeadingAnchor();
    if (heading) return heading;

    if (host.vendor === "digikey") {
      cells = document.querySelectorAll("td, th, div, span");
      for (i = 0; i < cells.length; i++) {
        if (visible(cells[i]) && /^(?:product attributes|attributes|specifications?|technical specifications?|produktattribute|eigenschaften|technische daten)$/i.test(textOf(cells[i]))) {
          return makeAnchor(cells[i], "after");
        }
      }
    }

    return findGenericTable();
  }

  function setButtonState(label, busy) {
    var btn = document.getElementById(BUTTON_ID);
    if (!btn) return;
    btn.textContent = label;
    btn.disabled = !!busy;
    btn.style.setProperty("opacity", busy ? "0.7" : "1", "important");
    btn.style.setProperty("cursor", busy ? "default" : "pointer", "important");
  }

  function scheduleReset() {
    if (resetTimer) clearTimeout(resetTimer);
    resetTimer = setTimeout(function () {
      resetTimer = null;
      setButtonState("Copy to KiCad", false);
    }, RESET_DELAY);
  }

  function fallbackCopy(text) {
    var area = document.createElement("textarea");
    area.value = text;
    area.setAttribute("readonly", "");
    setStyles(area, {
      position: "fixed",
      top: "-1000px",
      left: "-1000px",
      opacity: "0",
    });
    document.body.appendChild(area);
    area.select();

    var ok = false;
    try {
      ok = document.execCommand("copy");
    } catch (e) {
      ok = false;
    }

    document.body.removeChild(area);
    if (!ok) throw new Error("copy command failed");
  }

  function copyText(text) {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      return Promise.resolve(navigator.clipboard.writeText(text)).catch(function () {
        fallbackCopy(text);
      });
    }
    fallbackCopy(text);
    return Promise.resolve();
  }

  function onCopy() {
    var settingsApi = root.KiCadClipperSettings;
    if (!settingsApi || typeof settingsApi.buildTSV !== "function") {
      setButtonState("Settings unavailable", false);
      scheduleReset();
      return;
    }

    setButtonState("Copying...", true);

    Promise.resolve()
      .then(function () { return host.getData(); })
      .then(function (data) {
        if (!data) throw new Error("No part data found");
        return settingsApi.loadSettings().then(function (settings) {
          var tsv = settingsApi.buildTSV(data, settings);
          if (!tsv) throw new Error("No fields are enabled");
          return copyText(tsv);
        });
      })
      .then(function () {
        setButtonState("Copied to KiCad!", false);
        scheduleReset();
      })
      .catch(function (err) {
        console.error("[KiCad Clipper] Quick copy failed:", err);
        setButtonState("Copy failed", false);
        scheduleReset();
      });
  }

  function createButton() {
    var btn = document.createElement("button");
    btn.id = BUTTON_ID;
    btn.type = "button";
    btn.textContent = "Copy to KiCad";
    btn.title = "Copy these attributes to the KiCad symbol fields clipboard";
    btn.setAttribute("aria-label", "Copy part attributes to KiCad");
    setStyles(btn, {
      display: "inline-flex",
      "align-items": "center",
      gap: "6px",
      margin: "0",
      padding: "7px 12px",
      "font-family": "'IBM Plex Sans', system-ui, -apple-system, sans-serif",
      "font-size": "12px",
      "font-weight": "600",
      "line-height": "1.2",
      color: "#ffffff",
      "background-color": "#4f7fff",
      border: "1px solid #3f6fe0",
      "border-radius": "5px",
      cursor: "pointer",
      "box-shadow": "0 1px 3px rgba(15, 17, 23, 0.25)",
      "text-transform": "none",
      "letter-spacing": "normal",
    });
    btn.addEventListener("click", onCopy);
    return btn;
  }

  function inject(anchor, floating) {
    if (document.getElementById(BUTTON_ID)) return;

    var wrapper = document.createElement("div");
    wrapper.id = WRAPPER_ID;
    wrapper.appendChild(createButton());

    if (floating || !anchor) {
      setStyles(wrapper, {
        position: "fixed",
        right: "20px",
        bottom: "20px",
        "z-index": "2147483647",
        display: "flex",
        "align-items": "center",
        gap: "8px",
      });
      document.body.appendChild(wrapper);
      return;
    }

    setStyles(wrapper, {
      display: "flex",
      "align-items": "center",
      gap: "8px",
      margin: "10px 0",
    });

    var placement = anchor.placement || "before";

    if (placement === "inside") {
      // Lay the site's header out as a row so the part number and the button
      // sit side by side, with the button pushed to the right.
      setStyles(anchor.el, {
        display: "flex",
        "align-items": "center",
        "justify-content": "space-between",
        "flex-wrap": "wrap",
        gap: "12px",
      });
      setStyles(wrapper, { margin: "0", "margin-left": "auto" });
      anchor.el.appendChild(wrapper);
      return;
    }

    if (placement === "after") {
      anchor.el.parentNode.insertBefore(wrapper, anchor.el.nextSibling);
    } else {
      anchor.el.parentNode.insertBefore(wrapper, anchor.el);
    }
  }

  function start() {
    var startedAt = Date.now();

    function attempt(allowFloating) {
      if (document.getElementById(BUTTON_ID)) return true;
      if (host.isProductPage && !host.isProductPage()) return false;

      var anchor = findAnchor();
      if (anchor) {
        inject(anchor, false);
        return true;
      }
      if (allowFloating) {
        inject(null, true);
        return true;
      }
      return false;
    }

    if (attempt(false)) return;

    var observer = new MutationObserver(function () {
      if (attempt(Date.now() - startedAt >= ANCHOR_WAIT)) {
        observer.disconnect();
      }
    });
    observer.observe(document.body, { childList: true, subtree: true });

    setTimeout(function () {
      observer.disconnect();
      attempt(true);
    }, GIVE_UP);
  }

  if (document.body) {
    start();
  } else {
    document.addEventListener("DOMContentLoaded", start, { once: true });
  }
})();
