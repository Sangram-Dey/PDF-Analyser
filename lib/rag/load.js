// Step 1 — Load: read the uploaded file into LangChain Documents, one per PDF page or Excel row.
//   PDF   → LangChain PDFLoader              metadata.location = "Page 3"
//   Excel → ExcelJS (LangChain JS has no Excel loader)
//                                             metadata.location = "Sheet1, row 12", cells labelled with their column header
import { PDFLoader } from "@langchain/community/document_loaders/fs/pdf";
import { Document } from "@langchain/core/documents";
import ExcelJS from "exceljs";
import { HttpError } from "../http.js";

const MAX_CHARACTERS = 300000;

export function documentFormat(name) {
  const extension = name.toLowerCase().split(".").pop();
  return extension === "pdf" || extension === "xlsx" ? extension : null;
}

export async function loadDocument(file) {
  const format = documentFormat(file.name);
  if (!format) throw new HttpError(400, "Choose a PDF or Excel (.xlsx) file.");

  let documents;
  try {
    documents = format === "pdf" ? await loadPdf(file) : await loadExcel(file);
  } catch (error) {
    console.error("Loading failed", error);
    throw new HttpError(422, "Could not read this document. Check that the file is not damaged or password-protected.");
  }

  if (!documents.length) {
    throw new HttpError(422, "No readable text was found in this document.");
  }
  const totalCharacters = documents.reduce((total, doc) => total + doc.pageContent.length, 0);
  if (totalCharacters > MAX_CHARACTERS) {
    throw new HttpError(422, "This document contains too much text. Use a smaller document (up to 300,000 characters).");
  }
  return { format, documents };
}

async function loadPdf(file) {
  const pages = await new PDFLoader(file).load();
  return pages
    .map((page, index) => new Document({
      pageContent: page.pageContent.trim(),
      metadata: { location: `Page ${page.metadata.loc?.pageNumber ?? index + 1}` },
    }))
    .filter((page) => page.pageContent);
}

async function loadExcel(file) {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(Buffer.from(await file.arrayBuffer()));

  const rows = [];
  workbook.eachSheet((sheet) => {
    let headers = null; // the first non-empty row, used to label the cells below it

    sheet.eachRow((row, rowNumber) => {
      const cells = [];
      const rowValues = {};

      row.eachCell({ includeEmpty: false }, (cell, columnNumber) => {
        const value = cell.text.trim();
        if (!value) return;
        const column = sheet.getColumn(columnNumber).letter;
        const header = headers?.[columnNumber];
        rowValues[columnNumber] = value;
        cells.push(`${column}${header ? ` (${header})` : ""}: ${value}`);
      });

      if (!cells.length) return;
      rows.push(new Document({ pageContent: cells.join(" | "), metadata: { location: `${sheet.name}, row ${rowNumber}` } }));
      if (!headers) headers = rowValues;
    });
  });
  return rows;
}
