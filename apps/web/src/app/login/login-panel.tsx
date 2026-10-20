import { HardHat } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { LoginForm } from "./login-form";

const DEMO_ACCOUNTS = [
  { email: "admin@snagflow.test", role: "Admin" },
  { email: "manager@snagflow.test", role: "Manager" },
  { email: "member1@snagflow.test", role: "Member" },
  { email: "member2@snagflow.test", role: "Member" },
  { email: "viewer@snagflow.test", role: "Viewer" },
];

const showDemoAccounts = process.env.NEXT_PUBLIC_DEMO_ACCOUNTS === "1";

export async function LoginPanel({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  const { next } = await searchParams;

  return (
    <div className="w-full max-w-sm space-y-6">
      <div className="flex items-center gap-3">
        <span className="flex size-10 items-center justify-center rounded-xl bg-primary text-primary-foreground">
          <HardHat className="size-5" aria-hidden />
        </span>
        <div>
          <h1 className="text-xl font-semibold tracking-tight">SnagFlow</h1>
          <p className="text-sm text-muted-foreground">Snag &amp; punch-list tracking</p>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Sign in</CardTitle>
          <CardDescription>Use your work email to access your projects.</CardDescription>
        </CardHeader>
        <CardContent>
          <LoginForm next={next ?? "/dashboard"} />
        </CardContent>
      </Card>

      {showDemoAccounts ? (
        <Card className="gap-3 bg-muted/40 py-4">
          <CardHeader className="px-4">
            <CardTitle className="text-sm">Demo accounts</CardTitle>
            <CardDescription className="text-xs">
              Password <code className="font-mono">Password123!</code> for every account.
            </CardDescription>
          </CardHeader>
          <CardContent className="px-4">
            <ul className="space-y-1 text-xs text-muted-foreground">
              {DEMO_ACCOUNTS.map((account) => (
                <li key={account.email} className="flex items-center justify-between gap-2">
                  <code className="font-mono text-foreground">{account.email}</code>
                  <span>{account.role}</span>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}
