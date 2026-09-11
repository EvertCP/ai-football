import { hash } from 'bcryptjs';
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { sendVerificationEmail } from '@/lib/email';
import { createToken, hashToken } from '@/lib/tokens';
import { rateLimitIp } from '@/lib/rate-limit';

export async function POST(request: Request) {
  const limit = rateLimitIp(request, 5, 60 * 60 * 1000);
  if (!limit.success) return NextResponse.json({ error: 'Demasiados intentos. Intenta más tarde.' }, { status: 429 });

  if (!prisma) return NextResponse.json({ error: 'Base de datos no disponible' }, { status: 503 });

  const body = await request.json().catch(() => null);
  const name = typeof body?.name === 'string' ? body.name.trim() : '';
  const email = typeof body?.email === 'string' ? body.email.trim().toLowerCase() : '';
  const password = typeof body?.password === 'string' ? body.password : '';

  if (!name || !/^\S+@\S+\.\S+$/.test(email) || password.length < 8) {
    return NextResponse.json({ error: 'Nombre, email válido y contraseña de al menos 8 caracteres son requeridos' }, { status: 400 });
  }

  const existingUser = await prisma.user.findUnique({ where: { email } });
  if (existingUser) return NextResponse.json({ error: 'El email ya está registrado' }, { status: 409 });

  const user = await prisma.user.create({
    data: { name, email, passwordHash: await hash(password, 12) },
    select: { id: true, name: true, email: true, role: true },
  });

  const rawToken = createToken();
  const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);
  await prisma.emailVerificationToken.upsert({
    where: { email },
    update: { token: hashToken(rawToken), expiresAt },
    create: { email, token: hashToken(rawToken), expiresAt },
  });

  try {
    await sendVerificationEmail(email, rawToken);
  } catch (error) {
    console.error('[Auth] Failed to send verification email:', error);
  }

  return NextResponse.json({ data: { ...user, requiresVerification: true } }, { status: 201 });
}
