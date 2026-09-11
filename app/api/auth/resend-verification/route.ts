import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { sendVerificationEmail } from '@/lib/email';
import { createToken, hashToken } from '@/lib/tokens';
import { rateLimitIp } from '@/lib/rate-limit';

export async function POST(request: Request) {
  const limit = rateLimitIp(request, 3, 60 * 60 * 1000);
  if (!limit.success) return NextResponse.json({ error: 'Demasiados intentos. Intenta más tarde.' }, { status: 429 });

  if (!prisma) return NextResponse.json({ error: 'Base de datos no disponible' }, { status: 503 });

  const body = await request.json().catch(() => null);
  const email = typeof body?.email === 'string' ? body.email.trim().toLowerCase() : '';
  if (!email) return NextResponse.json({ error: 'Email requerido' }, { status: 400 });

  const user = await prisma.user.findUnique({ where: { email } });
  if (!user) return NextResponse.json({ success: true }, { status: 200 });
  if (user.emailVerified) return NextResponse.json({ error: 'El correo ya está verificado' }, { status: 409 });

  const rawToken = createToken();
  const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);

  await prisma.emailVerificationToken.upsert({
    where: { email },
    update: { token: hashToken(rawToken), expiresAt },
    create: { email, token: hashToken(rawToken), expiresAt },
  });

  try {
    await sendVerificationEmail(email, rawToken);
  } catch {
    return NextResponse.json({ error: 'No se pudo enviar el correo' }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
