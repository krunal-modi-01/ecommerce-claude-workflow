import Stripe from 'stripe'

// ---------------------------------------------------------------------------
// Domain error types (spec: stripe-adapter.md § Error Cases)
// ---------------------------------------------------------------------------

export class WebhookSignatureError extends Error {
  constructor(message = 'Invalid Stripe webhook signature') {
    super(message)
    this.name = 'WebhookSignatureError'
  }
}

export class StripeAdapterError extends Error {
  constructor(
    message: string,
    readonly cause?: unknown,
  ) {
    super(message)
    this.name = 'StripeAdapterError'
  }
}

export class ValueError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'ValueError'
  }
}

export type StripeEvent = Stripe.Event

// ---------------------------------------------------------------------------
// Singleton client (lazy — only initialised on first call)
// ---------------------------------------------------------------------------

let _client: Stripe | null = null

function stripeClient(): Stripe {
  if (!_client) {
    const key = process.env.STRIPE_SECRET_KEY
    if (!key) throw new StripeAdapterError('STRIPE_SECRET_KEY is not set')
    _client = new Stripe(key)
  }
  return _client
}

// Wraps Stripe SDK calls: re-throws domain errors unchanged, wraps everything
// else in StripeAdapterError so callers never see raw Stripe SDK errors.
async function wrap<T>(fn: () => Promise<T>): Promise<T> {
  try {
    return await fn()
  } catch (err) {
    if (
      err instanceof WebhookSignatureError ||
      err instanceof ValueError ||
      err instanceof StripeAdapterError
    ) {
      throw err
    }
    const message = err instanceof Error ? err.message : String(err)
    throw new StripeAdapterError(message, err)
  }
}

function assertPositiveInt(amountCents: number, field = 'amountCents'): void {
  if (!Number.isInteger(amountCents) || amountCents <= 0) {
    throw new ValueError(`${field} must be a positive integer, got ${amountCents}`)
  }
}

// ---------------------------------------------------------------------------
// Public interface
// ---------------------------------------------------------------------------

/**
 * Creates a Stripe Connect Express account and returns its ID.
 * Called once during seller registration. identity stores the ID on the User row.
 */
export async function createConnectAccount(): Promise<{ stripeAccountId: string }> {
  return wrap(async () => {
    const account = await stripeClient().accounts.create({ type: 'express' })
    return { stripeAccountId: account.id }
  })
}

/**
 * Creates a Stripe Account Link (one-time URL) for onboarding an Express account.
 * The seller must be redirected to this URL immediately — it expires quickly.
 */
export async function createConnectOnboardingUrl(
  stripeAccountId: string,
  returnUrl: string,
  refreshUrl: string,
): Promise<string> {
  return wrap(async () => {
    const link = await stripeClient().accountLinks.create({
      account: stripeAccountId,
      return_url: returnUrl,
      refresh_url: refreshUrl,
      type: 'account_onboarding',
    })
    return link.url
  })
}

/**
 * Returns whether the connected account can accept charges (onboarding complete).
 */
export async function getConnectAccountStatus(
  stripeAccountId: string,
): Promise<{ chargesEnabled: boolean }> {
  return wrap(async () => {
    const account = await stripeClient().accounts.retrieve(stripeAccountId)
    return { chargesEnabled: account.charges_enabled }
  })
}

/**
 * Creates a Payment Intent on the platform, with automatic transfer to the
 * connected seller account upon payment completion (destination charge).
 */
export async function createPaymentIntent(
  amountCents: number,
  currency: string,
  connectedAccountId: string,
): Promise<{ paymentIntentId: string; clientSecret: string }> {
  assertPositiveInt(amountCents)
  return wrap(async () => {
    const intent = await stripeClient().paymentIntents.create({
      amount: amountCents,
      currency: currency.toLowerCase(),
      transfer_data: { destination: connectedAccountId },
    })
    if (!intent.client_secret) {
      throw new StripeAdapterError('PaymentIntent was created without a client_secret')
    }
    return { paymentIntentId: intent.id, clientSecret: intent.client_secret }
  })
}

/**
 * Verifies the Stripe-Signature header against the raw request body.
 * Returns the parsed Stripe event on success.
 * Throws WebhookSignatureError if the signature is invalid or the secret is missing.
 */
export function verifyWebhookSignature(
  rawBody: Buffer,
  stripeSignatureHeader: string,
): StripeEvent {
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET
  if (!webhookSecret) throw new StripeAdapterError('STRIPE_WEBHOOK_SECRET is not set')
  try {
    return stripeClient().webhooks.constructEvent(rawBody, stripeSignatureHeader, webhookSecret)
  } catch (err) {
    if (err instanceof Stripe.errors.StripeSignatureVerificationError) {
      throw new WebhookSignatureError()
    }
    throw new StripeAdapterError(err instanceof Error ? err.message : String(err), err)
  }
}

/**
 * Transfers funds from the platform to the seller's connected account.
 * Uses the charge from the source PaymentIntent as the source_transaction
 * so the transfer is linked to the original payment in Stripe's dashboard.
 */
export async function createTransfer(
  amountCents: number,
  connectedAccountId: string,
  sourcePaymentIntentId: string,
): Promise<void> {
  assertPositiveInt(amountCents)
  await wrap(async () => {
    // Retrieve the charge ID from the payment intent (needed for source_transaction)
    const intent = await stripeClient().paymentIntents.retrieve(sourcePaymentIntentId)
    const latestCharge = intent.latest_charge
    const chargeId = typeof latestCharge === 'string' ? latestCharge : latestCharge?.id

    await stripeClient().transfers.create({
      amount: amountCents,
      currency: 'usd',
      destination: connectedAccountId,
      ...(chargeId ? { source_transaction: chargeId } : {}),
    })
  })
}
