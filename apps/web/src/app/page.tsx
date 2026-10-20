import { redirect } from "next/navigation";

/** The app lives under /dashboard; the proxy sends anonymous visitors to /login. */
export default function Home() {
  redirect("/dashboard");
}
