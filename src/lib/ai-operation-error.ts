const failures = {
  "Plan feature unavailable": ["PLAN_EXCLUDED", "Your current plan does not include this feature."],
  "Monthly quota reached": ["MONTHLY_ALLOWANCE", "You have reached your monthly allowance."],
  "Platform AI budget reached": ["PLATFORM_BUDGET", "AI processing is temporarily unavailable."],
  "Service temporarily unavailable": ["AI_DISABLED", "AI processing is temporarily unavailable."],
  "Feature temporarily unavailable": [
    "FEATURE_DISABLED",
    "This feature is temporarily unavailable.",
  ],
  "Workspace unavailable": ["WORKSPACE", "This workspace is unavailable."],
  "Rate limit reached": ["RATE_LIMIT", "AI processing is temporarily busy. Please try again."],
  "AI concurrency limit reached": [
    "CONCURRENCY",
    "AI processing is temporarily busy. Please try again.",
  ],
} as const;

export class OperationFailure extends Error {
  constructor(reason: string, stage: string) {
    const [code, message] = failures[reason as keyof typeof failures] ?? [
      "AI_CONFIGURATION",
      "AI processing is temporarily unavailable.",
    ];
    super(message);
    console.warn("AI operation failed", { stage, code });
  }
}
