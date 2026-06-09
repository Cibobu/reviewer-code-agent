import Image from "next/image";

type LogoProps = {
  size?: "sm" | "md" | "lg" | "xl";
  showText?: boolean;
  className?: string;
};

const sizes = {
  sm: { img: 32, text: "text-base" },
  md: { img: 44, text: "text-lg" },
  lg: { img: 72, text: "text-2xl" },
  xl: { img: 96, text: "text-3xl" },
};

export function Logo({ size = "md", showText = true, className = "" }: LogoProps) {
  const s = sizes[size];

  return (
    <div className={`flex items-center gap-3 ${className}`}>
      <div className="relative shrink-0 rounded-full p-0.5 bg-gradient-to-br from-violet-400/40 via-fuchsia-400/30 to-purple-500/40 shadow-glow-sm">
        <Image
          src="/logo.png"
          alt="GitGuardian mascot"
          width={s.img}
          height={s.img}
          className="rounded-full drop-shadow-md"
          priority
        />
      </div>
      {showText && (
        <span
          className={`font-bold bg-gradient-to-r from-violet-300 via-fuchsia-300 to-purple-400 bg-clip-text text-transparent ${s.text}`}
        >
          GitGuardian
        </span>
      )}
    </div>
  );
}
