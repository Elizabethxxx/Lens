import { describe, it, expect, afterEach } from 'vitest'
import Fastify from 'fastify'
import { registerFacilitatorRoutes } from '../routes/facilitator'

async function buildApp() {
  const app = Fastify({ logger: false })
  await registerFacilitatorRoutes(app)
  await app.ready()
  return app
}

describe('GET /supported', () => {
  afterEach(() => {
    delete process.env.FACILITATOR_SIGNER_ADDRESSES
    delete process.env.FACILITATOR_FEES_SPONSORED
  })

  it('returns 200 with no payment header — capability discovery is never x402-gated', async () => {
    const app = await buildApp()
    const res = await app.inject({ method: 'GET', url: '/supported' })
    expect(res.statusCode).toBe(200)
  })

  it('matches the SupportedResponse shape from @x402/core', async () => {
    const app = await buildApp()
    const res = await app.inject({ method: 'GET', url: '/supported' })
    const body = res.json()

    expect(body).toHaveProperty('kinds')
    expect(body).toHaveProperty('extensions')
    expect(body).toHaveProperty('signers')
    expect(Array.isArray(body.kinds)).toBe(true)
    expect(Array.isArray(body.extensions)).toBe(true)
    expect(typeof body.signers).toBe('object')
  })

  it('advertises the exact scheme for both mainnet and testnet', async () => {
    const app = await buildApp()
    const res = await app.inject({ method: 'GET', url: '/supported' })
    const body = res.json()

    const networks = body.kinds.map((k: any) => k.network)
    expect(networks).toContain('stellar:pubnet')
    expect(networks).toContain('stellar:testnet')
    for (const kind of body.kinds) {
      expect(kind.scheme).toBe('exact')
      expect(kind.x402Version).toBe(2)
    }
  })

  it('includes areFeesSponsored in each kind extra, matching ExactStellarScheme.getExtra()', async () => {
    const app = await buildApp()
    const res = await app.inject({ method: 'GET', url: '/supported' })
    const body = res.json()

    for (const kind of body.kinds) {
      expect(kind.extra).toHaveProperty('areFeesSponsored')
    }
  })

  it('reflects FACILITATOR_FEES_SPONSORED=false in the extra flag', async () => {
    process.env.FACILITATOR_FEES_SPONSORED = 'false'
    const app = await buildApp()
    const res = await app.inject({ method: 'GET', url: '/supported' })
    const body = res.json()

    for (const kind of body.kinds) {
      expect(kind.extra.areFeesSponsored).toBe(false)
    }
  })

  it('returns empty signers map when no signer addresses are configured', async () => {
    const app = await buildApp()
    const res = await app.inject({ method: 'GET', url: '/supported' })
    const body = res.json()

    expect(body.signers).toEqual({})
  })

  it('lists configured signer addresses under the stellar:* wildcard', async () => {
    process.env.FACILITATOR_SIGNER_ADDRESSES = 'GADDR1,GADDR2'
    const app = await buildApp()
    const res = await app.inject({ method: 'GET', url: '/supported' })
    const body = res.json()

    expect(body.signers).toEqual({ 'stellar:*': ['GADDR1', 'GADDR2'] })
  })

  it('does not require an Authorization header (route is public)', async () => {
    const app = await buildApp()
    const res = await app.inject({ method: 'GET', url: '/supported', headers: {} })
    expect(res.statusCode).not.toBe(401)
  })
})
