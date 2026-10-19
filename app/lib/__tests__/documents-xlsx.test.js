"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const os = require("os");
const path = require("path");
const XLSX = require("xlsx");
const { excelToCsv } = require("../documents");

test("excelToCsv reads a workbook from SheetJS 0.20.3", () => {
  const pkgPath = path.join(path.dirname(require.resolve("xlsx")), "package.json");
  assert.equal(JSON.parse(fs.readFileSync(pkgPath, "utf8")).version, "0.20.3");
  const file = path.join(fs.mkdtempSync(path.join(os.tmpdir(), "xlsx-")), "book.xlsx");
  const sheet = XLSX.utils.aoa_to_sheet([["order", "state"], ["1001", "shipped"]]);
  const book = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(book, sheet, "Orders");
  XLSX.writeFile(book, file);
  const csv = excelToCsv(file);
  assert.match(csv, /order,state/);
  assert.match(csv, /1001,shipped/);
  assert.equal(Object.prototype.polluted, undefined);
});
