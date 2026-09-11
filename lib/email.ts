import { getFromEmail, getResend } from './resend';

export async function sendVerificationEmail(email: string, token: string) {
  const resend = getResend();
  const url = `${process.env.NEXTAUTH_URL}/verify-email?token=${token}`;

  await resend.emails.send({
    from: getFromEmail(),
    to: email,
    subject: 'Verifica tu correo en FootballAI',
    html: `
      <p>Hola,</p>
      <p>Para completar tu registro, confirma tu correo haciendo clic en el siguiente enlace:</p>
      <p><a href="${url}">${url}</a></p>
      <p>Si no solicitaste este registro, ignora este mensaje.</p>
    `,
  });
}

export async function sendPasswordResetEmail(email: string, token: string) {
  const resend = getResend();
  const url = `${process.env.NEXTAUTH_URL}/reset-password?token=${token}`;

  await resend.emails.send({
    from: getFromEmail(),
    to: email,
    subject: 'Restablece tu contraseña en FootballAI',
    html: `
      <p>Hola,</p>
      <p>Solicitaste restablecer tu contraseña. Haz clic en el siguiente enlace:</p>
      <p><a href="${url}">${url}</a></p>
      <p>Este enlace expira en 1 hora. Si no solicitaste el cambio, ignora este mensaje.</p>
    `,
  });
}
