import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export default async function Home() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("role, branches(code)")
    .eq("id", user.id)
    .single();

  if (profile?.role === "admin") redirect("/dashboard");

  const branchCode = (profile as unknown as { branches: { code: string } | null })?.branches?.code;
  redirect(branchCode ? `/sucursal/${branchCode}` : "/login");
}
