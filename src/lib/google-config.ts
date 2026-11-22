export const GOOGLE = {
  google_mail: {
    scopes: ["https://www.googleapis.com/auth/gmail.readonly"],
  },
  google_calendar: {
    scopes: [
      "https://www.googleapis.com/auth/userinfo.email",
      "https://www.googleapis.com/auth/calendar.events",
    ],
  },
  google_drive: {
    scopes: ["https://www.googleapis.com/auth/drive.readonly"],
  },
} as const;
export type GoogleConnector = keyof typeof GOOGLE;
