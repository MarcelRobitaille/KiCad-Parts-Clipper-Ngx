# Privacy Policy

**KiCad Parts Clipper Ngx**
Last updated: 8 November 2026

KiCad Parts Clipper Ngx is a browser extension for Firefox and Chrome. It reads component information from DigiKey, Mouser, and LCSC product pages and converts it into text you can paste into KiCad's symbol fields.

## Summary

- No accounts, analytics, telemetry, or tracking.
- No personal data is collected, transmitted to the developer, sold, or shared.
- Product data is processed locally in your browser.
- Your field settings are stored locally on your device.

## What the extension accesses

The extension runs only on these distributor sites:

- `digikey.com`, `digikey.de`, `digikey.com.br`
- `mouser.com`, `mouser.de`, `mouser.com.br`
- `lcsc.com`

On a supported product page, the extension reads the product details displayed on that page, such as the manufacturer part number, distributor part number, description, manufacturer, prices, and datasheet URL. That data stays in your browser. It is placed on the clipboard only when you click **Copy to KiCad** in the popup or the on-page copy button.

The extension does not read your clipboard, cookies, browsing history, form data, or data from other websites.

## Local storage

Field preferences (which rows are enabled and what names they use) are saved with the browser's local extension storage API under the key `kicadClipperSettings`. They remain on your device and are deleted when you uninstall the extension or clear its data. They are never uploaded.

## Permissions

| Permission | Purpose |
| --- | --- |
| Host permissions for the sites above | Read product data on supported distributor pages. |
| `activeTab` | Identify the active tab when the popup opens. |
| `scripting` | Run the product-data extractor on supported pages. |
| `clipboardWrite` | Write the generated KiCad text when you click **Copy to KiCad**. |
| `storage` | Remember your field settings locally. |

## Third-party requests

The extension does not send product data, browsing data, or settings to the developer or to any third party.

The popup and settings pages load fonts from `fonts.googleapis.com` and `fonts.gstatic.com`. As with any web request, Google receives standard request information such as your IP address and browser user agent. No product, browsing, or settings data is included in that request.

The distributor pages you visit are operated by DigiKey, Mouser, and LCSC and are governed by their own privacy policies.

## Data retention and removal

The extension keeps only your field settings, stored locally. Uninstalling the extension or clearing its extension data removes them. No server-side data exists to delete.

## Changes to this policy

If this policy changes, the updated version will be published in this repository with a new "last updated" date.

## Contact

Questions about this policy or the extension:

- Marcel Robitaille
- Email: mail@marcelrobitaille.me
- Issues: <https://github.com/MarcelRobitaille/KiCad-Parts-Clipper-Ngx/issues>
