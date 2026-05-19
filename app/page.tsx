import { redirect } from "next/navigation";

// Root "/" redirects to the dashboard (protected route, handled by middleware + (app) layout)
export default function RootPage() {
  redirect("/dashboard");
}
