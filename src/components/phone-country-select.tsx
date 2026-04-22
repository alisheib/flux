"use client";

import * as React from "react";
import { useState, useCallback, useMemo } from "react";
import { ChevronsUpDown, Check } from "lucide-react";
import getUnicodeFlagIcon from "country-flag-icons/unicode";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Command,
  CommandInput,
  CommandList,
  CommandEmpty,
  CommandGroup,
  CommandItem,
} from "@/components/ui/command";

interface CountryOption {
  value?: string;
  label: string;
  divider?: boolean;
}

interface PhoneCountrySelectProps {
  value?: string;
  onChange: (value: string | undefined) => void;
  options: CountryOption[];
  disabled?: boolean;
  readOnly?: boolean;
  iconComponent?: React.ElementType;
  // swallow any other props react-phone-number-input passes
  [key: string]: unknown;
}

export default function PhoneCountrySelect({
  value,
  onChange,
  options,
  disabled,
}: PhoneCountrySelectProps) {
  const [open, setOpen] = useState(false);

  const countries = useMemo(
    () => options.filter((o) => !o.divider && o.value),
    [options]
  );

  const selectedLabel = useMemo(() => {
    const opt = countries.find((o) => o.value === value);
    return opt?.label ?? "";
  }, [countries, value]);

  const handleSelect = useCallback(
    (code: string) => {
      onChange(code === "ZZ" ? undefined : code);
      setOpen(false);
    },
    [onChange]
  );

  const flag = value ? getUnicodeFlagIcon(value) : "🌐";

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          role="combobox"
          aria-expanded={open}
          aria-label={`Selected country: ${selectedLabel}`}
          disabled={disabled}
          className="flex shrink-0 items-center gap-1 rounded-md px-1.5 py-1 text-sm transition-colors hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50"
        >
          <span className="text-lg leading-none">{flag}</span>
          <ChevronsUpDown className="size-3.5 text-muted-foreground" />
        </button>
      </PopoverTrigger>
      <PopoverContent
        className="w-[280px] p-0"
        align="start"
        side="bottom"
        sideOffset={8}
      >
        <Command>
          <CommandInput placeholder="Search country..." />
          <CommandList className="max-h-[240px]">
            <CommandEmpty className="py-4 text-center text-sm text-muted-foreground">
              No country found.
            </CommandEmpty>
            <CommandGroup>
              {countries.map((option) => {
                const code = option.value!;
                let flagEmoji: string;
                try {
                  flagEmoji = getUnicodeFlagIcon(code);
                } catch {
                  flagEmoji = "🌐";
                }
                return (
                  <CommandItem
                    key={code}
                    value={`${option.label} ${code}`}
                    onSelect={() => handleSelect(code)}
                    data-checked={value === code ? "true" : undefined}
                  >
                    <span className="text-base leading-none">{flagEmoji}</span>
                    <span className="flex-1 truncate text-sm">
                      {option.label}
                    </span>
                    {value === code && (
                      <Check className="ml-auto size-4 text-foreground" />
                    )}
                  </CommandItem>
                );
              })}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
