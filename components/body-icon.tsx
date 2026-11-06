import { cn } from "@/lib/utils";

/** Простые силуэты кузовов: одинаковый стиль, читаются в 24–40 px. */
export function BodyIcon({ body, className }: { body: string; className?: string }) {
  const common = {
    viewBox: "0 0 64 32",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 2,
    strokeLinejoin: "round" as const,
    className: cn("h-8 w-16", className),
  };

  switch (body) {
    case "sedan":
      return (
        <svg {...common}>
          <path d="M4 22h56" />
          <path d="M8 22l4-7h12l6-5h14l8 12" />
          <circle cx="17" cy="24" r="3" />
          <circle cx="47" cy="24" r="3" />
        </svg>
      );
    case "hatchback":
      return (
        <svg {...common}>
          <path d="M4 22h56" />
          <path d="M8 22l4-7h14l6-6h12l6 13" />
          <circle cx="17" cy="24" r="3" />
          <circle cx="45" cy="24" r="3" />
        </svg>
      );
    case "wagon":
    case "estate":
      return (
        <svg {...common}>
          <path d="M4 22h56" />
          <path d="M8 22l4-7h18l6-6h14l4 13" />
          <circle cx="17" cy="24" r="3" />
          <circle cx="47" cy="24" r="3" />
        </svg>
      );
    case "suv":
      return (
        <svg {...common}>
          <path d="M3 22h58" />
          <path d="M7 22l3-9h16l5-5h13l7 14" />
          <circle cx="17" cy="24" r="3" />
          <circle cx="49" cy="24" r="3" />
        </svg>
      );
    case "coupe":
      return (
        <svg {...common}>
          <path d="M4 22h56" />
          <path d="M8 22l5-6h12l8-7h10l7 13" />
          <circle cx="17" cy="24" r="3" />
          <circle cx="47" cy="24" r="3" />
        </svg>
      );
    case "convertible":
      return (
        <svg {...common}>
          <path d="M4 22h56" />
          <path d="M8 22l5-6h20l4-4h8l5 10" />
          <circle cx="17" cy="24" r="3" />
          <circle cx="47" cy="24" r="3" />
        </svg>
      );
    case "minivan":
    case "van":
      return (
        <svg {...common}>
          <path d="M3 22h58" />
          <path d="M7 22V10h34l10 12" />
          <circle cx="17" cy="24" r="3" />
          <circle cx="47" cy="24" r="3" />
        </svg>
      );
    case "pickup":
      return (
        <svg {...common}>
          <path d="M3 22h58" />
          <path d="M7 22l3-8h14l5-5h10l6 13" />
          <path d="M39 14v8h16" />
          <circle cx="17" cy="24" r="3" />
          <circle cx="47" cy="24" r="3" />
        </svg>
      );
    default:
      return (
        <svg {...common}>
          <rect x="8" y="12" width="48" height="10" rx="3" />
          <circle cx="18" cy="24" r="3" />
          <circle cx="46" cy="24" r="3" />
        </svg>
      );
  }
}
