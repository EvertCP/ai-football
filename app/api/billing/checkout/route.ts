import { getServerSession } from 'next-auth';
import { NextResponse } from 'next/server';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { getAppUrl, getStripe } from '@/lib/stripe';

export async function POST() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
  if (!prisma) return NextResponse.json({ error: 'Base de datos no disponible' }, { status: 503 });
  if (!process.env.STRIPE_PRICE_ID) return NextResponse.json({ error: 'STRIPE_PRICE_ID no está configurado' }, { status: 503 });

  const user = await prisma.user.findUnique({ where: { id: session.user.id } });
  if (!user) return NextResponse.json({ error: 'Usuario no encontrado' }, { status: 404 });
  if (user.role === 'PRO' || user.role === 'ADMIN') return NextResponse.json({ error: 'La cuenta ya tiene acceso PRO' }, { status: 409 });

  const stripe = getStripe();
  let customerId = user.stripeCustomerId;
  if (!customerId) {
    const customer = await stripe.customers.create({ email: user.email, name: user.name || undefined, metadata: { userId: user.id } });
    customerId = customer.id;
    await prisma.user.update({ where: { id: user.id }, data: { stripeCustomerId: customerId } });
  }

  const checkout = await stripe.checkout.sessions.create({
    mode: 'subscription',
    customer: customerId,
    line_items: [{ price: process.env.STRIPE_PRICE_ID, quantity: 1 }],
    subscription_data: { trial_period_days: 7, metadata: { userId: user.id } },
    success_url: `${getAppUrl()}/account?checkout=success`,
    cancel_url: `${getAppUrl()}/account?checkout=cancelled`,
    allow_promotion_codes: true,
  });

  return NextResponse.json({ url: checkout.url });
}
