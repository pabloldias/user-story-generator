import * as React from "react";

import { cn } from "@/lib/utils";

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {}

const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, type, ...props }, ref) => {
    return (
      <input
        type={type}
        className={cn(
          // Base
          "flex h-10 w-full rounded-md border bg-background px-3 py-2 text-sm font-sans",
          // Border uses brand ring on focus
          "border-input ring-offset-background",
          "placeholder:text-muted-foreground",
          // Focus — Neon Mint ring
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-neon-mint focus-visible:ring-offset-2",
          // File input reset
          "file:border-0 file:bg-transparent file:text-sm file:font-medium",
          // Disabled
          "disabled:cursor-not-allowed disabled:opacity-50",
          className,
        )}
        ref={ref}
        {...props}
      />
    );
  },
);
Input.displayName = "Input";

export { Input };
