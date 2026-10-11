import { PrismaClient } from '@prisma/client'
import bcrypt from 'bcryptjs'

const prisma = new PrismaClient()

async function main() {
  const superAdminPasswordHash = await bcrypt.hash('Admin@123456', 10)
  const adminPasswordHash = await bcrypt.hash('Manager@123456', 10)
  const userPasswordHash = await bcrypt.hash('User@123456', 10)

  // 1. Seed Default Super Admin Account
  const superAdmin = await prisma.user.upsert({
    where: { email: 'admin@ethsltd.com' },
    update: {
      role: 'SUPER_ADMIN',
      status: 'ACTIVE',
      passwordHash: superAdminPasswordHash,
    },
    create: {
      email: 'admin@ethsltd.com',
      name: 'System Super Admin',
      passwordHash: superAdminPasswordHash,
      uid: 100001,
      role: 'SUPER_ADMIN',
      status: 'ACTIVE',
      isKycVerified: true,
      transactionPin: '888888',
      wallets: {
        create: [
          { asset: 'USDT', balance: 0.0, type: 'Currency' },
          { asset: 'BTC', balance: 0.0, type: 'Currency' },
          { asset: 'ETH', balance: 0.0, type: 'Currency' },
          { asset: 'USDC', balance: 0.0, type: 'Currency' },
          { asset: 'USDT', balance: 0.0, type: 'Contract' },
          { asset: 'USDT', balance: 0.0, type: 'Options' },
        ]
      }
    },
  })
  console.log('✓ Seeded Super Admin:', superAdmin.email, 'Role:', superAdmin.role, 'UID:', superAdmin.uid)

  // 2. Seed Default Operations Admin Account
  const admin = await prisma.user.upsert({
    where: { email: 'manager@ethsltd.com' },
    update: {
      role: 'ADMIN',
      status: 'ACTIVE',
      passwordHash: adminPasswordHash,
    },
    create: {
      email: 'manager@ethsltd.com',
      name: 'Operations Manager Admin',
      passwordHash: adminPasswordHash,
      uid: 100002,
      role: 'ADMIN',
      status: 'ACTIVE',
      isKycVerified: true,
      transactionPin: '777777',
      wallets: {
        create: [
          { asset: 'USDT', balance: 0.0, type: 'Currency' },
          { asset: 'BTC', balance: 0.0, type: 'Currency' },
          { asset: 'ETH', balance: 0.0, type: 'Currency' },
          { asset: 'USDC', balance: 0.0, type: 'Currency' },
          { asset: 'USDT', balance: 0.0, type: 'Contract' },
          { asset: 'USDT', balance: 0.0, type: 'Options' },
        ]
      }
    },
  })
  console.log('✓ Seeded Operations Admin:', admin.email, 'Role:', admin.role, 'UID:', admin.uid)

  // 3. Seed Default Regular User Account
  const user = await prisma.user.upsert({
    where: { email: 'test@example.com' },
    update: {
      role: 'USER',
      status: 'ACTIVE',
      passwordHash: userPasswordHash,
      transactionPin: '123456',
    },
    create: {
      email: 'test@example.com',
      name: 'Alex Trader',
      passwordHash: userPasswordHash,
      uid: 621154,
      role: 'USER',
      status: 'ACTIVE',
      isKycVerified: true,
      transactionPin: '123456',
      wallets: {
        create: [
          { asset: 'USDT', balance: 0.0, type: 'Currency' },
          { asset: 'BTC', balance: 0.0, type: 'Currency' },
          { asset: 'ETH', balance: 0.0, type: 'Currency' },
          { asset: 'USDC', balance: 0.0, type: 'Currency' },
          { asset: 'USDT', balance: 0.0, type: 'Contract' },
          { asset: 'USDT', balance: 0.0, type: 'Options' },
        ]
      }
    },
  })
  console.log('✓ Seeded Regular User:', user.email, 'Role:', user.role, 'UID:', user.uid)

  // 4. Seed Bank Card for Regular User
  const existingCard = await prisma.bankCard.findFirst({
    where: { userId: user.id }
  })
  if (!existingCard) {
    await prisma.bankCard.create({
      data: {
        userId: user.id,
        bankName: 'Axis Bank',
        fullName: 'Alex Trader',
        iban: '9250******4077',
        swiftCode: 'AXISINBB001',
        bankAddress: 'Mumbai Central Branch, India',
      }
    })
    console.log('✓ Seeded Bank Card for Regular User')
  }

  // 5. Seed Payment Methods
  const count = await prisma.paymentMethod.count()
  if (count === 0) {
    await prisma.paymentMethod.createMany({
      data: [
        {
          name: 'Axis Bank (Direct Transfer)',
          type: 'BANK',
          bankName: 'Axis Bank Ltd',
          accountHolder: 'ETHSLTD TRADING CORP',
          accountNumber: '921020048192384',
          ifscOrSwift: 'UTIB0000004',
          instructions: 'Please transfer amount and submit the UTR / transaction reference number.',
          minAmount: 50.0,
          maxAmount: 100000.0,
          enabled: true,
          displayOrder: 1,
        },
        {
          name: 'USDT (TRC-20 Network)',
          type: 'CRYPTO',
          network: 'TRC-20',
          address: 'TYDzsYUEW245Ghtr8274jhkdsh293HGsQx',
          instructions: 'Send only USDT via TRC20 network. Minimum deposit 10 USDT.',
          minAmount: 10.0,
          enabled: true,
          displayOrder: 2,
        },
        {
          name: 'USDT (ERC-20 Network)',
          type: 'CRYPTO',
          network: 'ERC-20',
          address: '0x71C8364765A2DE350e7EB228315f74719292923',
          instructions: 'Send only USDT via Ethereum network. Minimum deposit 50 USDT.',
          minAmount: 50.0,
          enabled: true,
          displayOrder: 3,
        }
      ]
    })
    console.log('✓ Seeded Payment Methods')
  }

  // 6. Seed Default Relationship Managers (RMs)
  const rmPasswordHash = await bcrypt.hash('Rm@123456', 10)
  const rmData = [
    {
      email: 'sarah.rm@ethsltd.com',
      name: 'Sarah Jenkins',
      uid: 781001,
      rmCode: 'RM-1001',
      designation: 'Senior Crypto Wealth Relationship Manager',
      department: 'Private Wealth & VIP Trading',
      bio: 'Over 8 years experience in digital asset advisory, institutional hedging strategies, and multi-collateral portfolio optimization for high-net-worth investors.',
      specialties: 'Perpetual Futures, Spot Accumulation, Dynamic Hedging, Risk Control',
      avatarUrl: 'https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?w=300&auto=format&fit=crop&q=80',
      phone: '+44 20 7946 0912',
      workingHours: '08:00 - 18:00 UTC',
      rating: 4.96,
      experienceYears: 8,
      maxClients: 50,
    },
    {
      email: 'david.rm@ethsltd.com',
      name: 'David Chen',
      uid: 781002,
      rmCode: 'RM-1002',
      designation: 'Institutional Derivatives & Options Specialist',
      department: 'Institutional Markets',
      bio: 'Chartered Financial Analyst specializing in structured crypto derivatives, spread trading, and volatility arbitrage across major crypto pairs.',
      specialties: 'Binary Options, Volatility Trading, Cross-Asset Arbitrage, Fixed Yield',
      avatarUrl: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=300&auto=format&fit=crop&q=80',
      phone: '+65 6712 3456',
      workingHours: '00:00 - 12:00 UTC',
      rating: 4.92,
      experienceYears: 7,
      maxClients: 45,
    },
    {
      email: 'elena.rm@ethsltd.com',
      name: 'Elena Rostova',
      uid: 781003,
      rmCode: 'RM-1003',
      designation: 'Quantitative Strategy & Perpetual Futures RM',
      department: 'Algorithmic & VIP Execution',
      bio: 'Specialist in automated trading execution, algorithmic position sizing, leverage risk management, and capital preservation protocols.',
      specialties: '100x Perpetual Leverage, Algorithmic Execution, Stop-Loss Optimization',
      avatarUrl: 'https://images.unsplash.com/photo-1580489944761-15a19d654956?w=300&auto=format&fit=crop&q=80',
      phone: '+41 22 518 9012',
      workingHours: '06:00 - 18:00 UTC',
      rating: 4.98,
      experienceYears: 9,
      maxClients: 60,
    },
  ]

  for (const item of rmData) {
    const rmUser = await prisma.user.upsert({
      where: { email: item.email },
      update: {
        role: 'RM',
        name: item.name,
        status: 'ACTIVE',
        avatarUrl: item.avatarUrl,
        phone: item.phone,
        passwordHash: rmPasswordHash,
      },
      create: {
        email: item.email,
        name: item.name,
        passwordHash: rmPasswordHash,
        uid: item.uid,
        role: 'RM',
        status: 'ACTIVE',
        avatarUrl: item.avatarUrl,
        phone: item.phone,
        isKycVerified: true,
        transactionPin: '654321',
        wallets: {
          create: [
            { asset: 'USDT', balance: 0.0, type: 'Currency' },
            { asset: 'BTC', balance: 0.0, type: 'Currency' },
            { asset: 'ETH', balance: 0.0, type: 'Currency' },
            { asset: 'USDC', balance: 0.0, type: 'Currency' },
            { asset: 'USDT', balance: 0.0, type: 'Contract' },
            { asset: 'USDT', balance: 0.0, type: 'Options' },
          ],
        },
      },
    })

    await prisma.rmProfile.upsert({
      where: { userId: rmUser.id },
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
        status: 'ACTIVE',
        maxClients: item.maxClients,
      },
      create: {
        userId: rmUser.id,
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
        status: 'ACTIVE',
        maxClients: item.maxClients,
      },
    })

    console.log(`✓ Seeded Relationship Manager: ${item.name} (${item.rmCode}) Role: RM UID: ${item.uid}`)
  }
}

main()
  .then(async () => {
    await prisma.$disconnect()
  })
  .catch(async (e) => {
    console.error(e)
    await prisma.$disconnect()
    process.exit(1)
  })
