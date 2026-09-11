import { getServerSession } from 'next-auth';
import { NextResponse } from 'next/server';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { getAppUrl, getStripe } from '@/lib/stripe';

export async function POST() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
  if (!prisma) return NextResponse.json({ error: 'Base de datos no disponible' }, { status: 503 });

  const user = await prisma.user.findUnique({ where: { id: session.user.id } });
  if (!user?.stripeCustomerId) return NextResponse.json({ error: 'La cuenta no tiene una suscripción de Stripe' }, { status: 404 });

  const portal = await getStripe().billingPortal.sessions.create({
    customer: user.stripeCustomerId,
    return_url: `${getAppUrl()}/account`,
  });

  return NextResponse.json({ url: portal.url });
}
