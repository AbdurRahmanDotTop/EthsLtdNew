/**
 * Synchronous client & server crypto address validation utility
 */

export function validateCryptoAddress(
  arg1: string,
  arg2: string,
  arg3?: string
): { valid: boolean; error?: string } {
  let network = arg1;
  let address = arg2;
  if (arg3 !== undefined) {
    // Called as (asset, network, address)
    network = arg2;
    address = arg3;
  }

  const addr = (address || "").trim();
  const net = (network || "").toUpperCase();

  if (!addr) {
    return { valid: false, error: "Wallet address cannot be empty." };
  }

  if (net === "TRC20") {
    if (!addr.startsWith("T") || addr.length !== 34) {
      return { valid: false, error: "Invalid TRC20 address. TRC20 addresses must start with 'T' and be 34 characters long." };
    }
    return { valid: true };
  }

  if (net === "ERC20" || net === "BEP20" || net === "POLYGON" || net === "ARBITRUM" || net === "OPTIMISM") {
    if (!/^0x[a-fA-F0-9]{40}$/.test(addr)) {
      return { valid: false, error: `Invalid ${net} address. Must be a valid 42-character hex address starting with '0x'.` };
    }
    return { valid: true };
  }

  if (net === "BTC" || net === "BITCOIN") {
    if (!/^(1|3|bc1)[a-zA-HJ-NP-Z0-9]{25,62}$/.test(addr)) {
      return { valid: false, error: "Invalid Bitcoin address. Must start with 1, 3, or bc1." };
    }
    return { valid: true };
  }

  if (net === "SOL" || net === "SOLANA") {
    if (addr.length < 32 || addr.length > 44) {
      return { valid: false, error: "Invalid Solana address length (expected 32-44 characters base58)." };
    }
    return { valid: true };
  }

  if (addr.length < 10 || /\s/.test(addr)) {
    return { valid: false, error: "Invalid wallet address format." };
  }

  return { valid: true };
}
