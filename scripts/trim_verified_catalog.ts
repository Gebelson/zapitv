import fs from 'fs';
import path from 'path';

const filePath = path.resolve('src/core/catalog/verifiedCatalog.ts');
const content = fs.readFileSync(filePath, 'utf-8');

const marker = "  // 14. SÉRIE — FALLOUT (2024)";
const idx = content.indexOf(marker);

if (idx !== -1) {
  let newContent = content.substring(0, idx).trimEnd();
  // Garante que termina com ];\n
  if (newContent.endsWith(',')) {
    newContent = newContent.substring(0, newContent.length - 1);
  }
  newContent = newContent + '\n];\n';
  fs.writeFileSync(filePath, newContent, 'utf-8');
  console.log('Successfully trimmed verifiedCatalog.ts. New length:', newContent.split('\n').length);
} else {
  console.error('Marker not found!');
}
