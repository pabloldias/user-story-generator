import { z } from "zod";
import { createClient } from "@supabase/supabase-js";

function getAdminClient() {
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SECRET_KEY!);
}

export const listRequirementsSchema = z.object({
  project_id: z.string().uuid().optional().describe("Filter by project UUID"),
  status: z
    .enum(["pending", "processing", "completed", "failed"])
    .optional()
    .describe("Filter by status"),
});

export const getRequirementSchema = z.object({
  requirement_id: z.string().uuid().describe("UUID of the requirement"),
});

export async function listRequirements(args: z.infer<typeof listRequirementsSchema>) {
  let query = getAdminClient()
    .from("requirements")
    .select("*")
    .order("created_at", { ascending: false });
  if (args.project_id) query = query.eq("project_id", args.project_id);
  if (args.status) query = query.eq("status", args.status);
  const { data, error } = await query;
  if (error) throw new Error(error.message);
  return data;
}

export async function getRequirement(args: z.infer<typeof getRequirementSchema>) {
  const { data, error } = await getAdminClient()
    .from("requirements")
    .select("*")
    .eq("id", args.requirement_id)
    .single();
  if (error) throw new Error(error.message);
  return data;
}
