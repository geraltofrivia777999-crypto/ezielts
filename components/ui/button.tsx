import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-[var(--radius)] text-sm font-semibold transition-all duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[rgb(var(--primary))] focus-visible:ring-offset-2 disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50 cursor-pointer select-none",
  {
    variants: {
      variant: {
        default:
          "bg-[rgb(var(--primary))] text-white shadow-sm shadow-[rgb(var(--primary)/0.18)] hover:bg-[rgb(var(--primary)/0.9)] hover:shadow-md hover:shadow-[rgb(var(--primary)/0.2)] active:scale-[0.98]",
        secondary:
          "bg-[rgb(var(--secondary))] text-white shadow-sm shadow-[rgb(var(--secondary)/0.16)] hover:bg-[rgb(var(--secondary)/0.9)] hover:shadow-md hover:shadow-[rgb(var(--secondary)/0.18)] active:scale-[0.98]",
        outline:
          "border border-[rgb(var(--border))] bg-[rgb(var(--surface))] hover:bg-[rgb(var(--surface-elevated))] hover:border-[rgb(var(--muted)/0.55)] text-[rgb(var(--foreground))] shadow-sm",
        ghost:
          "bg-transparent hover:bg-[rgb(var(--primary)/0.06)] text-[rgb(var(--foreground))]",
        destructive:
          "bg-[rgb(var(--destructive))] text-white hover:bg-[rgb(var(--destructive)/0.9)] active:scale-[0.98]",
        link: "text-[rgb(var(--primary))] underline-offset-4 hover:underline p-0 h-auto",
      },
      size: {
        sm: "h-8 px-3 text-xs",
        default: "h-10 px-5",
        lg: "h-12 px-7 text-base",
        xl: "h-14 px-8 text-lg",
        icon: "h-10 w-10 p-0",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean;
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : "button";
    return (
      <Comp
        className={cn(buttonVariants({ variant, size, className }))}
        ref={ref}
        {...props}
      />
    );
  }
);
Button.displayName = "Button";

export { Button, buttonVariants };
