"use client";

import * as React from "react";
import { Check, ChevronsUpDown, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";

interface MultiSelectProps<T> {
  options: T[];
  selected: T[];
  onSelect: (item: T) => void;
  onRemove: (item: T) => void;
  renderOption: (item: T) => React.ReactNode;
  renderBadge: (item: T) => React.ReactNode;
  isSelected: (item: T) => boolean;
  getKey: (item: T) => string;
  filterFn: (item: T, query: string) => boolean;
  placeholder?: string;
  searchPlaceholder?: string;
  emptyMessage?: string;
  className?: string;
  disabled?: boolean;
}

export function MultiSelect<T>({
  options,
  selected,
  onSelect,
  onRemove,
  renderOption,
  renderBadge,
  isSelected,
  getKey,
  filterFn,
  placeholder = "Select items...",
  searchPlaceholder = "Search...",
  emptyMessage = "No results found.",
  className,
  disabled = false,
}: MultiSelectProps<T>) {
  const [open, setOpen] = React.useState(false);
  const [search, setSearch] = React.useState("");

  const filteredOptions = React.useMemo(
    () => options.filter((item) => filterFn(item, search)),
    [options, search, filterFn],
  );

  function handleSelect(item: T) {
    onSelect(item);
    setSearch("");
  }

  function handleRemove(e: React.SyntheticEvent, item: T) {
    e.preventDefault();
    e.stopPropagation();
    onRemove(item);
  }

  return (
    <div className={cn("grid gap-2", className)}>
      {selected.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {selected.map((item) => (
            <Badge
              key={getKey(item)}
              variant="secondary"
              className="text-xs gap-1 pr-1"
            >
              {renderBadge(item)}
              <button
                type="button"
                aria-label="Remove"
                className="ml-0.5 rounded-full outline-none ring-offset-background focus:ring-2 focus:ring-ring focus:ring-offset-2"
                onMouseDown={(e) => handleRemove(e, item)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    handleRemove(e, item);
                  }
                }}
                disabled={disabled}
              >
                <X className="h-3 w-3 text-muted-foreground hover:text-foreground" />
              </button>
            </Badge>
          ))}
        </div>
      )}
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            role="combobox"
            aria-expanded={open}
            className="w-full justify-between h-10 font-normal"
            disabled={disabled}
          >
            <span className="truncate text-muted-foreground">
              {selected.length > 0
                ? `${selected.length} selected`
                : placeholder}
            </span>
            <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-[var(--radix-popover-trigger-width)] p-0" align="start">
          <Command shouldFilter={false}>
            <CommandInput
              placeholder={searchPlaceholder}
              value={search}
              onValueChange={setSearch}
            />
            <CommandList>
              <CommandEmpty>{emptyMessage}</CommandEmpty>
              <CommandGroup>
                {filteredOptions.map((item) => (
                  <CommandItem
                    key={getKey(item)}
                    value={getKey(item)}
                    onSelect={() => handleSelect(item)}
                    className="cursor-pointer"
                  >
                    <Check
                      className={cn(
                        "mr-2 h-4 w-4",
                        isSelected(item) ? "opacity-100" : "opacity-0",
                      )}
                    />
                    {renderOption(item)}
                  </CommandItem>
                ))}
              </CommandGroup>
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>
    </div>
  );
}
