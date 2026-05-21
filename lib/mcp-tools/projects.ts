import { z } from "zod";
import { createClient } from "@supabase/supabase-js";

function getAdminClient() {
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SECRET_KEY!);
}

export const listProjectsSchema = z.object({});
export const getProjectSchema = z.object({
  project_id: z.string().uuid().describe("UUID of the project"),
});
export const createProjectSchema = z.object({
  name: z.string().min(1).max(200).describe("Project name"),
  description: z.string().max(2000).optional().describe("Optional description"),
  user_id: z.string().uuid().describe("UUID of the owner user"),
});

export async function listProjects(_args: z.infer<typeof listProjectsSchema>) {
  const { data, error } = await getAdminClient()
    .from("projects")
    .select("*")
    .order("created_at", { ascending: false });
  if (error) throw new Error(error.message);
  return data;
}

export async function getProject(args: z.infer<typeof getProjectSchema>) {
  const { data, error } = await getAdminClient()
    .from("projects")
    .select("*")
    .eq("id", args.project_id)
    .single();
  if (error) throw new Error(error.message);
  return data;
}

export async function createProject(args: z.infer<typeof createProjectSchema>) {
  const { data, error } = await getAdminClient()
    .from("projects")
    .insert({ name: args.name, description: args.description ?? null, user_id: args.user_id })
    .select()
    .single();
  if (error) throw new Error(error.message);
  return data;
}
