/**
 * CSV Export Utilities
 */

/**
 * Escapes a cell value for CSV output.
 * Quotes strings containing commas, quotes, or newlines.
 * @param {string|number|boolean} value
 * @returns {string}
 */
function escapeCSVCell(value) {
  if (value === null || value === undefined) {
    return "";
  }

  const stringValue = String(value);

  // If the value contains commas, quotes, or newlines, wrap it in quotes
  // and double-escape any existing quotes
  if (/[",\n\r]/.test(stringValue)) {
    return `"${stringValue.replace(/"/g, '""')}"`;
  }

  return stringValue;
}

/**
 * Downloads an array of objects as a CSV file.
 *
 * @param {Object[]} data - Array of objects to export
 * @param {string} filename - The default filename for the download (e.g. "export.csv")
 * @param {string[]} [columns] - Optional. Specifies which keys to export and in what order. If omitted, uses Object.keys of the first item.
 */
export function downloadAsCSV(data, filename, columns = null) {
  if (!data || data.length === 0) {
    console.warn("No data provided to downloadAsCSV");
    return;
  }

  // Determine columns from first object if not provided
  const keys = columns || Object.keys(data[0]);

  // Build CSV string
  const rows = [];

  // Header row
  rows.push(keys.map(escapeCSVCell).join(","));

  // Data rows
  for (const item of data) {
    const row = keys.map((key) => escapeCSVCell(item[key]));
    rows.push(row.join(","));
  }

  const csvContent = rows.join("\n");

  // Create Blob and trigger download
  const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
  const link = document.createElement("a");

  if (navigator.msSaveBlob) {
    // IE 10+ Handle
    navigator.msSaveBlob(blob, filename);
  } else {
    // Other browsers
    const url = URL.createObjectURL(blob);
    link.href = url;
    link.download = filename;
    link.style.visibility = "hidden";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }
}
