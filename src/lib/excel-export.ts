import ExcelJS from "exceljs";

// Flux brand colors
const FLUX_BRAND = "D97706"; // amber/orange
const FLUX_DARK = "1A1813"; // dark text
const HEADER_BG = "D97706";
const HEADER_TEXT = "FFFFFF";
const SUBHEADER_BG = "FEF3C7"; // amber-100
const BORDER_COLOR = "E5E7EB";
const MUTED_TEXT = "6B7280";

interface ExcelColumn {
  header: string;
  key: string;
  width?: number;
  type?: "string" | "number" | "currency" | "percent" | "date";
}

interface ExcelExportOptions {
  sheetName: string;
  title: string;
  subtitle?: string;
  columns: ExcelColumn[];
  data: Record<string, unknown>[];
  currency?: string;
  filename: string;
  totalsRow?: Record<string, unknown>;
}

export async function exportToExcel(options: ExcelExportOptions) {
  const {
    sheetName,
    title,
    subtitle,
    columns,
    data,
    currency = "USD",
    filename,
    totalsRow,
  } = options;

  const workbook = new ExcelJS.Workbook();
  workbook.creator = "FLUX Business Platform";
  workbook.created = new Date();

  const sheet = workbook.addWorksheet(sheetName, {
    properties: { defaultColWidth: 15 },
    views: [{ state: "frozen", ySplit: 4 }], // Freeze header rows
  });

  // Set column widths
  sheet.columns = columns.map((col) => ({
    key: col.key,
    width: col.width || 15,
  }));

  // ── Row 1: Title ─────────────────────────────────────────────
  const titleRow = sheet.addRow([title]);
  titleRow.height = 32;
  const titleCell = titleRow.getCell(1);
  titleCell.font = {
    name: "Calibri",
    size: 16,
    bold: true,
    color: { argb: FLUX_DARK },
  };
  titleCell.fill = {
    type: "pattern",
    pattern: "solid",
    fgColor: { argb: SUBHEADER_BG },
  };
  // Merge title across all columns
  sheet.mergeCells(1, 1, 1, columns.length);
  titleCell.alignment = { vertical: "middle", horizontal: "left", indent: 1 };

  // ── Row 2: Subtitle / metadata ───────────────────────────────
  const subText = subtitle || `Generated on ${new Date().toLocaleDateString()} | Currency: ${currency}`;
  const subRow = sheet.addRow([subText]);
  subRow.height = 22;
  const subCell = subRow.getCell(1);
  subCell.font = {
    name: "Calibri",
    size: 10,
    color: { argb: MUTED_TEXT },
  };
  sheet.mergeCells(2, 1, 2, columns.length);
  subCell.alignment = { vertical: "middle", horizontal: "left", indent: 1 };

  // ── Row 3: Empty spacer ──────────────────────────────────────
  sheet.addRow([]);

  // ── Row 4: Column headers ────────────────────────────────────
  const headerRow = sheet.addRow(columns.map((col) => col.header));
  headerRow.height = 28;
  headerRow.eachCell((cell, colNumber) => {
    cell.font = {
      name: "Calibri",
      size: 11,
      bold: true,
      color: { argb: HEADER_TEXT },
    };
    cell.fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: HEADER_BG },
    };
    cell.alignment = {
      vertical: "middle",
      horizontal:
        columns[colNumber - 1]?.type === "number" ||
        columns[colNumber - 1]?.type === "currency" ||
        columns[colNumber - 1]?.type === "percent"
          ? "right"
          : "left",
      indent: 1,
    };
    cell.border = {
      bottom: { style: "medium", color: { argb: FLUX_DARK } },
    };
  });

  // ── Data rows ────────────────────────────────────────────────
  data.forEach((row, rowIndex) => {
    const values = columns.map((col) => {
      const val = row[col.key];
      if (col.type === "number" || col.type === "currency" || col.type === "percent") {
        return typeof val === "number" ? val : parseFloat(String(val)) || 0;
      }
      if (col.type === "date" && val) {
        return new Date(String(val));
      }
      return val ?? "";
    });

    const dataRow = sheet.addRow(values);
    dataRow.height = 24;

    const isEvenRow = rowIndex % 2 === 0;

    dataRow.eachCell((cell, colNumber) => {
      const col = columns[colNumber - 1];

      // Font
      cell.font = {
        name: "Calibri",
        size: 10.5,
        color: { argb: FLUX_DARK },
      };

      // Alternating row colors
      if (isEvenRow) {
        cell.fill = {
          type: "pattern",
          pattern: "solid",
          fgColor: { argb: "FAFAF9" }, // very light warm gray
        };
      }

      // Alignment
      cell.alignment = {
        vertical: "middle",
        horizontal:
          col?.type === "number" || col?.type === "currency" || col?.type === "percent"
            ? "right"
            : "left",
        indent: 1,
      };

      // Number formatting
      if (col?.type === "currency") {
        const sym = currency === "TSH" || currency === "TZS" ? "TSh " : currency === "EUR" ? "€" : currency === "GBP" ? "£" : "$";
        cell.numFmt = `${sym}#,##0.00`;
      } else if (col?.type === "percent") {
        cell.numFmt = `0.0"%"`;
      } else if (col?.type === "number") {
        cell.numFmt = "#,##0";
      } else if (col?.type === "date") {
        cell.numFmt = "DD/MM/YYYY";
      }

      // Borders
      cell.border = {
        bottom: { style: "thin", color: { argb: BORDER_COLOR } },
      };
    });
  });

  // ── Totals row (optional) ────────────────────────────────────
  if (totalsRow) {
    const totalValues = columns.map((col) => {
      const val = totalsRow[col.key];
      if (val === undefined) return "";
      if (col.type === "number" || col.type === "currency" || col.type === "percent") {
        return typeof val === "number" ? val : parseFloat(String(val)) || 0;
      }
      return val;
    });

    const tRow = sheet.addRow(totalValues);
    tRow.height = 28;
    tRow.eachCell((cell, colNumber) => {
      const col = columns[colNumber - 1];
      cell.font = {
        name: "Calibri",
        size: 11,
        bold: true,
        color: { argb: FLUX_DARK },
      };
      cell.fill = {
        type: "pattern",
        pattern: "solid",
        fgColor: { argb: SUBHEADER_BG },
      };
      cell.alignment = {
        vertical: "middle",
        horizontal:
          col?.type === "number" || col?.type === "currency" || col?.type === "percent"
            ? "right"
            : "left",
        indent: 1,
      };
      cell.border = {
        top: { style: "medium", color: { argb: FLUX_BRAND } },
        bottom: { style: "medium", color: { argb: FLUX_BRAND } },
      };

      if (col?.type === "currency") {
        const sym = currency === "TSH" || currency === "TZS" ? "TSh " : currency === "EUR" ? "€" : currency === "GBP" ? "£" : "$";
        cell.numFmt = `${sym}#,##0.00`;
      } else if (col?.type === "percent") {
        cell.numFmt = `0.0"%"`;
      } else if (col?.type === "number") {
        cell.numFmt = "#,##0";
      }
    });
  }

  // ── Footer ───────────────────────────────────────────────────
  sheet.addRow([]);
  const footerRow = sheet.addRow([`FLUX Business Platform | ${new Date().toLocaleString()}`]);
  const footerCell = footerRow.getCell(1);
  footerCell.font = {
    name: "Calibri",
    size: 9,
    italic: true,
    color: { argb: MUTED_TEXT },
  };
  sheet.mergeCells(footerRow.number, 1, footerRow.number, columns.length);

  // ── Generate & Download ──────────────────────────────────────
  const buffer = await workbook.xlsx.writeBuffer();
  const blob = new Blob([buffer], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${filename}.xlsx`;
  a.click();
  URL.revokeObjectURL(url);
}
