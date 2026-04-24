interface MatchRingProps {
  score: number;  // -1 = pending (AI not scored yet)
  size?: number;
}

const MatchRing = ({ score, size = 64 }: MatchRingProps) => {
  const pending = score < 0;
  const radius = (size - 8) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = pending ? circumference : circumference - (score / 100) * circumference;

  const strokeColor = pending
    ? "hsl(var(--muted-foreground))"
    : score >= 70
      ? "hsl(var(--match-high))"
      : score >= 50
        ? "hsl(var(--match-medium))"
        : "hsl(var(--match-low))";

  const colorClass = pending
    ? "text-muted-foreground"
    : score >= 70
      ? "text-match-high"
      : score >= 50
        ? "text-match-medium"
        : "text-match-low";

  return (
    <div className="relative inline-flex items-center justify-center" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={radius} fill="none" stroke="hsl(var(--muted))" strokeWidth={4} />
        <circle
          cx={size / 2} cy={size / 2} r={radius} fill="none"
          stroke={strokeColor} strokeWidth={4}
          strokeDasharray={circumference} strokeDashoffset={offset}
          strokeLinecap="round"
          className={`transition-all duration-700 ease-out${pending ? ' opacity-30' : ''}`}
        />
      </svg>
      <span className={`absolute text-sm font-bold ${colorClass}`}>
        {pending ? '—' : `${score}%`}
      </span>
    </div>
  );
};

export default MatchRing;
