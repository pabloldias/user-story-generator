import { Server } from "@modelcontextprotocol/sdk/server/index";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  type CallToolRequest,
} from "@modelcontextprotocol/sdk/types";
import { z } from "zod";

import {
  listProjectsSchema,
  getProjectSchema,
  createProjectSchema,
  listProjects,
  getProject,
  createProject,
} from "./mcp-tools/projects";

import {
  listRequirementsSchema,
  getRequirementSchema,
  listRequirements,
  getRequirement,
} from "./mcp-tools/requirements";

import {
  listStoriesSchema,
  getStorySchema,
  approveStorySchema,
  rejectStorySchema,
  updateStorySchema,
  listStories,
  getStory,
  approveStory,
  rejectStory,
  updateStory,
} from "./mcp-tools/stories";

import {
  generateStoriesSchema,
  regenerateStoriesSchema,
  generateStories,
  regenerateStories,
} from "./mcp-tools/generate";

import {
  exportToJiraSchema,
  listJiraProjectsSchema,
  exportToJira,
  listJiraProjects,
} from "./mcp-tools/jira";

// ─── Tool registry ─────────────────────────────────────────────────────────────

const TOOLS = [
  { name: "list_projects", description: "List all projects.", inputSchema: listProjectsSchema },
  {
    name: "get_project",
    description: "Get a single project by UUID.",
    inputSchema: getProjectSchema,
  },
  {
    name: "create_project",
    description: "Create a new project.",
    inputSchema: createProjectSchema,
  },
  {
    name: "list_requirements",
    description: "List requirements, optionally filtered by project_id and/or status.",
    inputSchema: listRequirementsSchema,
  },
  {
    name: "get_requirement",
    description: "Get a single requirement by UUID.",
    inputSchema: getRequirementSchema,
  },
  {
    name: "list_stories",
    description:
      "List user stories, optionally filtered by requirement_id, status, and/or priority.",
    inputSchema: listStoriesSchema,
  },
  {
    name: "get_story",
    description: "Get a single user story by UUID.",
    inputSchema: getStorySchema,
  },
  { name: "approve_story", description: "Approve a user story.", inputSchema: approveStorySchema },
  {
    name: "reject_story",
    description: "Reject a user story with feedback.",
    inputSchema: rejectStorySchema,
  },
  {
    name: "update_story",
    description: "Update one or more fields of a user story.",
    inputSchema: updateStorySchema,
  },
  {
    name: "generate_stories",
    description: "Run the AI pipeline on raw requirement text to generate 1–5 user stories.",
    inputSchema: generateStoriesSchema,
  },
  {
    name: "regenerate_stories",
    description: "Regenerate stories for an existing requirement using feedback.",
    inputSchema: regenerateStoriesSchema,
  },
  {
    name: "list_jira_projects",
    description: "List available Jira projects.",
    inputSchema: listJiraProjectsSchema,
  },
  {
    name: "export_to_jira",
    description: "Export an approved story to Jira.",
    inputSchema: exportToJiraSchema,
  },
] as const;

// ─── Minimal Zod → JSON Schema converter ──────────────────────────────────────

function zodToJsonSchema(schema: z.ZodTypeAny): Record<string, unknown> {
  if (schema instanceof z.ZodObject) {
    const shape = schema.shape as Record<string, z.ZodTypeAny>;
    const properties: Record<string, unknown> = {};
    const required: string[] = [];
    for (const [key, value] of Object.entries(shape)) {
      properties[key] = zodToJsonSchema(value);
      if (!(value instanceof z.ZodOptional) && !(value instanceof z.ZodDefault)) required.push(key);
    }
    return { type: "object", properties, required };
  }
  if (schema instanceof z.ZodOptional || schema instanceof z.ZodDefault)
    return zodToJsonSchema(schema._def.innerType as z.ZodTypeAny);
  if (schema instanceof z.ZodString) {
    const r: Record<string, unknown> = { type: "string" };
    if (schema.description) r.description = schema.description;
    return r;
  }
  if (schema instanceof z.ZodBoolean) return { type: "boolean" };
  if (schema instanceof z.ZodNumber) return { type: "number" };
  if (schema instanceof z.ZodEnum) return { type: "string", enum: schema.options };
  if (schema instanceof z.ZodUnion)
    return { oneOf: (schema.options as z.ZodTypeAny[]).map(zodToJsonSchema) };
  if (schema instanceof z.ZodLiteral) return { type: typeof schema.value, enum: [schema.value] };
  if (schema instanceof z.ZodArray)
    return { type: "array", items: zodToJsonSchema(schema.element as z.ZodTypeAny) };
  return {};
}

// ─── Factory ───────────────────────────────────────────────────────────────────

export function createMcpServer() {
  const server = new Server(
    { name: "user-story-generator", version: "0.1.0" },
    { capabilities: { tools: {} } },
  );

  server.setRequestHandler(ListToolsRequestSchema, async () => ({
    tools: TOOLS.map((t) => ({
      name: t.name,
      description: t.description,
      inputSchema: zodToJsonSchema(t.inputSchema),
    })),
  }));

  server.setRequestHandler(CallToolRequestSchema, async (request: CallToolRequest) => {
    const { name, arguments: args } = request.params;
    try {
      let result: unknown;
      switch (name) {
        case "list_projects":
          result = await listProjects(listProjectsSchema.parse(args));
          break;
        case "get_project":
          result = await getProject(getProjectSchema.parse(args));
          break;
        case "create_project":
          result = await createProject(createProjectSchema.parse(args));
          break;
        case "list_requirements":
          result = await listRequirements(listRequirementsSchema.parse(args));
          break;
        case "get_requirement":
          result = await getRequirement(getRequirementSchema.parse(args));
          break;
        case "list_stories":
          result = await listStories(listStoriesSchema.parse(args));
          break;
        case "get_story":
          result = await getStory(getStorySchema.parse(args));
          break;
        case "approve_story":
          result = await approveStory(approveStorySchema.parse(args));
          break;
        case "reject_story":
          result = await rejectStory(rejectStorySchema.parse(args));
          break;
        case "update_story":
          result = await updateStory(updateStorySchema.parse(args));
          break;
        case "generate_stories":
          result = await generateStories(generateStoriesSchema.parse(args));
          break;
        case "regenerate_stories":
          result = await regenerateStories(regenerateStoriesSchema.parse(args));
          break;
        case "list_jira_projects":
          result = await listJiraProjects(listJiraProjectsSchema.parse(args));
          break;
        case "export_to_jira":
          result = await exportToJira(exportToJiraSchema.parse(args));
          break;
        default:
          return { content: [{ type: "text", text: `Unknown tool: ${name}` }], isError: true };
      }
      return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
    } catch (err) {
      return {
        content: [
          { type: "text", text: `Error: ${err instanceof Error ? err.message : String(err)}` },
        ],
        isError: true,
      };
    }
  });

  return server;
}
