const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  console.log('Seeding Channel Types and Custom Fields...');

  // 1. Channel Types
  const channelTypesData = [
    {
      identifier: 'BANK',
      name: 'Bank Account / IMPS',
      description: 'Direct bank wire, IMPS, NEFT, RTGS or online banking transfer',
      icon: 'Landmark',
      displayOrder: 1,
      fields: [
        { fieldName: 'accountHolder', fieldLabel: 'Account Holder Full Name', fieldType: 'TEXT', required: true, displayOrder: 1, placeholder: 'e.g. John Doe' },
        { fieldName: 'bankName', fieldLabel: 'Bank Name', fieldType: 'TEXT', required: true, displayOrder: 2, placeholder: 'e.g. HDFC Bank, Chase' },
        { fieldName: 'accountNumber', fieldLabel: 'Account Number', fieldType: 'TEXT', required: true, displayOrder: 3, placeholder: 'e.g. 50100234123456' },
        { fieldName: 'ifscCode', fieldLabel: 'IFSC / Branch / Routing Code', fieldType: 'TEXT', required: true, displayOrder: 4, placeholder: 'e.g. HDFC0001234' },
        { fieldName: 'accountType', fieldLabel: 'Account Type', fieldType: 'DROPDOWN', required: false, displayOrder: 5, options: JSON.stringify(['Savings', 'Current / Checking', 'Salary']), defaultValue: 'Savings' },
      ],
    },
    {
      identifier: 'UPI',
      name: 'UPI / QR Code',
      description: 'Instant virtual payment address (VPA) or static payment QR code',
      icon: 'QrCode',
      displayOrder: 2,
      fields: [
        { fieldName: 'vpaAddress', fieldLabel: 'UPI ID / VPA', fieldType: 'TEXT', required: true, displayOrder: 1, placeholder: 'e.g. username@okhdfcbank' },
        { fieldName: 'payeeName', fieldLabel: 'Registered Payee Name', fieldType: 'TEXT', required: true, displayOrder: 2, placeholder: 'e.g. John Doe' },
        { fieldName: 'qrCodeUrl', fieldLabel: 'Payment QR Code URL', fieldType: 'TEXT', required: false, displayOrder: 3, placeholder: 'e.g. https://... or leave empty', helpText: 'Optional direct link to QR code image' },
      ],
    },
    {
      identifier: 'WALLET',
      name: 'E-Wallet (PayPal / Wise / Zelle)',
      description: 'Digital electronic wallet or international peer-to-peer money transfer',
      icon: 'Wallet',
      displayOrder: 3,
      fields: [
        { fieldName: 'walletEmail', fieldLabel: 'Registered Wallet Email / Username', fieldType: 'EMAIL', required: true, displayOrder: 1, placeholder: 'e.g. trader@example.com' },
        { fieldName: 'accountName', fieldLabel: 'Account Holder Name', fieldType: 'TEXT', required: true, displayOrder: 2, placeholder: 'e.g. John Doe' },
        { fieldName: 'phoneNumber', fieldLabel: 'Registered Phone Number', fieldType: 'PHONE', required: false, displayOrder: 3, placeholder: 'e.g. +1 555 123 4567' },
      ],
    },
    {
      identifier: 'CASH',
      name: 'Cash / In-Person Settlement',
      description: 'Direct cash deposit in branch or verified in-person settlement',
      icon: 'Banknote',
      displayOrder: 4,
      fields: [
        { fieldName: 'cityRegion', fieldLabel: 'City / Trading Location', fieldType: 'TEXT', required: true, displayOrder: 1, placeholder: 'e.g. Mumbai, Dubai, London' },
        { fieldName: 'contactPhone', fieldLabel: 'Contact Phone / Telegram ID', fieldType: 'TEXT', required: true, displayOrder: 2, placeholder: 'e.g. @username or +1...' },
      ],
    },
  ];

  const channelMap = {};
  for (const c of channelTypesData) {
    const channel = await prisma.p2pChannelType.upsert({
      where: { identifier: c.identifier },
      update: {
        name: c.name,
        description: c.description,
        icon: c.icon,
        displayOrder: c.displayOrder,
      },
      create: {
        identifier: c.identifier,
        name: c.name,
        description: c.description,
        icon: c.icon,
        displayOrder: c.displayOrder,
      },
    });
    channelMap[c.identifier] = channel.id;

    for (const f of c.fields) {
      await prisma.p2pChannelField.upsert({
        where: {
          channelTypeId_fieldName: {
            channelTypeId: channel.id,
            fieldName: f.fieldName,
          },
        },
        update: {
          fieldLabel: f.fieldLabel,
          fieldType: f.fieldType,
          required: f.required,
          displayOrder: f.displayOrder,
          placeholder: f.placeholder,
          helpText: f.helpText,
          options: f.options,
          defaultValue: f.defaultValue,
        },
        create: {
          channelTypeId: channel.id,
          fieldName: f.fieldName,
          fieldLabel: f.fieldLabel,
          fieldType: f.fieldType,
          required: f.required,
          displayOrder: f.displayOrder,
          placeholder: f.placeholder,
          helpText: f.helpText,
          options: f.options,
          defaultValue: f.defaultValue,
        },
      });
    }
  }

  // 2. Link existing P2pSystemPaymentMethod to Channel Types
  console.log('Linking System Payment Methods to Channel Types...');
  const methodLinks = [
    { identifier: 'bank_transfer', channelKey: 'BANK' },
    { identifier: 'upi', channelKey: 'UPI' },
    { identifier: 'imps', channelKey: 'BANK' },
    { identifier: 'paypal', channelKey: 'WALLET' },
    { identifier: 'zelle', channelKey: 'WALLET' },
    { identifier: 'wise', channelKey: 'WALLET' },
    { identifier: 'cash_app', channelKey: 'WALLET' },
    { identifier: 'revolut', channelKey: 'WALLET' },
  ];

  for (const ml of methodLinks) {
    if (channelMap[ml.channelKey]) {
      await prisma.p2pSystemPaymentMethod.updateMany({
        where: { identifier: ml.identifier },
        data: { channelTypeId: channelMap[ml.channelKey] },
      });
    }
  }

  // 3. Seed Crypto Assets
  console.log('Seeding Crypto Assets...');
  const cryptoAssetsData = [
    { symbol: 'USDT', name: 'Tether USD', iconUrl: '₮', description: 'USD Pegged Stablecoin', networks: JSON.stringify(['TRC20', 'ERC20', 'BEP20', 'POLYGON', 'SOL']), decimals: 6, displayOrder: 1 },
    { symbol: 'BTC', name: 'Bitcoin', iconUrl: '₿', description: 'Decentralized Digital Currency', networks: JSON.stringify(['BTC', 'BEP20']), decimals: 8, displayOrder: 2 },
    { symbol: 'ETH', name: 'Ethereum', iconUrl: 'Ξ', description: 'Smart Contract Platform Token', networks: JSON.stringify(['ERC20', 'ARBITRUM', 'OPTIMISM']), decimals: 18, displayOrder: 3 },
    { symbol: 'SOL', name: 'Solana', iconUrl: '◎', description: 'High-Throughput Blockchain', networks: JSON.stringify(['SOL']), decimals: 9, displayOrder: 4 },
    { symbol: 'USDC', name: 'USD Coin', iconUrl: '💵', description: 'Fully Reserved Fiat-Backed Stablecoin', networks: JSON.stringify(['ERC20', 'TRC20', 'BEP20', 'SOL']), decimals: 6, displayOrder: 5 },
  ];

  for (const a of cryptoAssetsData) {
    await prisma.cryptoAsset.upsert({
      where: { symbol: a.symbol },
      update: {
        name: a.name,
        iconUrl: a.iconUrl,
        description: a.description,
        networks: a.networks,
        decimals: a.decimals,
        displayOrder: a.displayOrder,
        canP2p: true,
        canDeposit: true,
        canWithdraw: true,
        isActive: true,
      },
      create: {
        symbol: a.symbol,
        name: a.name,
        iconUrl: a.iconUrl,
        description: a.description,
        networks: a.networks,
        decimals: a.decimals,
        displayOrder: a.displayOrder,
        canP2p: true,
        canDeposit: true,
        canWithdraw: true,
        isActive: true,
      },
    });
  }

  // 4. Seed Fiat Currencies
  console.log('Seeding Fiat Currencies...');
  const fiatCurrenciesData = [
    { code: 'INR', name: 'Indian Rupee', symbol: '₹', country: 'India', decimals: 2, displayOrder: 1 },
    { code: 'USD', name: 'US Dollar', symbol: '$', country: 'United States', decimals: 2, displayOrder: 2 },
    { code: 'EUR', name: 'Euro', symbol: '€', country: 'European Union', decimals: 2, displayOrder: 3 },
    { code: 'GBP', name: 'British Pound', symbol: '£', country: 'United Kingdom', decimals: 2, displayOrder: 4 },
    { code: 'AED', name: 'UAE Dirham', symbol: 'د.إ', country: 'United Arab Emirates', decimals: 2, displayOrder: 5 },
    { code: 'NGN', name: 'Nigerian Naira', symbol: '₦', country: 'Nigeria', decimals: 2, displayOrder: 6 },
  ];

  for (const f of fiatCurrenciesData) {
    await prisma.fiatCurrency.upsert({
      where: { code: f.code },
      update: {
        name: f.name,
        symbol: f.symbol,
        country: f.country,
        decimals: f.decimals,
        displayOrder: f.displayOrder,
        canP2p: true,
        isActive: true,
      },
      create: {
        code: f.code,
        name: f.name,
        symbol: f.symbol,
        country: f.country,
        decimals: f.decimals,
        displayOrder: f.displayOrder,
        canP2p: true,
        isActive: true,
      },
    });
  }

  console.log('Seeding completed successfully!');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
