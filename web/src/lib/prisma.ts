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

    // Handle $transaction seamlessly across both Node.js and Cloudflare D1
    if (prop === '$transaction') {
      return async (arg: any, options?: any) => {
        if (typeof arg === 'function') {
          // Check if running in Cloudflare D1 environment
          let isCloudflareD1 = false
          try {
            const cf = getCloudflareContext({ async: false })
            isCloudflareD1 = Boolean((cf as any)?.env?.DB)
          } catch {
            isCloudflareD1 = false
          }

          // Cloudflare D1 does not support interactive transactions ($transaction(async tx => ...)).
          // If on Cloudflare D1, execute callback directly with prisma proxy as tx.
          if (isCloudflareD1) {
            return await arg(prisma)
          }

          // In Node.js / non-D1 environments, attempt native $transaction with seamless D1 fallback
          try {
            return await instance.$transaction(arg, options)
          } catch (err: any) {
            if (
              err?.message?.includes('Cloudflare D1') ||
              err?.message?.includes('interactive transactions')
            ) {
              return await arg(prisma)
            }
            throw err
          }
        }

        // Batch transactions: prisma.$transaction([...])
        if (Array.isArray(arg)) {
          try {
            return await instance.$transaction(arg, options)
          } catch (err: any) {
            if (
              err?.message?.includes('Cloudflare D1') ||
              err?.message?.includes('interactive transactions')
            ) {
              const results = []
              for (const item of arg) {
                results.push(await item)
              }
              return results
            }
            throw err
          }
        }

        return instance.$transaction(arg, options)
      }
    }

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
export type DBTrackingConfig = any;
export type DBMarketWhereInput = Prisma.MarketWhereInput;
export type DBMarketUpdateInput = Prisma.MarketUpdateInput;
