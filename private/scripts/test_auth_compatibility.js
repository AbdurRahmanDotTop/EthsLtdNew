const crypto = require("crypto");
const bcrypt = require("bcryptjs");

async function verifyPassword(password, hash) {
  if (!password || !hash) return false;

  // Cloudflare D1 P2P system compatibility: 64-hex char SHA-256 hash
  if (hash.length === 64 && /^[0-9a-fA-F]{64}$/.test(hash)) {
    try {
      const shaHex = crypto.createHash("sha256").update(password).digest("hex");
      if (shaHex.toLowerCase() === hash.toLowerCase()) {
        return true;
      }
    } catch (e) {
      // fallback
    }
  }

  try {
    return await bcrypt.compare(password, hash);
  } catch (e) {
    return false;
  }
}

async function test() {
  console.log("Testing Authentication Compatibility...");
  
  // 1. Test standard bcrypt
  const salt = await bcrypt.genSalt(10);
  const bcryptHash = await bcrypt.hash("MySecurePass123!", salt);
  const bcryptValid = await verifyPassword("MySecurePass123!", bcryptHash);
  const bcryptInvalid = await verifyPassword("WrongPassword", bcryptHash);
  console.log(`Bcrypt test: valid=${bcryptValid}, invalid=${!bcryptInvalid}`);

  // 2. Test Cloudflare D1 SHA-256 hash
  const shaHash = crypto.createHash("sha256").update("P2PPassword2026!").digest("hex");
  const shaValid = await verifyPassword("P2PPassword2026!", shaHash);
  const shaInvalid = await verifyPassword("WrongPassword", shaHash);
  console.log(`SHA-256 test: valid=${shaValid}, invalid=${!shaInvalid}`);

  if (bcryptValid && !bcryptInvalid && shaValid && !shaInvalid) {
    console.log("PASS: Both authentication formats work seamlessly!");
  } else {
    console.error("FAIL: Authentication compatibility check failed!");
    process.exit(1);
  }
}

test();
