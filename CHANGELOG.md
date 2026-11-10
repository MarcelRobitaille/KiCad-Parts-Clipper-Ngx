# Changelog

All notable changes to this project are documented in this file.

This project is a fork of **KiCad Parts Clipper** and starts from the upstream
1.0.1 source.

## [2.0.1] - 2026-11-10

### Fixed

- Removed the unused `activeTab` and `scripting` permissions. The product-data
  extractor is a declared content script and already has host access, so it
  never used the `scripting` API. This addresses a Chrome Web Store rejection
  for requesting an unused permission.
- Strip tabs, carriage returns, and newlines from copied field values so a
  multi-line product description cannot shift the remaining KiCad TSV rows.

### Changed

- Documented the row and column to start from when pasting into KiCad's symbol
  fields.

## [2.0.0] - 2026-11-08

First public release of the fork, combining all fork changes into a single
version.

### Added

- Support for the German storefronts `digikey.de` and `mouser.de`, and the
  Brazilian storefronts `digikey.com.br` and `mouser.com.br`.
- Configurable KiCad fields: each row can be enabled or disabled and its KiCad
  attribute renamed on the new options page.
- Mouser distributor part number extraction from JSON-LD.
- On-page **Copy to KiCad** button on DigiKey and Mouser product pages, placed
  in the product header next to the part number.
- `README.md` covering the fork, features, usage, install, and build steps.
- `LICENSE` with the MIT license.

### Changed

- Renamed the add-on to **KiCad Parts Clipper Ngx** and gave it its own
  extension ID (`kicad_parts_clipper_ngx@marcelrobitaille.me`) so it can be
  published and installed alongside the original.
- Updated the popup and options pages with the new name.

## [1.0.1] - 2026-11-07

### Added

- Initial fork of the upstream **KiCad Parts Clipper** 1.0.1 source, retaining
  its DigiKey, Mouser, and LCSC product scraping and KiCad clipboard/TSV output.
