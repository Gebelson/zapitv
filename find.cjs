const fs = require('fs');
const path = require('path');

function findFile(dir, filename) {
  let results = [];
  let list = [];
  try {
    list = fs.readdirSync(dir);
  } catch (e) {
    return results;
  }
  
  list.forEach(file => {
    file = path.resolve(dir, file);
    let stat;
    try {
      stat = fs.statSync(file);
    } catch (e) {
      return;
    }
    
    if (stat && stat.isDirectory()) {
      if (!file.includes('/proc') && !file.includes('/sys') && !file.includes('/dev')) {
        results = results.concat(findFile(file, filename));
      }
    } else {
      if (file.endsWith(filename)) {
        results.push(file);
      }
    }
  });
  return results;
}

console.log(findFile('/', 'overview.txt'));
