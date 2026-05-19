"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { AlertTriangle, ArrowRight, Loader2, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import type { GenerateResponse } from "@/types";

const schema = z.object({
  raw_input: z
    .string()
    .min(10, "Please enter at least 10 characters.")
    .max(10_000, "Input must be 10 000 characters or less."),
});

type FormValues = z.infer<typeof schema>;

interface RequirementInputProps {
  projectId: string;
}

export function RequirementInput({ projectId }: RequirementInputProps) {
  const router = useRouter();
  const [serverError, setServerError] = useState<string | null>(null);
  const [pendingRedirect, setPendingRedirect] = useState<{
    requirementId: string;
    warnings: string[];
  } | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
    watch,
  } = useForm<FormValues>({ resolver: zodResolver(schema) });

  const charCount = watch("raw_input")?.length ?? 0;

  async function onSubmit(values: FormValues) {
    setServerError(null);
    setPendingRedirect(null);

    const res = await fetch("/api/generate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ project_id: projectId, raw_input: values.raw_input }),
    });

    if (!res.ok) {
      const data = (await res.json()) as { error?: string };
      setServerError(data.error ?? `Error ${res.status}`);
      return;
    }

    const data = (await res.json()) as GenerateResponse;

    // If the pipeline returned guardrail warnings, show them before redirecting
    if (data.warnings && data.warnings.length > 0) {
      setPendingRedirect({ requirementId: data.requirement_id, warnings: data.warnings });
      return;
    }

    router.push(`/requirements/${data.requirement_id}`);
    router.refresh();
  }

  function handleViewStories() {
    if (pendingRedirect) {
      router.push(`/requirements/${pendingRedirect.requirementId}`);
      router.refresh();
    }
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4">
      {serverError && (
        <p className="text-sm text-destructive rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2">
          {serverError}
        </p>
      )}

      {/* Guardrail warning banner — shown when the pipeline succeeds but flags issues */}
      {pendingRedirect && (
        <div className="rounded-md border border-amber-200 bg-amber-50 p-4 flex flex-col gap-3">
          <div className="flex items-start gap-2">
            <AlertTriangle className="h-4 w-4 text-amber-600 mt-0.5 shrink-0" />
            <div className="flex flex-col gap-1">
              <p className="text-sm font-semibold text-amber-800">
                Stories generated with warnings
              </p>
              <p className="text-xs text-amber-700">
                The AI pipeline completed but flagged the following issues. Review the stories
                before approving.
              </p>
            </div>
          </div>
          <ul className="flex flex-col gap-1 pl-6">
            {pendingRedirect.warnings.map((w, i) => (
              <li key={i} className="text-xs text-amber-700">
                • {w}
              </li>
            ))}
          </ul>
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={handleViewStories}
            className="gap-1.5 w-fit border-amber-300 text-amber-800 hover:bg-amber-100"
          >
            View Stories
            <ArrowRight className="h-3.5 w-3.5" />
          </Button>
        </div>
      )}

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="raw_input" className="text-sm font-medium">
          Business Requirement
        </Label>
        <Textarea
          id="raw_input"
          rows={10}
          placeholder="Paste or type your unstructured business requirement here…

Example:
As a retail bank customer I need to reset my password from the mobile app without calling support. The new password must meet security requirements and I should receive a confirmation email."
          className="resize-y text-sm leading-relaxed"
          disabled={isSubmitting}
          {...register("raw_input")}
        />
        <div className="flex items-start justify-between gap-2">
          {errors.raw_input ? (
            <p className="text-xs text-destructive">{errors.raw_input.message}</p>
          ) : (
            <span />
          )}
          <span className="text-xs text-muted-foreground shrink-0">
            {charCount.toLocaleString()} / 10 000
          </span>
        </div>
      </div>

      <div className="flex items-center gap-3">
        <Button type="submit" disabled={isSubmitting} className="gap-2">
          {isSubmitting ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              Generating stories…
            </>
          ) : (
            <>
              <Sparkles className="h-4 w-4" />
              Generate User Stories
            </>
          )}
        </Button>

        {isSubmitting && (
          <p className="text-xs text-muted-foreground">
            Running AI pipeline — this may take 15–30 seconds.
          </p>
        )}
      </div>
    </form>
  );
}
