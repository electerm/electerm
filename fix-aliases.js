const fs = require('fs');
const path = require('path');

function getFiles(dir) {
  let results = [];
  const list = fs.readdirSync(dir);
  list.forEach(file => {
    file = path.join(dir, file);
    if (fs.statSync(file).isDirectory()) {
      results = results.concat(getFiles(file));
    } else if (file.endsWith('.jsx') || file.endsWith('.js')) {
      results.push(file);
    }
  });
  return results;
}

const files = getFiles('src/client');
let count = 0;
files.forEach(f => {
  let content = fs.readFileSync(f, 'utf8');
  if (content.includes("from 'lucide-react'")) {
    let changed = false;
    let newContent = content;
    
    // First, find what to replace and replace the aliases in the file
    let importMatches = content.match(/import\s+\{([^}]+)\}\s+from\s+'lucide-react'/g);
    if (importMatches) {
        importMatches.forEach(m => {
            let inner = m.match(/\{([^}]+)\}/)[1];
            inner.split(',').forEach(item => {
                let parts = item.split(/\s+as\s+/);
                if (parts.length === 2) {
                    let realName = parts[0].trim();
                    let alias = parts[1].trim();
                    // globally replace alias with realName, except if it modifies another real name by accident.
                    // safely with word boundaries
                    newContent = newContent.replace(new RegExp('\\b' + alias + '\\b', 'g'), realName);
                    changed = true;
                }
            });
        })
    }
    
    // Then replace the import statement itself to drop ' as ...'
    if (changed) {
        newContent = newContent.replace(/import\s+\{([^}]+)\}\s+from\s+'lucide-react'/g, (m, g) => {
           let newG = g.split(',').map(s => {
             let p = s.split(/\s+as\s+/);
             return p[0].trim();
           });
           newG = [...new Set(newG)];
           return `import { ${newG.join(', ')} } from 'lucide-react'`;
        });
    }

    if (changed) {
       fs.writeFileSync(f, newContent, 'utf8');
       count++;
    }
  }
});
console.log('Fixed ' + count + ' files');
