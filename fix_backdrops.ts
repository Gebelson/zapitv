import * as fs from 'fs';

function fixFile(filename: string) {
  let content = fs.readFileSync(filename, 'utf8');
  let lines = content.split('\n');
  for (let i = 0; i < lines.length; i++) {
    if (lines[i].includes('"backdrop": "https://picsum.photos') || lines[i].includes("backdrop: 'https://picsum.photos")) {
      let imageMatch = null;
      for (let j = i - 1; j >= Math.max(0, i - 5); j--) {
        if (lines[j].includes('"image":') || lines[j].includes('image:')) {
          let match = lines[j].match(/['"](https?:\/\/[^'"]+)['"]/);
          if (match) {
            imageMatch = match[1];
            break;
          }
        }
      }
      
      if (imageMatch) {
        if (lines[i].includes('"backdrop":')) {
          lines[i] = lines[i].replace(/"backdrop":\s*"[^"]+"/, `"backdrop": "${imageMatch}"`);
        } else if (lines[i].includes("backdrop:")) {
          lines[i] = lines[i].replace(/backdrop:\s*'[^']+'/, `backdrop: '${imageMatch}'`);
        }
      }
    }
  }
  fs.writeFileSync(filename, lines.join('\n'));
}

fixFile('constants.tsx');
fixFile('new_movies.json');
console.log('Done');
