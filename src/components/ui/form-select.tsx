"use client";

import * as React from "react";
import { useState, useCallback, useRef, useEffect } from "react";
import { ChevronsUpDown, Check } from "lucide-react";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { cn } from "@/lib/utils";

interface FormSelectOption {
  value: string;
  label: string;
  // Optional shorter label shown in the trigger button when this option is
  // selected. Defaults to `label`. Useful when the dropdown shows a verbose
  // label (e.g. "USD — US Dollar") but the trigger should show only the
  // identifier (e.g. "USD") because the trigger lives in a narrow column.
  triggerLabel?: string;
}

interface FormSelectProps {
  id?: string;
  name?: string;
  defaultValue?: string;
  value?: string;
  onChange?: (value: string) => void;
  options: FormSelectOption[];
  placeholder?: string;
  disabled?: boolean;
  className?: string;
}

export function FormSelect({
  id,
  name,
  defaultValue,
  value: controlledValue,
  onChange,
  options,
  placeholder = "Select...",
  disabled,
  className,
}: FormSelectProps) {
  const [internalValue, setInternalValue] = useState(defaultValue ?? "");
  const isControlled = controlledValue !== undefined;
  const currentValue = isControlled ? controlledValue : internalValue;
  const [open, setOpen] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);

  // Sync with defaultValue changes (e.g., when editing a different record)
  useEffect(() => {
    if (!isControlled && defaultValue !== undefined) {
      setInternalValue(defaultValue);
    }
  }, [defaultValue, isControlled]);

  const selectedOption = options.find((o) => o.value === currentValue);

  const handleSelect = useCallback(
    (val: string) => {
      if (!isControlled) {
        setInternalValue(val);
      }
      onChange?.(val);
      setOpen(false);
    },
    [isControlled, onChange]
  );

  return (
    <>
      {name && <input type="hidden" name={name} value={currentValue} />}
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <button
            ref={triggerRef}
            id={id}
            type="button"
            role="combobox"
            aria-expanded={open}
            disabled={disabled}
            className={cn(
              "flex h-9 w-full items-center justify-between rounded-lg border border-input bg-background px-3 py-2 text-sm transition-colors outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:opacity-50 dark:bg-input/30 dark:hover:bg-input/50",
              !selectedOption && "text-muted-foreground",
              className
            )}
          >
            <span className="truncate">
              {selectedOption
                ? (selectedOption.triggerLabel ?? selectedOption.label)
                : placeholder}
            </span>
            <ChevronsUpDown className="ml-2 size-4 shrink-0 text-muted-foreground" />
          </button>
        </PopoverTrigger>
        <PopoverContent
          className="p-1 max-w-[min(420px,calc(100vw-2rem))]"
          align="start"
          side="bottom"
          sideOffset={4}
          style={{
            // minWidth (not width) so the popover never SHRINKS below the
            // trigger, but is free to GROW to fit the longest option label.
            // The max-w cap above prevents runaway width on edge cases and
            // ensures we stay inside the viewport on mobile.
            minWidth: triggerRef.current
              ? `${triggerRef.current.offsetWidth}px`
              : undefined,
          }}
        >
          <div className="max-h-[280px] overflow-y-auto">
            {options.map((option) => (
              <button
                key={option.value}
                type="button"
                className={cn(
                  "relative flex w-full cursor-default items-center gap-2 rounded-md px-2 py-1.5 text-sm outline-none select-none transition-colors hover:bg-accent hover:text-accent-foreground",
                  currentValue === option.value && "bg-accent/50"
                )}
                onClick={() => handleSelect(option.value)}
              >
                {/* whitespace-nowrap keeps option text on one line so the
                    popover sizes to the natural width of the longest label.
                    No more "TZS — Tanzani..." truncation in the currency picker. */}
                <span className="flex-1 whitespace-nowrap text-left">
                  {option.label}
                </span>
                {currentValue === option.value && (
                  <Check className="size-4 shrink-0" />
                )}
              </button>
            ))}
          </div>
        </PopoverContent>
      </Popover>
    </>
  );
}
