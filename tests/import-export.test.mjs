import assert from "node:assert/strict";
import { test } from "node:test";
import ExcelJS from "exceljs";
import PDFDocument from "pdfkit";
import { documentFormat, parseDocument } from "../lib/documentContent.js";
import { parseRequestedFields, validateExtraction, createExcel, createPdf } from "../lib/exportData.js";

test("imports text from PDF pages", async () => {
  const bytes = await new Promise((resolve) => {
    const pdf = new PDFDocument();
    const chunks = [];
    pdf.on("data", (chunk) => chunks.push(chunk));
    pdf.on("end", () => resolve(Buffer.concat(chunks)));
    pdf.text("Invoice number INV-42");
    pdf.end();
  });
  const file = new Blob([bytes]);
  file.name = "invoice.pdf";
  const parsed = await parseDocument(file);
  assert.equal(parsed.format, "pdf");
  assert.match(parsed.sections[0].text, /Invoice number INV-42/);
});

test("imports Excel rows with their header labels and locations", async () => {
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet("Invoices");
  sheet.addRow(["Invoice number", "Total amount"]);
  sheet.addRow(["INV-42", 125]);
  const file = new Blob([await workbook.xlsx.writeBuffer()]);
  file.name = "invoices.xlsx";
  const parsed = await parseDocument(file);
  assert.equal(parsed.format, "xlsx");
  assert.deepEqual(parsed.sections[1], {
    location: "Invoices, row 2",
    text: "A (Invoice number): INV-42 | B (Total amount): 125",
  });
});

test("validates formats and requested fields", () => {
  assert.equal(documentFormat("report.pdf"), "pdf");
  assert.equal(documentFormat("report.xls"), null);
  assert.deepEqual(parseRequestedFields("Invoice number\nTotal amount\nInvoice number"), ["Invoice number", "Total amount"]);
  assert.deepEqual(parseRequestedFields(""), []);
});

test("keeps only values supported by their cited passage", () => {
  const evidence = [{ id: "S1", location: "Page 1", text: "Invoice number: INV-42" }];
  const response = JSON.stringify([
    { field: "Invoice number", value: "INV-42", source: "S1" },
    { field: "Total amount", value: "999", source: "S1" },
  ]);
  assert.deepEqual(validateExtraction(response, ["Invoice number", "Total amount"], evidence), [
    { field: "Invoice number", value: "INV-42", source: "Page 1" },
    { field: "Total amount", value: "Not found", source: "" },
  ]);
});

test("generates Excel and PDF downloads from the same data", async () => {
  const rows = [{ field: "Invoice number", value: "INV-42", source: "Invoices, row 2" }];
  const excel = await createExcel(rows, "invoices.xlsx");
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(excel);
  assert.equal(workbook.getWorksheet("Extracted data").getCell("B2").value, "INV-42");
  const pdf = await createPdf(rows, "invoices.xlsx");
  assert.equal(pdf.subarray(0, 5).toString(), "%PDF-");
});
