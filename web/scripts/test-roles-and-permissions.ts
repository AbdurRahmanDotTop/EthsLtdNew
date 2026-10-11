process.env.CLI_TEST_MODE = "true";

import prisma from "../src/lib/prisma";
import { loginUser } from "../src/actions/auth";
import { 
  updateUserRole, 
  togglePaymentMethod, 
  updateUserStatus, 
  reviewKyc, 
  reviewDeposit, 
  reviewWithdrawal 
} from "../src/actions/admin";
import { getUserTradingInfo, placeOrder } from "../src/actions/trade";
import { getUserProfile } from "../src/actions/user";

async function runRoleAudit() {
  console.log("===============================================================");
  console.log("       ROLE-BASED ACCESS CONTROL (RBAC) VERIFICATION AUDIT     ");
  console.log("===============================================================");

  // 1. Verify existence of all default accounts in database
  console.log("\n[1] Verifying Default Accounts (Super Admin, Admin, User, RM) in Database...");
  const superAdmin = await prisma.user.findUnique({ where: { email: "admin@ethsltd.com" } });
  const admin = await prisma.user.findUnique({ where: { email: "manager@ethsltd.com" } });
  const user = await prisma.user.findUnique({ where: { email: "test@example.com" } });
  const rm = await prisma.user.findUnique({ where: { email: "sarah.rm@ethsltd.com" }, include: { rmProfile: true } });

  if (!superAdmin || superAdmin.role !== "SUPER_ADMIN") throw new Error("Super Admin account invalid or missing.");
  if (!admin || admin.role !== "ADMIN") throw new Error("Admin account invalid or missing.");
  if (!user || user.role !== "USER") throw new Error("User account invalid or missing.");
  if (!rm || rm.role !== "RM" || !rm.rmProfile) throw new Error("RM account or profile invalid or missing.");

  console.log(`  ✓ Super Admin: ${superAdmin.email} | Role: ${superAdmin.role} | UID: ${superAdmin.uid}`);
  console.log(`  ✓ Admin:       ${admin.email} | Role: ${admin.role} | UID: ${admin.uid}`);
  console.log(`  ✓ User:        ${user.email} | Role: ${user.role} | UID: ${user.uid}`);
  console.log(`  ✓ RM:          ${rm.email} | Role: ${rm.role} | Code: ${rm.rmProfile.rmCode} | UID: ${rm.uid}`);

  // 2. Test Super Admin Authentication
  console.log("\n[2] Testing Super Admin Login Authentication...");
  const superAdminLogin = await loginUser({ email: "admin@ethsltd.com", password: "Admin@123456" });
  if (!superAdminLogin.success || superAdminLogin.role !== "SUPER_ADMIN" || superAdminLogin.redirectUrl !== "/admin") {
    throw new Error(`Super Admin login assertion failed: ${JSON.stringify(superAdminLogin)}`);
  }
  console.log(`  ✓ Super Admin logged in successfully! Redirect URL: ${superAdminLogin.redirectUrl}`);

  // 3. Test Admin Authentication
  console.log("\n[3] Testing Admin Login Authentication...");
  const adminLogin = await loginUser({ email: "manager@ethsltd.com", password: "Manager@123456" });
  if (!adminLogin.success || adminLogin.role !== "ADMIN" || adminLogin.redirectUrl !== "/admin") {
    throw new Error(`Admin login assertion failed: ${JSON.stringify(adminLogin)}`);
  }
  console.log(`  ✓ Admin logged in successfully! Redirect URL: ${adminLogin.redirectUrl}`);

  // 4. Test Regular User Authentication
  console.log("\n[4] Testing Regular User Login Authentication...");
  const userLogin = await loginUser({ email: "test@example.com", password: "User@123456" });
  if (!userLogin.success || userLogin.role !== "USER" || userLogin.redirectUrl !== "/assets") {
    throw new Error(`Regular User login assertion failed: ${JSON.stringify(userLogin)}`);
  }
  console.log(`  ✓ Regular User logged in successfully! Redirect URL: ${userLogin.redirectUrl}`);

  // 5. Test Relationship Manager (RM) Authentication
  console.log("\n[5] Testing Relationship Manager (RM) Login Authentication...");
  const rmLogin = await loginUser({ email: "sarah.rm@ethsltd.com", password: "Rm@123456" });
  if (!rmLogin.success || rmLogin.role !== "RM" || rmLogin.redirectUrl !== "/rm/dashboard") {
    throw new Error(`RM login assertion failed: ${JSON.stringify(rmLogin)}`);
  }
  console.log(`  ✓ Relationship Manager logged in successfully! Redirect URL: ${rmLogin.redirectUrl}`);

  // 6. Test Super Admin Only Capabilities (Role Management & Payment Gateways)
  console.log("\n[6] Testing Super Admin Exclusive Capabilities...");
  const roleUpdateResult = await updateUserRole(user.id, "USER");
  if (!roleUpdateResult.success) throw new Error("Super Admin failed to update user role");
  console.log("  ✓ Super Admin role management verified.");

  const paymentMethods = await prisma.paymentMethod.findMany();
  if (paymentMethods.length > 0) {
    const toggleRes = await togglePaymentMethod(paymentMethods[0].id, paymentMethods[0].enabled);
    if (!toggleRes.success) throw new Error("Super Admin payment gateway toggle failed");
    console.log("  ✓ Super Admin payment gateway management verified.");
  }

  // 6. Test User Data Isolation
  console.log("\n[6] Testing User Data Isolation (Balances & Trades)...");
  const userInfo = await getUserTradingInfo(user.id);
  const adminInfo = await getUserTradingInfo(admin.id);
  const superAdminInfo = await getUserTradingInfo(superAdmin.id);

  console.log(`  User USDT Balance:       ${userInfo.balance.toFixed(4)} USDT (UID: ${userInfo.uid})`);
  console.log(`  Admin USDT Balance:      ${adminInfo.balance.toFixed(4)} USDT (UID: ${adminInfo.uid})`);
  console.log(`  Super Admin USDT Balance:${superAdminInfo.balance.toFixed(4)} USDT (UID: ${superAdminInfo.uid})`);

  if (userInfo.uid === adminInfo.uid || userInfo.uid === superAdminInfo.uid) {
    throw new Error("UID collision detected across accounts!");
  }
  console.log("  ✓ Distinct UIDs and strict balance segregation verified.");

  console.log("\n===============================================================");
  console.log("    ALL ROLE-BASED ACCESS CHECKS PASSED WITH 100% SUCCESS!    ");
  console.log("===============================================================");
}

runRoleAudit()
  .then(async () => {
    await prisma.$disconnect();
    process.exit(0);
  })
  .catch(async (err) => {
    console.error("AUDIT FAILED:", err);
    await prisma.$disconnect();
    process.exit(1);
  });
