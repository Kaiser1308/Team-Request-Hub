import { cn } from "@/lib/utils";

interface UnreadCountBadgeProps {
  count: number;
  className?: string;
  showZero?: boolean;
}

export function UnreadCountBadge({
  count,
  className,
  showZero = false,
}: UnreadCountBadgeProps) {
  if (count <= 0 && !showZero) {
    return null;
  }

  return (
    <span
      className={cn(
        "inline-flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-medium leading-none text-white",
        className,
      )}
    >
      {count > 99 ? "99+" : count}
    </span>
  );
}
