// options.js - field settings UI

(function () {
  "use strict";

  var fieldsEl = document.getElementById("fields");
  var statusEl = document.getElementById("status");
  var currentSettings;

  function setStatus(message, type) {
    statusEl.textContent = message || "";
    statusEl.className = "status " + (type || "");
  }

  function markDirty() {
    setStatus("Unsaved changes", "warn");
  }

  function renderField(field) {
    var config = currentSettings.fields[field.key];

    var row = document.createElement("div");
    row.className = "field-row" + (config.enabled ? "" : " is-disabled");

    var info = document.createElement("div");
    info.className = "field-info";

    var label = document.createElement("div");
    label.className = "field-label";
    label.textContent = field.label;

    var hint = document.createElement("div");
    hint.className = "field-hint";
    hint.textContent = field.hint || "";

    info.appendChild(label);
    info.appendChild(hint);

    var toggleCell = document.createElement("div");
    toggleCell.className = "toggle-cell";

    var checkbox = document.createElement("input");
    checkbox.type = "checkbox";
    checkbox.checked = config.enabled;
    checkbox.setAttribute("aria-label", "Copy " + field.label);
    checkbox.addEventListener("change", function () {
      config.enabled = checkbox.checked;
      row.className = "field-row" + (config.enabled ? "" : " is-disabled");
      markDirty();
    });
    toggleCell.appendChild(checkbox);

    var nameInput = document.createElement("input");
    nameInput.type = "text";
    nameInput.className = "attr-input";
    nameInput.value = config.name;
    nameInput.placeholder = field.defaultName;
    nameInput.maxLength = 60;
    nameInput.setAttribute("aria-label", field.label + " attribute name");
    nameInput.addEventListener("input", function () {
      config.name = nameInput.value;
      markDirty();
    });

    row.appendChild(info);
    row.appendChild(toggleCell);
    row.appendChild(nameInput);
    return row;
  }

  function render() {
    fieldsEl.innerHTML = "";
    for (var i = 0; i < KiCadClipperSettings.FIELDS.length; i++) {
      fieldsEl.appendChild(renderField(KiCadClipperSettings.FIELDS[i]));
    }
  }

  document.getElementById("btn-save").addEventListener("click", function () {
    KiCadClipperSettings.saveSettings(currentSettings).then(function (saved) {
      currentSettings = saved;
      render();
      setStatus("Saved. Reopen the popup to use the new fields.", "ok");
    }).catch(function (err) {
      setStatus("Could not save: " + (err && err.message ? err.message : err), "error");
    });
  });

  document.getElementById("btn-reset").addEventListener("click", function () {
    currentSettings = KiCadClipperSettings.defaultSettings();
    render();
    setStatus("Defaults restored. Click Save changes to apply.", "warn");
  });

  KiCadClipperSettings.loadSettings().then(function (settings) {
    currentSettings = settings;
    render();
    setStatus("");
  }).catch(function (err) {
    setStatus("Could not load settings: " + (err && err.message ? err.message : err), "error");
  });
})();
