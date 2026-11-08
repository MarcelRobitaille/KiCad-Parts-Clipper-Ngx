# KiCad Parts Clipper Ngx

A fork of the original **KiCad Parts Clipper** extension (`kicad-parts-clipper@novasmar.com`).

This fork keeps the original workflow and adds German storefront support, configurable KiCad fields, distributor part numbers, and an on-page copy button. It uses its own extension ID (`kicad-parts-clipper-ngx@marcelrobitaille.me`) so it can be published and installed alongside the original.

## Features

- **Supported sites:** DigiKey, Mouser, and LCSC, including `digikey.de`, `mouser.de`, `digikey.com.br`, and `mouser.com.br`.
- **Part data:** manufacturer part number, distributor part number (for example the Mouser part number), manufacturer, description, datasheet URL, unit price, quantity-100 price (MSRP), and matching quantity.
- **Smart values:** formats resistance, capacitance, and inductance into KiCad-friendly values such as `4.7K`, `100nF`, and `10uH`.
- **KiCad clipboard format:** copies rows in the symbol-fields TSV format, ready to paste into KiCad.
- **Configurable fields:** enable or disable each row and rename its KiCad attribute in the settings page.
- **On-page copy button:** appears near the product attributes so you can copy without opening the popup. On Mouser it sits in the product header next to the part number.
- **Popup preview:** shows the extracted values and lets you copy from the toolbar popup.
- **No data collection:** everything runs locally in the browser.

## Usage

1. Open a product page on a supported site.
2. Copy the data using either:
   - the **Copy to KiCad** button on the page, or
   - the toolbar icon, then **COPY TO KICAD**.
3. In KiCad, open the symbol properties/fields and paste the clipboard.
4. To choose which fields are copied or rename their attributes, open the extension settings (gear icon in the popup or the add-on's Options page).

## Install

The built XPI is unsigned.

- **Temporary (development):** open `about:debugging#/runtime/this-firefox`, choose **Load Temporary Add-on**, and select `manifest.json` or the built XPI.
- **Permanent:** publish/sign the add-on through [addons.mozilla.org](https://addons.mozilla.org/) or use a Firefox build with signature enforcement disabled.

## Build

```sh
./build.sh
```

This writes `~/Downloads/kicad_parts_clipper.xpi`. To choose another output path:

```sh
./build.sh /path/to/kicad_parts_clipper_ngx.xpi
```

The version is read from `manifest.json`.
