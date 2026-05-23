import * as XLSX from 'xlsx';

/** Exporta un array de objetos a un archivo .xlsx de una sola hoja. */
export function exportToExcel(
  rows: Record<string, unknown>[],
  sheetName: string,
  fileName: string,
): void {
  const ws = XLSX.utils.json_to_sheet(rows);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, sheetName);
  XLSX.writeFile(wb, `${fileName}.xlsx`);
}

/** Exporta múltiples hojas en un mismo libro. */
export function exportToExcelMultiSheet(
  sheets: { name: string; rows: Record<string, unknown>[] }[],
  fileName: string,
): void {
  const wb = XLSX.utils.book_new();
  for (const { name, rows } of sheets) {
    const ws = XLSX.utils.json_to_sheet(rows);
    XLSX.utils.book_append_sheet(wb, ws, name);
  }
  XLSX.writeFile(wb, `${fileName}.xlsx`);
}
