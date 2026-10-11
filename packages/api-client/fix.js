const fs = require('fs');
let content = fs.readFileSync('src/index.ts', 'utf8');

// The methods to remove based on the TypeScript compiler error duplicate lines:
const methodsToRemove = [
  'generateMfa',
  'enableMfa',
  'disableMfa',
  'getAdminPendingKYC',
  'updateAdminKYCStatus',
  'adminGetWithdrawals',
  'adminApproveWithdrawal',
  'adminRejectWithdrawal',
  'adminUpdateWithdrawalNotes',
  'adminDeleteWithdrawal'
];

// Instead of complex regex, we will split the file by lines and remove the duplicate blocks
// Actually, it's easier to remove the second occurrence of each method.
// A method definition starts with `  async <methodName>(` or `  async <methodName> ()`
let lines = content.split(/\r?\n/);

const seen = new Set();
let i = 0;
while (i < lines.length) {
  const line = lines[i];
  
  // Check if this line starts an async method
  const match = line.match(/^  async ([a-zA-Z0-9_]+)\(/);
  if (match) {
    const methodName = match[1];
    
    if (methodsToRemove.includes(methodName)) {
      if (seen.has(methodName)) {
        // This is a duplicate! Let's find the end of this block (which is a line starting with `  }`)
        let j = i + 1;
        while (j < lines.length && !lines[j].match(/^  \}/)) {
          j++;
        }
        
        // Remove lines from i to j (inclusive)
        lines.splice(i, j - i + 1);
        continue; // check line i again (which is now the next line)
      } else {
        seen.add(methodName);
      }
    }
  }
  
  i++;
}

fs.writeFileSync('src/index.ts', lines.join('\n'));
console.log('Fixed duplicates');
