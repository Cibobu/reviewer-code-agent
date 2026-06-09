type NotificationBadgeProps = {
  count?: number;
  size?: "sm" | "md";
  pulse?: boolean;
};

/** Cute bubble-style notification dot matching mascot aesthetic. */
export function NotificationBadge({ count, size = "sm", pulse = true }: NotificationBadgeProps) {
  const dim = size === "md" ? "h-3 w-3" : "h-2.5 w-2.5";
  const showCount = count !== undefined && count > 0;

  if (showCount && size === "md") {
    return (
      <span
        className="relative inline-flex items-center justify-center min-w-[1.25rem] h-5 px-1.5 rounded-full text-[10px] font-bold text-white bg-gradient-to-br from-fuchsia-400 to-violet-500 shadow-glow-sm border border-white/20"
        title={`${count} baru`}
      >
        {pulse && (
          <span className="absolute inset-0 rounded-full bg-fuchsia-400/50 animate-ping" />
        )}
        <span className="relative">{count > 99 ? "99+" : count}</span>
      </span>
    );
  }

  return (
    <span className={`relative inline-flex ${dim} shrink-0`} title={showCount ? `${count} baru` : "Baru"}>
      {pulse && (
        <span className={`absolute inline-flex ${dim} rounded-full bg-fuchsia-400/60 animate-ping`} />
      )}
      <span
        className={`relative inline-flex ${dim} rounded-full bg-gradient-to-br from-fuchsia-400 to-violet-500 border border-white/25 shadow-glow-sm`}
      />
    </span>
  );
}
