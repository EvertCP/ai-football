import type Stripe from 'stripe';
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getStripe } from '@/lib/stripe';

export const dynamic = 'force-dynamic';

function customerId(subscription: Stripe.Subscription): string {
  return typeof subscription.customer === 'string' ? subscription.customer : subscription.customer.id;
}

async function syncSubscription(subscription: Stripe.Subscription) {
  if (!prisma) throw new Error('Base de datos no disponible');
  const active = subscription.status === 'active' || subscription.status === 'trialing';
  const periodEnd = subscription.items.data[0]?.current_period_end;
  const user = await prisma.user.findUnique({ where: { stripeCustomerId: customerId(subscription) } });
  if (!user) return;

  await prisma.user.update({
    where: { id: user.id },
    data: {
      stripeSubscriptionId: subscription.id,
      subscriptionStatus: subscription.status,
      subscriptionEndsAt: periodEnd ? new Date(periodEnd * 1000) : null,
      role: user.role === 'ADMIN' ? 'ADMIN' : active ? 'PRO' : 'USER',
    },
  });
}

export async function POST(request: Request) {
  if (!process.env.STRIPE_WEBHOOK_SECRET) return NextResponse.json({ error: 'Webhook no configurado' }, { status: 503 });

  const body = await request.text();
  const signature = request.headers.get('stripe-signature');
  if (!signature) return NextResponse.json({ error: 'Firma ausente' }, { status: 400 });

  let event: Stripe.Event;
  try {
    event = getStripe().webhooks.constructEvent(body, signature, process.env.STRIPE_WEBHOOK_SECRET);
  } catch {
    return NextResponse.json({ error: 'Firma inválida' }, { status: 400 });
  }

  if (event.type === 'customer.subscription.created' || event.type === 'customer.subscription.updated' || event.type === 'customer.subscription.deleted') {
    await syncSubscription(event.data.object);
  }

  return NextResponse.json({ received: true });
}
