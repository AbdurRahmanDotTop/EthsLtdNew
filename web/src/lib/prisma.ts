import { PrismaClient as PrismaClientNode, Prisma } from '@prisma/client'
import { PrismaClient as PrismaClientWasm } from '@prisma/client/wasm'
import { PrismaD1 } from '@prisma/adapter-d1'
import { getCloudflareContext } from '@opennextjs/cloudflare'

let cachedPrisma: PrismaClientNode | null = null

function getPrismaInstance(): PrismaClientNode {
  try {
    const cf = getCloudflareContext({ async: false })
    const dbBinding = (cf as any)?.env?.DB
    if (dbBinding) {
      if (!cachedPrisma) {
        const adapter = new PrismaD1(dbBinding)
        cachedPrisma = new (PrismaClientWasm as any)({ adapter }) as PrismaClientNode
      }
      return cachedPrisma
    }
  } catch {
    // Non-Cloudflare environment (local dev, CLI scripts)
  }

  if (!(globalThis as any).prismaGlobal) {
    ;(globalThis as any).prismaGlobal = new PrismaClientNode()
  }
  return (globalThis as any).prismaGlobal
}

// Resilient typed client that supports newly generated models and custom extensions
export type ExtendedPrismaClient = PrismaClientNode & {
  userCryptoWallet: any;
  [key: string]: any;
};

const prisma = new Proxy({} as ExtendedPrismaClient, {
  get(_target, prop, receiver) {
    const instance = getPrismaInstance() as any
    const val = Reflect.get(instance, prop, receiver)
    if (typeof val === 'function') {
      return val.bind(instance)
    }
    return val
  },
})

export default prisma
export { prisma }

// Resilient transaction client and model types
export type DBClient = any;
export type DBWallet = any;
export type DBEmailConfig = any;
export type DBMarket = any;
export type DBUser = any;
export type DBOrder = any;
export type DBMarketWhereInput = Prisma.MarketWhereInput;
export type DBMarketUpdateInput = Prisma.MarketUpdateInput;
