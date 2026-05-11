import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const badgeVariants = cva(
  "inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold transition-colors",
  {
    variants: {
      variant: {
        default: "bg-[rgb(var(--primary)/0.12)] text-[rgb(var(--primary))]",
        secondary: "bg-[rgb(var(--secondary)/0.12)] text-[rgb(var(--secondary))]",
        success: "bg-[rgb(var(--success)/0.12)] text-[rgb(var(--success))]",
        warning: "bg-[rgb(var(--warning)/0.12)] text-[rgb(var(--warning))]",
        destructive: "bg-[rgb(var(--destructive)/0.12)] text-[rgb(var(--destructive))]",
        outline: "border border-[rgb(var(--border))] text-[rgb(var(--muted-foreground))]",
        band: "bg-[rgb(var(--band-high)/0.12)] text-[rgb(var(--band-high))] font-mono",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
);

export interface BadgeProps
  extends React.HTMLAttributes<HTMLSpanElement>,
    VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, ...props }: BadgeProps) {
  return (
    <span className={cn(badgeVariants({ variant }), className)} {...props} />
  );
}

export { Badge, badgeVariants };
