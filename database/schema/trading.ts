import { sqliteTable, text, integer } from 'drizzle-orm/sqlite-core';
import { users } from './auth';

export const markets = sqliteTable('markets', {
  id: text('id').primaryKey(),
  symbol: text('symbol').notNull().unique(), // e.g. BTC-USDT, EURUSD
  type: text('type', { enum: ['SPOT', 'MARGIN', 'CFD'] }).notNull().default('SPOT'),
  baseAsset: text('base_asset').notNull(), // BTC, EUR
  quoteAsset: text('quote_asset').notNull(), // USDT, USD
  status: text('status', { enum: ['ACTIVE', 'PAUSED', 'DELISTED'] }).notNull().default('ACTIVE'),
  minPrice: text('min_price').notNull(),
  maxPrice: text('max_price').notNull(),
  tickSize: text('tick_size').notNull(),
  tickValue: text('tick_value').notNull().default('1'),
  contractSize: text('contract_size').notNull().default('1'),
  minAmount: text('min_amount').notNull(),
  maxAmount: text('max_amount').notNull().default('1000000'),
  stepSize: text('step_size').notNull(),
  makerFee: text('maker_fee').notNull().default('0.001'), 
  takerFee: text('taker_fee').notNull().default('0.001'),
  swapLong: text('swap_long').notNull().default('0'), // MT5 swap for holding long
  swapShort: text('swap_short').notNull().default('0'), // MT5 swap for holding short
  pricePrecision: integer('price_precision').notNull().default(2),
  quantityPrecision: integer('quantity_precision').notNull().default(6),
  maxLeverage: text('max_leverage').notNull().default('100'),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull(),
});

export const orders = sqliteTable('orders', {
  id: text('id').primaryKey(),
  displayId: text('display_id').unique(),
  userId: text('user_id').notNull().references(() => users.id),
  marketSymbol: text('market_symbol').notNull().references(() => markets.symbol),
  side: text('side', { enum: ['BUY', 'SELL'] }).notNull(),
  type: text('type', { enum: ['MARKET', 'LIMIT', 'STOP', 'STOP_LIMIT'] }).notNull(),
  status: text('status', { enum: ['CREATED', 'VALIDATING', 'ACCEPTED', 'ROUTING', 'PARTIALLY_FILLED', 'FILLED', 'REJECTED', 'CANCELED', 'EXPIRED', 'MODIFIED'] }).notNull().default('CREATED'),
  timeInForce: text('time_in_force', { enum: ['GTC', 'IOC', 'FOK', 'DAY', 'GTD'] }).notNull().default('GTC'),
  price: text('price'), // null for market orders
  stopPrice: text('stop_price'), // for stop orders
  stopLoss: text('stop_loss'), // MT5 SL
  takeProfit: text('take_profit'), // MT5 TP
  amount: text('amount').notNull(), // requested volume
  filledAmount: text('filled_amount').notNull().default('0'),
  remainingAmount: text('remaining_amount').notNull(),
  idempotencyKey: text('idempotency_key'),
  positionId: text('position_id'), // FK to positions.id (defined via migration, not schema to avoid circular type)
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull(),
  updatedAt: integer('updated_at', { mode: 'timestamp' }).notNull(),
});

export const positions = sqliteTable('positions', {
  id: text('id').primaryKey(),
  displayId: text('display_id').unique(),
  userId: text('user_id').notNull().references(() => users.id),
  marketSymbol: text('market_symbol').notNull().references(() => markets.symbol),
  side: text('side', { enum: ['LONG', 'SHORT'] }).notNull(),
  status: text('status', { enum: ['OPEN', 'CLOSED', 'LIQUIDATED'] }).notNull().default('OPEN'),
  leverage: text('leverage').notNull().default('1'),
  marginType: text('margin_type', { enum: ['ISOLATED', 'CROSS'] }).notNull().default('ISOLATED'),
  marginAmount: text('margin_amount').notNull(),
  entryPrice: text('entry_price').notNull(),
  stopLoss: text('stop_loss'), // MT5 SL
  takeProfit: text('take_profit'), // MT5 TP
  liquidationPrice: text('liquidation_price').notNull(),
  amount: text('amount').notNull(), // volume
  swap: text('swap').notNull().default('0'), // accumulated swap
  commission: text('commission').notNull().default('0'),
  realizedPnl: text('realized_pnl').notNull().default('0'),
  orderId: text('order_id'), // FK to orders.id (defined via migration, not schema to avoid circular type)
  closedAt: integer('closed_at', { mode: 'timestamp' }),
  closePrice: text('close_price'),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull(),
  updatedAt: integer('updated_at', { mode: 'timestamp' }).notNull(),
});

export const trades = sqliteTable('trades', {
  id: text('id').primaryKey(),
  displayId: text('display_id').unique(),
  marketSymbol: text('market_symbol').notNull().references(() => markets.symbol),
  buyOrderId: text('buy_order_id').notNull(),
  sellOrderId: text('sell_order_id').notNull(),
  buyUserId: text('buy_user_id').notNull().references(() => users.id),
  sellUserId: text('sell_user_id').notNull().references(() => users.id),
  price: text('price').notNull(),
  amount: text('amount').notNull(),
  quoteAmount: text('quote_amount').notNull(), // price * amount
  buyFee: text('buy_fee').notNull(),
  sellFee: text('sell_fee').notNull(),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull(),
});

export const binaryOptions = sqliteTable('binary_options', {
  id: text('id').primaryKey(),
  displayId: text('display_id').unique(),
  userId: text('user_id').notNull().references(() => users.id),
  marketSymbol: text('market_symbol').notNull().references(() => markets.symbol),
  direction: text('direction', { enum: ['UP', 'DOWN'] }).notNull(),
  amount: text('amount').notNull(),
  entryPrice: text('entry_price').notNull(),
  settlePrice: text('settle_price'),
  status: text('status', { enum: ['PENDING', 'WON', 'LOST', 'TIE'] }).notNull().default('PENDING'),
  payoutMultiplier: text('payout_multiplier').notNull().default('1.8'),
  expiresAt: integer('expires_at', { mode: 'timestamp' }).notNull(),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull(),
  updatedAt: integer('updated_at', { mode: 'timestamp' }).notNull(),
});
