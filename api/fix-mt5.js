const fs = require('fs');

// mt5-client.ts
let mt5 = fs.readFileSync('src/services/mt5-client.ts', 'utf8');
mt5 = mt5.replace(/const data = await response.json\(\);/g, 'const data = (await response.json()) as any;');
fs.writeFileSync('src/services/mt5-client.ts', mt5);

// trading.ts
let trading = fs.readFileSync('src/routes/trading.ts', 'utf8');
trading = trading.replace(/id: positionId,/g, 'id: positionId as any,');
trading = trading.replace(/const returnedBalance = new Decimal\(spendWallet\.balance\)/g, "const returnedBalance = new Decimal(spendWallet?.balance || '0')");
trading = trading.replace(/const returnedLocked = Decimal\.max\(0, new Decimal\(spendWallet\.lockedBalance\)\.minus\(spendAmount\)\)\.toString\(\);/g, "const returnedLocked = Decimal.max(0, new Decimal(spendWallet?.lockedBalance || '0').minus(spendAmount)).toString();");
trading = trading.replace(/eq\(wallets\.id, spendWallet\.id\)/g, 'eq(wallets.userId, user.id), eq(wallets.assetSymbol, spendAsset)');
fs.writeFileSync('src/routes/trading.ts', trading);
