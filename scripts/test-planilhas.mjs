import assert from 'node:assert/strict';
import ExcelJS from 'exceljs';
import { limitSheetRows, loadWorkbook, MAX_SHEET_ROWS } from '../src/workbookLoader.js';

async function buildWorkbook(build) {
  const workbook = new ExcelJS.Workbook();
  build(workbook);
  return Buffer.from(await workbook.xlsx.writeBuffer());
}

const smallBuffer = await buildWorkbook((workbook) => {
  const sheet = workbook.addWorksheet('Pequena');
  sheet.getCell('A1').value = 'ok';
  sheet.getCell('B5').value = 42;
});

assert.equal(await limitSheetRows(smallBuffer), smallBuffer, 'planilha pequena deve voltar sem alteração');

const contiguousBuffer = await buildWorkbook((workbook) => {
  const sheet = workbook.addWorksheet('Grande');

  for (let row = 1; row <= 40; row += 1) {
    sheet.getCell(`A${row}`).value = `linha ${row}`;
  }

  workbook.addWorksheet('Outra').getCell('A1').value = 'intacta';
});

const trimmed = await loadWorkbookWithLimit(contiguousBuffer, 10);
assert.equal(trimmed.getWorksheet('Grande').rowCount, 10);
assert.equal(trimmed.getWorksheet('Grande').getCell('A10').value, 'linha 10');
assert.equal(trimmed.getWorksheet('Grande').getCell('A11').value, null);
assert.equal(trimmed.getWorksheet('Outra').getCell('A1').value, 'intacta');

const sparseBuffer = await buildWorkbook((workbook) => {
  const sheet = workbook.addWorksheet('Esparsa');
  sheet.getCell('A3').value = 'topo';
  sheet.getCell('A25000').value = 'perdido';
});

const sparse = await loadWorkbook(sparseBuffer);
assert.ok(sparse.getWorksheet('Esparsa').rowCount <= MAX_SHEET_ROWS);
assert.equal(sparse.getWorksheet('Esparsa').getCell('A3').value, 'topo');
assert.equal(sparse.getWorksheet('Esparsa').getCell('A25000').value, null);

console.log('Carregador de planilhas conferido.');

async function loadWorkbookWithLimit(buffer, maxRows) {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(await limitSheetRows(buffer, maxRows));
  return workbook;
}
