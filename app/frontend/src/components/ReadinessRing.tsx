import { cn } from "@/lib/utils";

interface ReadinessRingProps {
  value: number;
  size?: number;
  className?: string;
}

const ReadinessRing = ({ value, size = 40, className }: ReadinessRingProps) => {
  const strokeWidth = 3;
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (value / 100) * circumference;

  // Gradient ID unique per instance to avoid SVG defs collision
  const gradId = `ring-grad-${size}-${value}`;

  // Color tiers: brand gradient when high, warning when mid, muted when low
  const useGradient = value >= 70;
  const solidColor = value >= 50 ? "hsl(var(--warning))" : "hsl(var(--muted-foreground))";

  return (
    <div className={cn("relative inline-flex items-center justify-center", className)}>
      <svg width={size} height={size} className="-rotate-90">
        <defs>
          <linearGradient id={gradId} x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="hsl(237 75% 59%)" />
            <stop offset="100%" stopColor="hsl(199 89% 55%)" />
          </linearGradient>
        </defs>
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="hsl(var(--border))"
          strokeWidth={strokeWidth}
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={useGradient ? `url(#${gradId})` : solidColor}
          strokeWidth={strokeWidth}
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          strokeLinecap="round"
          className="transition-all duration-500"
        />
      </svg>
      <span className={cn(
        "absolute text-[10px] font-semibold",
        useGradient ? "text-primary" : "text-foreground",
      )}>
        {value}%
      </span>
    </div>
  );
};

export default ReadinessRing;
