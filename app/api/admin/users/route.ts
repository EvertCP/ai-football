import { getServerSession } from 'next-auth';
import { NextResponse } from 'next/server';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

export async function GET() {
  const session = await getServerSession(authOptions);
  if (session?.user.role !== 'ADMIN') return NextResponse.json({ error: 'Acceso denegado' }, { status: 403 });
  if (!prisma) return NextResponse.json({ error: 'Base de datos no disponible' }, { status: 503 });

  const users = await prisma.user.findMany({
    orderBy: { createdAt: 'desc' },
    select: { id: true, name: true, email: true, role: true, emailVerified: true, subscriptionStatus: true, createdAt: true },
  });

  return NextResponse.json({ data: users });
}

export async function PATCH(request: Request) {
  const session = await getServerSession(authOptions);
  if (session?.user.role !== 'ADMIN') return NextResponse.json({ error: 'Acceso denegado' }, { status: 403 });
  if (!prisma) return NextResponse.json({ error: 'Base de datos no disponible' }, { status: 503 });

  const body = await request.json().catch(() => null);
  const userId = typeof body?.userId === 'string' ? body.userId : '';
  const role = typeof body?.role === 'string' ? body.role : '';

  if (!userId || !['USER', 'PRO', 'ADMIN'].includes(role)) {
    return NextResponse.json({ error: 'Datos inválidos' }, { status: 400 });
  }

  const user = await prisma.user.update({ where: { id: userId }, data: { role } });
  return NextResponse.json({ data: user });
}
