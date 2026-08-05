"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export async function login(formData: FormData) {
  const email = String(formData.get("email") ?? "");
  const password = String(formData.get("password") ?? "");

  const supabase = await createClient();
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });

  if (error || !data.user) {
    redirect("/login?error=1");
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("role, branch_id, branches(code)")
    .eq("id", data.user!.id)
    .single();

  if (profile?.role === "admin") {
    redirect("/dashboard");
  }

  const branchCode = (profile as unknown as { branches: { code: string } | null })?.branches?.code;
  redirect(branchCode ? `/sucursal/${branchCode}` : "/login?error=2");
}
