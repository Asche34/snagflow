import { Suspense } from "react";
import { LoginPanel } from "./login-panel";

export const metadata = {
  title: "Sign in",
};

export default function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  return (
    <main className="flex min-h-screen items-center justify-center bg-background p-6">
      <Suspense fallback={<div className="h-80 w-full max-w-sm animate-pulse rounded-xl bg-muted" />}>
        <LoginPanel searchParams={searchParams} />
      </Suspense>
    </main>
  );
}
