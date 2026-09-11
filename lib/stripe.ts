import Stripe from 'stripe';

let stripe: Stripe | null = null;

export function getStripe(): Stripe {
  if (!process.env.STRIPE_SECRET_KEY) throw new Error('STRIPE_SECRET_KEY no está configurado');
  stripe ??= new Stripe(process.env.STRIPE_SECRET_KEY);
  return stripe;
}

export function getAppUrl(): string {
  return process.env.NEXTAUTH_URL || 'http://localhost:3000';
}
