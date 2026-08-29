import type { FastifyInstance } from 'fastify'
// @ts-ignore — @x402 packages ship ESM-only types incompatible with commonjs moduleResolution
import type { SupportedResponse, SupportedKind } from '@x402/core/types'

/**
 * Signer addresses this facilitator uses to settle payments, per network.
 * Optional — an empty list is valid for a facilitator that has not
 * provisioned signing keys yet ("supported" is pure capability discovery
 * and must not require live keys to answer).
 */
function getSignerAddresses(): string[] {
  const raw = process.env.FACILITATOR_SIGNER_ADDRESSES ?? ''
  return raw
    .split(',')
    .map(addr => addr.trim())
    .filter(Boolean)
}

/**
 * Builds the `exact` scheme's `extra` metadata the same way
 * `@x402/stellar`'s `ExactStellarScheme.getExtra()` does, without requiring
 * a live signer — this route only advertises capabilities, it never signs.
 */
function buildExtra(): Record<string, unknown> {
  return { areFeesSponsored: process.env.FACILITATOR_FEES_SPONSORED !== 'false' }
}

/**
 * `stellar:pubnet` / `stellar:testnet` — the CAIP-2 network ids used
 * throughout @x402/stellar and by facilitator.stellar.org.
 */
const STELLAR_NETWORK_IDS = {
  mainnet: 'stellar:pubnet',
  testnet: 'stellar:testnet',
} as const

/**
 * Registers GET /supported — the facilitator capability-discovery route.
 *
 * This is metadata only: it lists the payment kinds (scheme + network pairs)
 * and extensions this facilitator can verify/settle. It never moves money or
 * touches signing keys, so it is intentionally NOT gated by x402 payment
 * (a facilitator cannot charge for its own capability discovery — clients
 * must be able to call this before they have any payment method configured)
 * and NOT gated by API-key auth (`config.public = true`), matching how
 * facilitator.stellar.org exposes it.
 */
export async function registerFacilitatorRoutes(app: FastifyInstance) {
  app.get('/supported', { config: { public: true } }, async (): Promise<SupportedResponse> => {
    const signers = getSignerAddresses()
    const extra = buildExtra()

    const kinds: SupportedKind[] = (['mainnet', 'testnet'] as const).map(network => ({
      x402Version: 2,
      scheme: 'exact',
      network: STELLAR_NETWORK_IDS[network],
      extra,
    }))

    const response: SupportedResponse = {
      kinds,
      extensions: [],
      signers: signers.length > 0
        ? { 'stellar:*': signers }
        : {},
    }

    return response
  })
}
