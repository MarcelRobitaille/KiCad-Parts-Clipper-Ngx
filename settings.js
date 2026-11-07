// settings.js - field configuration and KiCad TSV generation (shared)

(function (global) {
  "use strict";

  var STORAGE_KEY = "kicadClipperSettings";

  // Order here is the order of the rows written to the KiCad clipboard.
  // `dataKey` is the scraper result property; null means the row is always blank.
  // `visible` maps to the "Show" column of the KiCad symbol fields format.
  var FIELDS = [
    {
      key: "reference",
      label: "Reference",
      defaultName: "Reference",
      dataKey: null,
      visible: true,
      enabledByDefault: false,
      hint: "Copied blank so you can fill it in KiCad",
    },
    {
      key: "value",
      label: "Value",
      defaultName: "Value",
      dataKey: "value",
      visible: true,
      enabledByDefault: true,
      hint: "Component value (4.7K, 100nF, ...)",
    },
    {
      key: "footprint",
      label: "Footprint",
      defaultName: "Footprint",
      dataKey: null,
      visible: false,
      enabledByDefault: true,
      hint: "Copied blank so you can fill it in KiCad",
    },
    {
      key: "datasheet",
      label: "Datasheet",
      defaultName: "Datasheet",
      dataKey: "datasheet",
      visible: false,
      enabledByDefault: true,
      hint: "Datasheet URL",
    },
    {
      key: "description",
      label: "Description",
      defaultName: "Description",
      dataKey: "description",
      visible: false,
      enabledByDefault: true,
      hint: "Product description",
    },
    {
      key: "manufacturer",
      label: "Manufacturer",
      defaultName: "Manufacturer",
      dataKey: "manufacturer",
      visible: false,
      enabledByDefault: true,
      hint: "Component manufacturer",
    },
    {
      key: "vendor",
      label: "eVendor",
      defaultName: "eVendor",
      dataKey: "vendor",
      visible: false,
      enabledByDefault: true,
      hint: "Distributor name (Digikey, Mouser, LCSC)",
    },
    {
      key: "vendorPartNumber",
      label: "eVendor Part#",
      defaultName: "eVendor Part#",
      dataKey: "vendorPartNumber",
      visible: false,
      enabledByDefault: true,
      hint: "Distributor part number",
    },
    {
      key: "vendorPrice",
      label: "eVendor Price",
      defaultName: "eVendor Price",
      dataKey: "vendorPrice",
      visible: false,
      enabledByDefault: true,
      hint: "Unit price at the minimum quantity",
    },
    {
      key: "partNumber",
      label: "Part#",
      defaultName: "Part#",
      dataKey: "partNumber",
      visible: false,
      enabledByDefault: true,
      hint: "Manufacturer part number",
    },
    {
      key: "msrp",
      label: "MSRP",
      defaultName: "MSRP",
      dataKey: "msrp",
      visible: false,
      enabledByDefault: true,
      hint: "Unit price at quantity 100 (or closest break)",
    },
    {
      key: "quantity",
      label: "Quantity",
      defaultName: "Quantity",
      dataKey: "quantity",
      visible: false,
      enabledByDefault: true,
      hint: "Quantity matching the MSRP price break",
    },
  ];

  function sanitizeName(name, fallback) {
    var value = String(name == null ? "" : name)
      .replace(/[\t\r\n]+/g, " ")
      .trim();
    return value || fallback;
  }

  function defaultSettings() {
    var fields = {};
    for (var i = 0; i < FIELDS.length; i++) {
      var field = FIELDS[i];
      fields[field.key] = {
        enabled: field.enabledByDefault,
        name: field.defaultName,
      };
    }
    return { fields: fields };
  }

  function normalizeSettings(raw) {
    raw = raw && typeof raw === "object" ? raw : {};
    var savedFields = raw.fields && typeof raw.fields === "object" ? raw.fields : {};
    var settings = { fields: {} };

    for (var i = 0; i < FIELDS.length; i++) {
      var field = FIELDS[i];
      var saved = savedFields[field.key];
      settings.fields[field.key] = {
        enabled:
          saved && typeof saved.enabled === "boolean"
            ? saved.enabled
            : field.enabledByDefault,
        name: sanitizeName(saved && saved.name, field.defaultName),
      };
    }

    return settings;
  }

  function loadSettings() {
    if (typeof browser === "undefined" || !browser.storage) {
      return Promise.resolve(defaultSettings());
    }
    return browser.storage.local.get(STORAGE_KEY).then(
      function (result) {
        return normalizeSettings(result[STORAGE_KEY]);
      },
      function () {
        return defaultSettings();
      }
    );
  }

  function saveSettings(settings) {
    var normalized = normalizeSettings(settings);
    var data = {};
    data[STORAGE_KEY] = normalized;
    return browser.storage.local.set(data).then(function () {
      return normalized;
    });
  }

  function buildTSV(data, settings) {
    data = data && typeof data === "object" ? data : {};
    var normalized = normalizeSettings(settings);
    var rows = [];

    for (var i = 0; i < FIELDS.length; i++) {
      var field = FIELDS[i];
      var config = normalized.fields[field.key];
      if (!config.enabled) continue;

      var name = sanitizeName(config.name, field.defaultName);
      var value = field.dataKey ? data[field.dataKey] || "" : "";
      rows.push(
        name + "\t" + value + "\t" + (field.visible ? "1" : "0") +
        "\t0\t" + (field.visible ? "Left" : "Center") + "\tCenter\t0\t0"
      );
    }

    return rows.join("\n");
  }

  global.KiCadClipperSettings = {
    STORAGE_KEY: STORAGE_KEY,
    FIELDS: FIELDS,
    defaultSettings: defaultSettings,
    normalizeSettings: normalizeSettings,
    loadSettings: loadSettings,
    saveSettings: saveSettings,
    buildTSV: buildTSV,
    sanitizeName: sanitizeName,
  };
})(typeof window !== "undefined" ? window : this);
