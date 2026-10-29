import { Suspense } from 'react';
import { UUIDSchema } from '@snagflow/shared';
import { InvitationForm } from '@/components/invitation-form';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';

export const metadata = { title: 'Accept invitation', referrer: 'no-referrer' };
async function Invitation({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  return (
    <main className="mx-auto min-h-screen w-full max-w-xl px-4 py-10 sm:py-16">
      <h1 className="mb-6 text-3xl font-semibold">Accept invitation</h1>
      <Card>
        <CardHeader>
          <CardTitle>Welcome to SnagFlow</CardTitle>
          <CardDescription>Set up your account and join your project team.</CardDescription>
        </CardHeader>
        <CardContent>
          {UUIDSchema.safeParse(token).success ? (
            <InvitationForm token={token} />
          ) : (
            <p>This invitation is unavailable, expired, or belongs to another account.</p>
          )}
        </CardContent>
      </Card>
    </main>
  );
}
export default function InvitePage({ params }: { params: Promise<{ token: string }> }) {
  return (
    <Suspense fallback={<p className="p-6">Loading invitation…</p>}>
      <Invitation params={params} />
    </Suspense>
  );
}
