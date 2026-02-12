"use client";

import { createContext, useContext, useState, ReactNode } from "react";

interface TabsContextValue {
  value: string;
  onChange: (value: string) => void;
  variant: "underline" | "pills";
}

const TabsContext = createContext<TabsContextValue>({ value: "", onChange: () => {}, variant: "underline" });

interface TabsProps {
  defaultValue: string;
  value?: string;
  onValueChange?: (value: string) => void;
  variant?: "underline" | "pills";
  children: ReactNode;
  className?: string;
}

export function Tabs({ defaultValue, value, onValueChange, variant = "underline", children, className = "" }: TabsProps) {
  const [internalValue, setInternalValue] = useState(defaultValue);
  const currentValue = value ?? internalValue;

  function handleChange(newValue: string) {
    if (!value) setInternalValue(newValue);
    onValueChange?.(newValue);
  }

  return (
    <TabsContext.Provider value={{ value: currentValue, onChange: handleChange, variant }}>
      <div className={className}>{children}</div>
    </TabsContext.Provider>
  );
}

export function TabsList({ children, className = "" }: { children: ReactNode; className?: string }) {
  const { variant } = useContext(TabsContext);

  const baseClass =
    variant === "pills"
      ? "flex gap-1 rounded-lg border border-zinc-200 bg-zinc-50 p-1 dark:border-zinc-800 dark:bg-zinc-900"
      : "flex gap-0 border-b border-zinc-200 dark:border-zinc-800";

  return (
    <div role="tablist" className={`${baseClass} ${className}`}>
      {children}
    </div>
  );
}

interface TabsTriggerProps {
  value: string;
  children: ReactNode;
  count?: number;
  disabled?: boolean;
  className?: string;
}

export function TabsTrigger({ value, children, count, disabled = false, className = "" }: TabsTriggerProps) {
  const { value: currentValue, onChange, variant } = useContext(TabsContext);
  const isActive = currentValue === value;

  const pillsClass = isActive
    ? "bg-brand text-white shadow-sm"
    : "text-zinc-500 hover:bg-zinc-100 hover:text-zinc-900 dark:hover:bg-zinc-800 dark:hover:text-zinc-300";

  const underlineClass = isActive
    ? "border-b-2 border-brand text-brand"
    : "border-b-2 border-transparent text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300";

  const baseClass =
    variant === "pills"
      ? `rounded-md px-4 py-2 text-sm font-medium transition-colors ${pillsClass}`
      : `px-3 pb-3 text-sm font-medium transition-colors ${underlineClass}`;

  return (
    <button
      role="tab"
      type="button"
      aria-selected={isActive}
      disabled={disabled}
      onClick={() => onChange(value)}
      className={`${baseClass} disabled:pointer-events-none disabled:opacity-50 ${className}`}
    >
      {children}
      {count !== undefined && count > 0 && (
        <span className={`ml-1.5 text-xs ${isActive && variant === "pills" ? "text-white/80" : "text-zinc-400"}`}>
          {count}
        </span>
      )}
    </button>
  );
}

interface TabsContentProps {
  value: string;
  children: ReactNode;
  className?: string;
}

export function TabsContent({ value, children, className = "" }: TabsContentProps) {
  const { value: currentValue } = useContext(TabsContext);
  if (currentValue !== value) return null;

  return (
    <div role="tabpanel" className={className}>
      {children}
    </div>
  );
}
