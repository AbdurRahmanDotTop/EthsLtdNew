import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

async function main() {
  console.log("Seeding RM users...");
  const rmPasswordHash = await bcrypt.hash("Rm@123456", 10);

  const rmData = [
    {
      email: "sarah.rm@ethsltd.com",
      name: "Sarah Jenkins",
      uid: 781001,
      rmCode: "RM-1001",
      designation: "Senior Crypto Wealth Relationship Manager",
      department: "Private Wealth & VIP Trading",
      bio: "Over 8 years experience in digital asset advisory, institutional hedging strategies, and multi-collateral portfolio optimization for high-net-worth investors.",
      specialties: "Perpetual Futures, Spot Accumulation, Dynamic Hedging, Risk Control",
      avatarUrl: "https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?w=300&auto=format&fit=crop&q=80",
      phone: "+44 20 7946 0912",
      workingHours: "08:00 - 18:00 UTC",
      rating: 4.96,
      experienceYears: 8,
      maxClients: 50,
    },
    {
      email: "david.rm@ethsltd.com",
      name: "David Chen",
      uid: 781002,
      rmCode: "RM-1002",
      designation: "Institutional Derivatives & Options Specialist",
      department: "Institutional Markets",
      bio: "Chartered Financial Analyst specializing in structured crypto derivatives, spread trading, and volatility arbitrage across major crypto pairs.",
      specialties: "Binary Options, Volatility Trading, Cross-Asset Arbitrage, Fixed Yield",
      avatarUrl: "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=300&auto=format&fit=crop&q=80",
      phone: "+65 6712 3456",
      workingHours: "00:00 - 12:00 UTC",
      rating: 4.92,
      experienceYears: 7,
      maxClients: 45,
    },
    {
      email: "elena.rm@ethsltd.com",
      name: "Elena Rostova",
      uid: 781003,
      rmCode: "RM-1003",
      designation: "Quantitative Strategy & Perpetual Futures RM",
      department: "Algorithmic & VIP Execution",
      bio: "Specialist in automated trading execution, algorithmic position sizing, leverage risk management, and capital preservation protocols.",
      specialties: "100x Perpetual Leverage, Algorithmic Execution, Stop-Loss Optimization",
      avatarUrl: "https://images.unsplash.com/photo-1580489944761-15a19d654956?w=300&auto=format&fit=crop&q=80",
      phone: "+41 22 518 9012",
      workingHours: "06:00 - 18:00 UTC",
      rating: 4.98,
      experienceYears: 9,
      maxClients: 60,
    },
  ];

  for (const item of rmData) {
    const user = await prisma.user.upsert({
      where: { email: item.email },
      update: {
        role: "RM",
        name: item.name,
        status: "ACTIVE",
        avatarUrl: item.avatarUrl,
        phone: item.phone,
      },
      create: {
        email: item.email,
        name: item.name,
        passwordHash: rmPasswordHash,
        uid: item.uid,
        role: "RM",
        status: "ACTIVE",
        avatarUrl: item.avatarUrl,
        phone: item.phone,
        isKycVerified: true,
        transactionPin: "654321",
        wallets: {
          create: [
            { asset: "USDT", balance: 0.0, type: "Currency" },
            { asset: "BTC", balance: 0.0, type: "Currency" },
            { asset: "ETH", balance: 0.0, type: "Currency" },
            { asset: "USDC", balance: 0.0, type: "Currency" },
            { asset: "USDT", balance: 0.0, type: "Contract" },
            { asset: "USDT", balance: 0.0, type: "Options" },
          ],
        },
      },
    });

    await prisma.rmProfile.upsert({
      where: { userId: user.id },
      update: {
        rmCode: item.rmCode,
        designation: item.designation,
        department: item.department,
        bio: item.bio,
        specialties: item.specialties,
        avatarUrl: item.avatarUrl,
        phone: item.phone,
        email: item.email,
        workingHours: item.workingHours,
        rating: item.rating,
        experienceYears: item.experienceYears,
        status: "ACTIVE",
        maxClients: item.maxClients,
      },
      create: {
        userId: user.id,
        rmCode: item.rmCode,
        designation: item.designation,
        department: item.department,
        bio: item.bio,
        specialties: item.specialties,
        avatarUrl: item.avatarUrl,
        phone: item.phone,
        email: item.email,
        workingHours: item.workingHours,
        rating: item.rating,
        experienceYears: item.experienceYears,
        status: "ACTIVE",
        maxClients: item.maxClients,
      },
    });

    console.log(`✓ Seeded RM: ${item.name} (${item.rmCode}) - ${item.email}`);
  }

  console.log("Done seeding RMs.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
