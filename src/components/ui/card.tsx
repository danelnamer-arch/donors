import { HTMLAttributes, ReactNode } from "react";

interface CardProps extends HTMLAttributes<HTMLDivElement> {
  children: ReactNode;
  variant?: "default" | "interactive" | "gradient";
}

const cardVariants = {
  default: "rounded-xl border border-zinc-200 bg-white shadow-sm dark:border-zinc-800 dark:bg-zinc-950",
  interactive:
    "rounded-xl border border-zinc-200 bg-white shadow-sm transition-shadow hover:shadow-md cursor-pointer dark:border-zinc-800 dark:bg-zinc-950",
  gradient:
    "rounded-xl border border-zinc-200 bg-white shadow-sm dark:border-zinc-800 dark:bg-zinc-950 relative overflow-hidden before:absolute before:inset-x-0 before:top-0 before:h-1 before:bg-gradient-to-r before:from-brand before:to-emerald-400",
};

export function Card({ children, variant = "default", className = "", ...props }: CardProps) {
  return (
    <div
      className={`${cardVariants[variant]} ${className}`}
      {...props}
    >
      {children}
    </div>
  );
}

export function CardHeader({
  children,
  className = "",
  ...props
}: Omit<CardProps, "variant">) {
  return (
    <div className={`border-b border-zinc-100 px-6 py-4 dark:border-zinc-800 ${className}`} {...props}>
      {children}
    </div>
  );
}

export function CardContent({
  children,
  className = "",
  ...props
}: Omit<CardProps, "variant">) {
  return (
    <div className={`px-6 py-4 ${className}`} {...props}>
      {children}
    </div>
  );
}
