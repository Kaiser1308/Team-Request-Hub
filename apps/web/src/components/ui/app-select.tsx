"use client"

import * as React from "react"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { cn } from "@/lib/utils"

type AppSelectOption<T extends string> = {
  value: T
  label: string
}

function AppSelect<T extends string>({
  value,
  options,
  onChange,
  placeholder,
  className,
}: {
  value: T
  options: AppSelectOption<T>[]
  onChange: (value: T) => void
  placeholder?: string
  className?: string
}) {
  const [open, setOpen] = React.useState(false)
  const active = options.find((o) => o.value === value)

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          aria-expanded={open}
          aria-haspopup="listbox"
          className={cn(
            "inline-flex h-10 w-full items-center justify-between gap-2 rounded-lg border px-3 text-left text-sm outline-none transition-all duration-150",
            open
              ? "border-[#097fe8] bg-white shadow-[0_0_0_3px_rgb(9_127_232/12%)]"
              : "border-[#d8d2cc] bg-[#fbfaf9] hover:border-[#c0b8b0] hover:bg-[#f7f5f2]",
            className,
          )}
        >
          <span className={cn("truncate", active ? "text-[#111827]" : "text-[#9ca3af]")}>
            {active?.label ?? placeholder ?? ""}
          </span>
          <svg
            width="16"
            height="16"
            viewBox="0 0 16 16"
            fill="none"
            className={cn(
              "shrink-0 transition-transform duration-200",
              open ? "rotate-180 text-[#097fe8]" : "text-[#615d59]",
            )}
            aria-hidden="true"
          >
            <path
              d="m4 6 4 4 4-4"
              stroke="currentColor"
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth="1.5"
            />
          </svg>
        </button>
      </PopoverTrigger>
      <PopoverContent
        align="start"
        className="app-surface w-[--radix-popover-trigger-width] rounded-lg p-1.5"
        onOpenAutoFocus={(e) => e.preventDefault()}
      >
        <div className="grid gap-0.5">
          {options.map((option) => {
            const isSelected = option.value === value
            return (
              <button
                key={option.value}
                type="button"
                role="option"
                aria-selected={isSelected}
                onClick={() => {
                  onChange(option.value)
                  setOpen(false)
                }}
                className={cn(
                  "flex w-full items-center gap-2 rounded-md px-3 py-2 text-left text-sm transition-colors duration-100",
                  isSelected
                    ? "bg-[#f2f9ff] text-[#097fe8] font-medium"
                    : "text-[#111827] hover:bg-[#f7f5f2]",
                )}
              >
                <span className="flex-1 truncate">{option.label}</span>
                {isSelected ? (
                  <svg width="16" height="16" viewBox="0 0 16 16" fill="none" className="shrink-0 text-[#097fe8]" aria-hidden="true">
                    <path d="M3.5 8.5 6.5 11.5 12.5 4.5" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" />
                  </svg>
                ) : null}
              </button>
            )
          })}
        </div>
      </PopoverContent>
    </Popover>
  )
}

export { AppSelect }
