"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

/** Agrega una nota de seguimiento a un pendiente desde el dashboard de admin. */
export async function addFollowupNoteAdmin(followupId: string, note: string) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { error } = await supabase.from("followup_notes").insert({
    followup_id: followupId,
    note,
    created_by: user?.id ?? null,
  });
  if (error) throw error;

  revalidatePath("/dashboard");
}

/** Marca un pendiente como resuelto desde el dashboard de admin. */
export async function resolveFollowupAdmin(followupId: string) {
  const supabase = await createClient();
  const { error } = await supabase.from("followups").update({ status: "resuelto" }).eq("id", followupId);
  if (error) throw error;
  revalidatePath("/dashboard");
}
