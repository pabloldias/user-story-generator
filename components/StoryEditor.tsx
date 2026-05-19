"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Loader2, Save } from "lucide-react";
import { createClient } from "@/lib/supabase";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import type { UserStory } from "@/types";

const schema = z.object({
  title: z.string().min(1, "Title is required."),
  story_body: z.string().min(1, "Story body is required."),
  acceptance_criteria: z.string().min(1, "Acceptance criteria are required."),
});

type FormValues = z.infer<typeof schema>;

interface StoryEditorProps {
  story: UserStory;
  onSaved?: (updated: Partial<UserStory>) => void;
}

export function StoryEditor({ story, onSaved }: StoryEditorProps) {
  const router = useRouter();
  const [serverError, setServerError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting, isDirty },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      title: story.title,
      story_body: story.story_body,
      acceptance_criteria: story.acceptance_criteria,
    },
  });

  async function onSubmit(values: FormValues) {
    setServerError(null);
    setSaved(false);
    const supabase = createClient();

    const { error } = await supabase
      .from("user_stories")
      .update({
        title: values.title,
        story_body: values.story_body,
        acceptance_criteria: values.acceptance_criteria,
        updated_at: new Date().toISOString(),
      })
      .eq("id", story.id);

    if (error) {
      setServerError(error.message);
      return;
    }

    setSaved(true);
    onSaved?.(values);
    router.refresh();
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4">
      {serverError && (
        <p className="text-sm text-destructive rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2">
          {serverError}
        </p>
      )}
      {saved && (
        <p className="text-sm text-emerald-700 rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2">
          Story saved successfully.
        </p>
      )}

      <div className="space-y-1.5">
        <Label htmlFor="title">Title</Label>
        <Input id="title" {...register("title")} />
        {errors.title && <p className="text-xs text-destructive">{errors.title.message}</p>}
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="story_body">Story Body</Label>
        <Textarea id="story_body" rows={5} className="resize-y" {...register("story_body")} />
        {errors.story_body && (
          <p className="text-xs text-destructive">{errors.story_body.message}</p>
        )}
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="acceptance_criteria">Acceptance Criteria</Label>
        <Textarea
          id="acceptance_criteria"
          rows={6}
          className="resize-y font-mono text-xs"
          {...register("acceptance_criteria")}
        />
        {errors.acceptance_criteria && (
          <p className="text-xs text-destructive">{errors.acceptance_criteria.message}</p>
        )}
      </div>

      <div>
        <Button type="submit" size="sm" disabled={isSubmitting || !isDirty} className="gap-2">
          {isSubmitting ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <Save className="h-3.5 w-3.5" />
          )}
          Save Changes
        </Button>
      </div>
    </form>
  );
}
