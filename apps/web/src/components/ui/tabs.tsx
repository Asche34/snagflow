"use client";

import * as React from "react";
import { cn } from "@/lib/utils";

/**
 * Minimal accessible tabs: roving buttons in a tablist, panels hidden with the
 * correct aria wiring. No Radix needed for the handful of simple usages here.
 */
type TabsContextValue = { value: string; setValue: (v: string) => void; id: string };
const TabsContext = React.createContext<TabsContextValue | null>(null);

function useTabs() {
  const ctx = React.useContext(TabsContext);
  if (!ctx) throw new Error("Tabs compound components must be used inside <Tabs>");
  return ctx;
}

function Tabs({
  defaultValue,
  value: controlled,
  onValueChange,
  className,
  children,
  ...props
}: React.ComponentProps<"div"> & {
  defaultValue?: string;
  value?: string;
  onValueChange?: (v: string) => void;
}) {
  const [internal, setInternal] = React.useState(defaultValue ?? "");
  const value = controlled ?? internal;
  const id = React.useId();
  const setValue = React.useCallback(
    (v: string) => {
      setInternal(v);
      onValueChange?.(v);
    },
    [onValueChange],
  );
  return (
    <TabsContext.Provider value={{ value, setValue, id }}>
      <div className={cn("flex flex-col gap-2", className)} {...props}>
        {children}
      </div>
    </TabsContext.Provider>
  );
}

function TabsList({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      role="tablist"
      className={cn("flex flex-wrap items-center gap-1 border-b", className)}
      {...props}
    />
  );
}

function TabsTrigger({ className, value, ...props }: React.ComponentProps<"button"> & { value: string }) {
  const ctx = useTabs();
  const selected = ctx.value === value;
  const id = `${ctx.id}-${value}`;
  return (
    <button
      type="button"
      role="tab"
      id={id}
      aria-selected={selected}
      aria-controls={`${id}-panel`}
      tabIndex={selected ? 0 : -1}
      onClick={() => ctx.setValue(value)}
      className={cn(
        "cursor-pointer rounded-md px-3 py-1.5 text-sm font-medium transition-colors",
        "hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
        selected ? "text-foreground" : "text-muted-foreground",
        className,
      )}
      {...props}
    />
  );
}

function TabsContent({
  className,
  value,
  children,
  ...props
}: React.ComponentProps<"div"> & { value: string }) {
  const ctx = useTabs();
  if (ctx.value !== value) return null;
  return (
    <div
      role="tabpanel"
      id={`${ctx.id}-${value}-panel`}
      aria-labelledby={`${ctx.id}-${value}`}
      className={cn("focus-visible:outline-none", className)}
      {...props}
    >
      {children}
    </div>
  );
}

export { Tabs, TabsContent, TabsList, TabsTrigger };
