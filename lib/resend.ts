import { Resend } from 'resend';

export function getResend(): Resend {
  if (!process.env.RESEND_API_KEY) throw new Error('RESEND_API_KEY no está configurado');
  return new Resend(process.env.RESEND_API_KEY);
}

export function getFromEmail(): string {
  return process.env.FROM_EMAIL || 'no-reply@example.com';
}
