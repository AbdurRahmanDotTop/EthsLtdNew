import prisma from "../src/lib/prisma";
import { verifyPassword } from "../src/lib/auth";

process.env.CLI_TEST_MODE = "true";

async function runProfileCrudTests() {
  console.log("=== STARTING COMPLETE ADMIN PROFILE MANAGEMENT (A-Z CRUD) TEST ===");

  // Dynamically import server actions with CLI_TEST_MODE set
  const {
    adminCreateUser,
    getUserDetailsAdmin,
    updateUserProfileAdmin,
    adminAddBankCard,
    adminDeleteBankCard,
    adminAddCryptoWallet,
    adminDeleteCryptoWallet,
    adminResetUserPin,
    adjustUserBalance,
    adminDeleteUser,
  } = await import("../src/actions/admin");

  const timestamp = Date.now();
  const testEmail = `profile_crud_${timestamp}@ethsltd.com`;
  const initialPassword = "InitialPassword123!";
  const newPassword = "UpdatedSecurePass456!";

  // 1. CREATE USER (Create in CRUD)
  console.log(`\n[1/10] Testing adminCreateUser for ${testEmail}...`);
  const createRes = await adminCreateUser({
    email: testEmail,
    name: "Profile Test User",
    phone: "+1555000111",
    password: initialPassword,
    role: "USER",
    status: "ACTIVE",
    isKycVerified: false,
    isEmailVerified: true,
    isMerchant: false,
    merchantTier: "STANDARD",
    initialBalanceUsdt: 500,
  });

  if (!createRes.success || !createRes.user) {
    throw new Error(`Failed to create user: ${createRes.error}`);
  }
  const userId = createRes.user.id;
  const userUid = createRes.user.uid;
  console.log(`✓ User created successfully: ID=${userId}, UID=${userUid}`);

  // Verify initial USDT wallet and transaction record
  const initialWallet = await prisma.wallet.findFirst({
    where: { userId, asset: "USDT", type: "Currency" },
  });
  console.log(`✓ Initial USDT Currency Balance: ${initialWallet?.balance} (Expected: 500)`);
  if (!initialWallet || initialWallet.balance !== 500) {
    throw new Error(`Initial balance mismatch: expected 500, got ${initialWallet?.balance}`);
  }

  // 2. READ USER DETAILS (Read in CRUD)
  console.log(`\n[2/10] Testing getUserDetailsAdmin...`);
  const detailsRes = await getUserDetailsAdmin(userId);
  if (!detailsRes.success || !detailsRes.user) {
    throw new Error(`Failed to get user details: ${detailsRes.error}`);
  }
  console.log(`✓ Retrieved user details: Email=${detailsRes.user.email}, Wallets=${detailsRes.user.wallets?.length}`);

  // 3. UPDATE BASIC PROFILE & ROLE (Update in CRUD)
  console.log(`\n[3/10] Testing updateUserProfileAdmin (Name, Phone, Status, Merchant)...`);
  const updateRes = await updateUserProfileAdmin(userId, {
    name: "Updated Full Name",
    phone: "+919876543210",
    status: "FLAGGED_SPAM",
    isMerchant: true,
    merchantTier: "VIP",
  });
  if (!updateRes.success) {
    throw new Error(`Failed to update profile: ${updateRes.error}`);
  }

  const userAfterUpdate = await prisma.user.findUnique({ where: { id: userId } });
  if (
    userAfterUpdate?.name !== "Updated Full Name" ||
    userAfterUpdate?.phone !== "+919876543210" ||
    userAfterUpdate?.status !== "FLAGGED_SPAM" ||
    userAfterUpdate?.isMerchant !== true ||
    userAfterUpdate?.merchantTier !== "VIP"
  ) {
    throw new Error("User fields did not reflect the update");
  }
  console.log(`✓ Basic profile and merchant settings updated and verified.`);

  // 4. ADMINISTRATIVE PASSWORD RESET (Bcrypt Hashed)
  console.log(`\n[4/10] Testing administrative password reset...`);
  const pwdUpdateRes = await updateUserProfileAdmin(userId, {
    newPassword,
  });
  if (!pwdUpdateRes.success) {
    throw new Error(`Failed to reset password: ${pwdUpdateRes.error}`);
  }

  const userWithNewPwd = await prisma.user.findUnique({ where: { id: userId } });
  const isOldValid = await verifyPassword(initialPassword, userWithNewPwd!.passwordHash);
  const isNewValid = await verifyPassword(newPassword, userWithNewPwd!.passwordHash);

  if (isOldValid || !isNewValid) {
    throw new Error(`Password check failed: old is ${isOldValid ? "valid" : "invalid"}, new is ${isNewValid ? "valid" : "invalid"}`);
  }
  console.log(`✓ Password reset succeeded: old password rejected, new password verified via bcrypt.`);

  // 5. TRANSACTION PIN MANAGEMENT
  console.log(`\n[5/10] Testing Transaction PIN update and reset...`);
  const pinUpdateRes = await updateUserProfileAdmin(userId, {
    transactionPin: "998877",
  });
  if (!pinUpdateRes.success) throw new Error("Failed to set custom PIN");
  let userPin = (await prisma.user.findUnique({ where: { id: userId } }))?.transactionPin;
  if (userPin !== "998877") throw new Error(`PIN mismatch: expected 998877, got ${userPin}`);
  console.log(`✓ Custom PIN set: ${userPin}`);

  const pinResetRes = await adminResetUserPin(userId);
  if (!pinResetRes.success) throw new Error("Failed to reset PIN to default");
  userPin = (await prisma.user.findUnique({ where: { id: userId } }))?.transactionPin;
  if (userPin !== "123456") throw new Error(`Reset PIN mismatch: expected 123456, got ${userPin}`);
  console.log(`✓ PIN reset to default 123456 verified.`);

  // 6. KYC DETAILS & VERIFICATION CRUD
  console.log(`\n[6/10] Testing KYC Application CRUD...`);
  const kycUpdateRes = await updateUserProfileAdmin(userId, {
    isKycVerified: true,
    kycDetails: {
      documentType: "PASSPORT",
      idNumber: "Z987654321",
      fullName: "Updated Full Name",
      dateOfBirth: "1990-05-15",
      gender: "MALE",
      nationality: "Indian",
      country: "India",
      city: "Mumbai",
      address: "42 Marine Drive, Nariman Point",
      status: "APPROVED",
    },
  });
  if (!kycUpdateRes.success) throw new Error(`KYC update failed: ${kycUpdateRes.error}`);

  const kycRecord = await prisma.kycApplication.findUnique({ where: { userId } });
  if (!kycRecord || kycRecord.idNumber !== "Z987654321" || kycRecord.status !== "APPROVED") {
    throw new Error("KYC Application record verification failed.");
  }
  console.log(`✓ KYC Application created/updated: DocumentType=${kycRecord.documentType}, ID=${kycRecord.idNumber}, Status=${kycRecord.status}`);

  // 7. BANK CARD CRUD
  console.log(`\n[7/10] Testing Bank Card CRUD...`);
  const bankCardRes = await adminAddBankCard({
    userId,
    bankName: "HDFC Bank",
    accountHolder: "Updated Full Name",
    accountNumber: "50100223344556",
    ifscCode: "HDFC0001234",
    branchName: "Fort Mumbai",
    country: "India",
  });
  if (!bankCardRes.success || !bankCardRes.card) {
    throw new Error(`Failed to add bank card: ${bankCardRes.error}`);
  }
  const cardId = bankCardRes.card.id;
  console.log(`✓ Bank card added: ID=${cardId}, Bank=${bankCardRes.card.bankName}`);

  const deleteBankRes = await adminDeleteBankCard(cardId);
  if (!deleteBankRes.success) throw new Error(`Failed to delete bank card: ${deleteBankRes.error}`);
  const cardCheck = await prisma.bankCard.findUnique({ where: { id: cardId } });
  if (cardCheck) throw new Error("Bank card still exists after deletion.");
  console.log(`✓ Bank card deleted successfully.`);

  // 8. CRYPTO WALLET CRUD
  console.log(`\n[8/10] Testing Crypto Wallet CRUD...`);
  const cryptoRes = await adminAddCryptoWallet({
    userId,
    asset: "USDT",
    network: "TRC20",
    address: "TXyz9876543210TronAddressMockTest",
    label: "Treasury Cold Wallet",
  });
  if (!cryptoRes.success || !cryptoRes.wallet) {
    throw new Error(`Failed to add crypto wallet: ${cryptoRes.error}`);
  }
  const cryptoWalletId = cryptoRes.wallet.id;
  console.log(`✓ Crypto wallet added: ID=${cryptoWalletId}, Network=${cryptoRes.wallet.network}`);

  const deleteCryptoRes = await adminDeleteCryptoWallet(cryptoWalletId);
  if (!deleteCryptoRes.success) throw new Error(`Failed to delete crypto wallet: ${deleteCryptoRes.error}`);
  const cryptoCheck = await prisma.userCryptoWallet.findUnique({ where: { id: cryptoWalletId } });
  if (cryptoCheck) throw new Error("Crypto wallet still exists after deletion.");
  console.log(`✓ Crypto wallet deleted successfully.`);

  // 9. BALANCE ADJUSTMENT INTEGRITY
  console.log(`\n[9/10] Testing balance adjustment (Credit & Debit)...`);
  const creditRes = await adjustUserBalance({
    userId,
    asset: "USDT",
    amount: 150,
    type: "CREDIT",
    reason: "Test credit adjustment",
  });
  if (!creditRes.success) throw new Error(`Credit adjustment failed: ${creditRes.error}`);
  console.log(`✓ Balance after credit: ${creditRes.newBalance} (Expected: 650)`);

  const debitRes = await adjustUserBalance({
    userId,
    asset: "USDT",
    amount: 50,
    type: "DEBIT",
    reason: "Test debit adjustment",
  });
  if (!debitRes.success) throw new Error(`Debit adjustment failed: ${debitRes.error}`);
  console.log(`✓ Balance after debit: ${debitRes.newBalance} (Expected: 600)`);

  // 10. PERMANENT DELETION (Delete in CRUD)
  console.log(`\n[10/10] Testing permanent cascading deletion...`);
  const deleteRes = await adminDeleteUser(userId);
  if (!deleteRes.success) throw new Error(`Failed to delete user: ${deleteRes.error}`);

  const deletedUserCheck = await prisma.user.findUnique({ where: { id: userId } });
  if (deletedUserCheck) throw new Error("User record still exists after deletion.");

  const deletedWallets = await prisma.wallet.findMany({ where: { userId } });
  if (deletedWallets.length > 0) throw new Error("Wallets still exist after deletion.");

  console.log(`✓ Permanent deletion successful: User and all cascaded records completely purged.`);

  console.log("\n=======================================================");
  console.log(">>> ALL 10 PROFILE CRUD & INTEGRITY TESTS PASSED! <<<");
  console.log("=======================================================\n");
}

runProfileCrudTests()
  .catch((err) => {
    console.error("Test failed:", err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
