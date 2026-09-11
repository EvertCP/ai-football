import { getServerSession } from 'next-auth';
import { redirect } from 'next/navigation';
import BillingActions from '@/components/BillingActions';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

export default async function AccountPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) redirect('/login');
  const user = prisma ? await prisma.user.findUnique({ where: { id: session.user.id } }) : null;
  if (!user) redirect('/login');

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-white">Mi cuenta</h1>
        <p className="mt-1 text-gray-400">Administra tu acceso y suscripción.</p>
      </div>
      <section className="rounded-xl border border-gray-700 bg-[#1a1d2e] p-6">
        <div className="mb-6 flex items-center justify-between">
          <div>
            <p className="text-sm text-gray-400">Plan actual</p>
            <p className="text-xl font-bold text-white">{user.role}</p>
          </div>
          {user.subscriptionStatus && <span className="rounded-full bg-indigo-500/20 px-3 py-1 text-sm text-indigo-300">{user.subscriptionStatus}</span>}
        </div>
        <div className="mb-6 rounded-lg bg-[#0f1117] p-4 text-sm text-gray-300">
          <p>PRO: $299 MXN al mes</p>
          <p>Incluye 7 días de prueba, picks y predicciones de partidos.</p>
          {user.subscriptionEndsAt && <p className="mt-2 text-gray-400">Periodo actual hasta: {user.subscriptionEndsAt.toLocaleDateString('es-MX')}</p>}
        </div>
        <BillingActions hasSubscription={Boolean(user.stripeCustomerId)} role={user.role} />
      </section>
    </div>
  );
}
