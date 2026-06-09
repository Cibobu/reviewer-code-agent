type IconProps = { active?: boolean; className?: string };

const base = "transition-colors duration-200";

export function IconDashboard({ active, className = "" }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={`w-5 h-5 ${base} ${className}`} aria-hidden>
      <rect
        x="3"
        y="3"
        width="8"
        height="8"
        rx="3"
        className={active ? "fill-violet-400" : "fill-violet-400/35 stroke-violet-300/60"}
        strokeWidth="1.5"
      />
      <rect
        x="13"
        y="3"
        width="8"
        height="5"
        rx="2.5"
        className={active ? "fill-fuchsia-400" : "fill-fuchsia-400/35 stroke-fuchsia-300/60"}
        strokeWidth="1.5"
      />
      <rect
        x="13"
        y="10"
        width="8"
        height="11"
        rx="3"
        className={active ? "fill-purple-400" : "fill-purple-400/35 stroke-purple-300/60"}
        strokeWidth="1.5"
      />
      <rect
        x="3"
        y="13"
        width="8"
        height="8"
        rx="3"
        className={active ? "fill-indigo-400" : "fill-indigo-400/35 stroke-indigo-300/60"}
        strokeWidth="1.5"
      />
    </svg>
  );
}

export function IconRepositories({ active, className = "" }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={`w-5 h-5 ${base} ${className}`} aria-hidden>
      <path
        d="M4 7.5a2.5 2.5 0 0 1 2.5-2.5h11A2.5 2.5 0 0 1 20 7.5v9a2.5 2.5 0 0 1-2.5 2.5h-11A2.5 2.5 0 0 1 4 16.5v-9Z"
        className={active ? "fill-violet-400/90" : "fill-violet-400/25 stroke-violet-300/50"}
        strokeWidth="1.5"
      />
      <path
        d="M8 5.5v13M12 8.5h4M12 12h3"
        stroke={active ? "#e9d5ff" : "#a78bfa"}
        strokeWidth="1.5"
        strokeLinecap="round"
      />
    </svg>
  );
}

export function IconReviews({ active, className = "" }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={`w-5 h-5 ${base} ${className}`} aria-hidden>
      <circle
        cx="11"
        cy="11"
        r="6.5"
        className={active ? "fill-fuchsia-400/90" : "fill-fuchsia-400/25 stroke-fuchsia-300/50"}
        strokeWidth="1.5"
      />
      <path
        d="M16.5 16.5L20 20"
        stroke={active ? "#f5d0fe" : "#e879f9"}
        strokeWidth="2"
        strokeLinecap="round"
      />
      <circle cx="9" cy="10" r="1" fill={active ? "#fff" : "#f0abfc"} />
      <circle cx="13" cy="10" r="1" fill={active ? "#fff" : "#f0abfc"} />
      <path
        d="M9 13.5c.8.6 1.7.9 2 .9s1.2-.3 2-.9"
        stroke={active ? "#fff" : "#f0abfc"}
        strokeWidth="1.2"
        strokeLinecap="round"
      />
    </svg>
  );
}

export function IconTelegram({ active, className = "" }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={`w-5 h-5 ${base} ${className}`} aria-hidden>
      <path
        d="M5 12.5l12.5-5-2.5 11-3-2.5-2.5 2-1-3.5-3.5 2Z"
        className={active ? "fill-sky-400/90" : "fill-sky-400/30 stroke-sky-300/50"}
        strokeWidth="1.5"
        strokeLinejoin="round"
      />
      <circle
        cx="12"
        cy="12"
        r="9"
        className={active ? "stroke-sky-300/80" : "stroke-sky-400/40"}
        strokeWidth="1.5"
        strokeDasharray="2 3"
      />
    </svg>
  );
}

export function IconLogout({ className = "" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={`w-5 h-5 ${className}`} aria-hidden>
      <path
        d="M9 6v12M5 10l4-4 4 4"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M13 6h4a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2h-4"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
    </svg>
  );
}

const NAV_ICON_MAP = {
  dashboard: IconDashboard,
  repositories: IconRepositories,
  reviews: IconReviews,
  telegram: IconTelegram,
} as const;

export type NavIconName = keyof typeof NAV_ICON_MAP;

export function NavIcon({ name, active }: { name: NavIconName; active?: boolean }) {
  const Icon = NAV_ICON_MAP[name];
  return <Icon active={active} />;
}
