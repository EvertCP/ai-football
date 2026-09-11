import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { hashToken } from '@/lib/tokens';

export async function GET(request: Request) {
  if (!prisma) return NextResponse.json({ error: 'Base de datos no disponible' }, { status: 503 });

  const { searchParams } = new URL(request.url);
  const rawToken = searchParams.get('token');
  if (!rawToken) return NextResponse.json({ error: 'Token requerido' }, { status: 400 });

  const record = await prisma.emailVerificationToken.findUnique({
    where: { token: hashToken(rawToken) },
  });

  if (!record || record.expiresAt < new Date()) {
    return NextResponse.json({ error: 'Token inválido o expirado' }, { status: 400 });
  }

  await prisma.$transaction([
    prisma.user.update({ where: { email: record.email }, data: { emailVerified: new Date() } }),
    prisma.emailVerificationToken.delete({ where: { id: record.id } }),
  ]);

  return NextResponse.json({ success: true, message: 'Correo verificado correctamente' });
}
