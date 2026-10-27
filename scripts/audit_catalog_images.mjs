import fs from 'fs';
import path from 'path';

const content = fs.readFileSync('src/core/catalog/featuredCatalogItems.ts', 'utf8');

// Extrai todos os itens de featuredCatalogItems
const itemMatches = [...content.matchAll(/id:\s*'([^']+)'[\s\S]*?title:\s*'([^']+)'[\s\S]*?image:\s*'([^']+)'/g)];

console.log(`Found ${itemMatches.length} items in featuredCatalogItems.ts`);

async function testAll() {
  const broken = [];
  for (const m of itemMatches) {
    const id = m[1];
    const title = m[2];
    const image = m[3];
    try {
      const res = await fetch(image, { method: 'HEAD' });
      if (!res.ok) {
        broken.push({ id, title, image, status: res.status });
        console.log(`❌ BROKEN (${res.status}): ${title} (${id}) -> ${image}`);
      } else {
        // console.log(`✓ OK: ${title}`);
      }
    } catch (e) {
      broken.push({ id, title, image, status: e.message });
      console.log(`❌ ERROR: ${title} (${id}) -> ${e.message}`);
    }
  }

  console.log(`\nTotal broken: ${broken.length} of ${itemMatches.length}`);
  fs.writeFileSync('broken_featured_items.json', JSON.stringify(broken, null, 2), 'utf8');
}

testAll().then(() => process.exit(0)).catch(e => {
  console.error(e);
  process.exit(1);
});
