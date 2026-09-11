import { hash } from 'bcryptjs';
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { hashToken } from '@/lib/tokens';

export async function POST(request: Request) {
  if (!prisma) return NextResponse.json({ error: 'Base de datos no disponible' }, { status: 503 });

  const body = await request.json().catch(() => null);
  const rawToken = typeof body?.token === 'string' ? body.token : '';
  const password = typeof body?.password === 'string' ? body.password : '';

  if (!rawToken || password.length < 8) {
    return NextResponse.json({ error: 'Token válido y contraseña de al menos 8 caracteres son requeridos' }, { status: 400 });
  }

  const record = await prisma.passwordResetToken.findUnique({
    where: { token: hashToken(rawToken) },
  });

  if (!record || record.expiresAt < new Date()) {
    return NextResponse.json({ error: 'Token inválido o expirado' }, { status: 400 });
  }

  await prisma.$transaction([
    prisma.user.update({ where: { email: record.email }, data: { passwordHash: await hash(password, 12) } }),
    prisma.passwordResetToken.delete({ where: { id: record.id } }),
  ]);

  return NextResponse.json({ success: true, message: 'Contraseña actualizada correctamente' });
}
