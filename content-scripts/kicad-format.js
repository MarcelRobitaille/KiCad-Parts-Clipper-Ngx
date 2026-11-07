// shared/kicad-format.js
// Injected inline into each content script via build, or loaded as shared module.

/**
 * Builds the KiCad TSV clipboard string from a parts data object.
 *
 * KiCad Symbol Fields clipboard format (tab-separated):
 *   Name \t Value \t Show \t ShowName \t HAlign \t VAlign \t Italic \t Bold
 *
 * Reference and Value rows use Show=1 (visible on schematic).
 * All other fields use Show=0.
 * Footprint is always left empty (filled manually in KiCad).
 */
function buildKiCadTSV(data) {
  // data shape:
  // {
  //   value: string,         // e.g. "100R"
  //   datasheet: string,     // URL
  //   description: string,
  //   manufacturer: string,
  //   partNumber: string,    // manufacturer part#
  //   vendor: string,        // "Digikey" | "Mouser" | "LCSC"
  //   vendorPartNumber: string,
  //   vendorPrice: string,   // unit price at min qty, e.g. "0.10"
  //   msrp: string,          // leave empty if not available
  // }

  const visible   = (name, value) => `${name}\t${value}\t1\t0\tLeft\tCenter\t0\t0`;
  const hidden    = (name, value) => `${name}\t${value}\t0\t0\tCenter\tCenter\t0\t0`;

  const rows = [
    visible("Reference",      ""),                      // Reference left blank - user fills
    visible("Value",          data.value        || ""),
    hidden ("Footprint",      ""),                      // always empty per requirement
    hidden ("Datasheet",      data.datasheet    || ""),
    hidden ("Description",    data.description  || ""),
    hidden ("eVendor",        data.vendor       || ""),
    hidden ("eVendor Part#",  data.vendorPartNumber || ""),
    hidden ("eVendor Price",  data.vendorPrice  || ""),
    hidden ("Part#",          data.partNumber   || ""),
    hidden ("MSRP",           data.msrp         || ""),
    hidden ("Manufacturer",   data.manufacturer || ""),
    hidden ("Quantity",       ""),
  ];

  return rows.join("\n");
}
