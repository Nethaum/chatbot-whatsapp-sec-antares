import { StringDecoder } from 'node:string_decoder';
import ExcelJS from 'exceljs';
import JSZip from 'jszip';

export const MAX_SHEET_ROWS = 20000;

const worksheetPathPattern = /^xl\/worksheets\/sheet\d+\.xml$/;
const rowPatternOverlap = 32;

// Abas formatadas até o fim da planilha (ex.: A1:M1047915) fazem o exceljs criar
// milhões de linhas vazias e estourar a memória do bot. Cortamos cada aba nas
// primeiras MAX_SHEET_ROWS linhas antes de entregá-la ao exceljs.
export async function loadWorkbook(buffer) {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(await limitSheetRows(buffer));
  return workbook;
}

export async function limitSheetRows(buffer, maxRows = MAX_SHEET_ROWS) {
  const zip = await JSZip.loadAsync(buffer);
  let changed = false;

  for (const entry of zip.file(worksheetPathPattern)) {
    const trimmedXml = await trimWorksheetXml(entry, maxRows);

    if (trimmedXml !== null) {
      zip.file(entry.name, trimmedXml);
      changed = true;
    }
  }

  return changed ? zip.generateAsync({ type: 'nodebuffer', compression: 'DEFLATE' }) : buffer;
}

function trimWorksheetXml(entry, maxRows) {
  const rowPattern = /<row r="(\d+)"/g;
  const decoder = new StringDecoder('utf8');
  const stream = entry.nodeStream('nodebuffer');
  let head = '';
  let searchFrom = 0;
  let settled = false;

  return new Promise((resolve, reject) => {
    const finish = (result) => {
      if (!settled) {
        settled = true;
        resolve(result);
      }
    };

    stream.on('data', (chunk) => {
      if (settled) {
        return;
      }

      head += decoder.write(chunk);
      rowPattern.lastIndex = searchFrom;

      for (let match = rowPattern.exec(head); match; match = rowPattern.exec(head)) {
        if (Number(match[1]) > maxRows) {
          stream.pause();
          finish(withCappedDimension(head.slice(0, match.index), maxRows) + '</sheetData></worksheet>');
          return;
        }
      }

      searchFrom = Math.max(0, head.length - rowPatternOverlap);
    });
    stream.on('end', () => finish(null));
    stream.on('error', (error) => {
      if (!settled) {
        settled = true;
        reject(error);
      }
    });
    stream.resume();
  });
}

function withCappedDimension(xml, maxRows) {
  return xml.replace(/(<dimension ref="[A-Z]+\d+:[A-Z]+)\d+(")/, `$1${maxRows}$2`);
}
