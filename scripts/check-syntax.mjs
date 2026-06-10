import { spawnSync } from 'node:child_process';

const files = [
  'src/index.js',
  'src/replies.js',
  'src/replyLexicon.js',
  'src/config.js',
  'src/messageGuard.js',
  'src/eventAgenda.js',
  'src/workbookDownloader.js',
  'src/reservationPricing.js',
  'src/courtAgenda.js',
  'src/dateUtils.js',
  'src/excelUtils.js',
  'src/logger.js',
  'src/text.js'
];

for (const file of files) {
  const result = spawnSync(process.execPath, ['--check', file], {
    stdio: 'inherit',
    shell: false
  });

  if (result.status !== 0) {
    process.exit(result.status || 1);
  }
}

console.log('Sintaxe JavaScript conferida.');
