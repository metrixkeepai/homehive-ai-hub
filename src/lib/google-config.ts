export const GATEWAY = "https://connector-gateway.lovable.dev";
const BASE = [
  "https://www.googleapis.com/auth/userinfo.email",
  "https://www.googleapis.com/auth/userinfo.profile",
];
export const GOOGLE = {
  google_mail: {
    scopes: [...BASE, "https://www.googleapis.com/auth/gmail.readonly"],
    env: "GOOGLE_MAIL_APP_USER_CONNECTOR_CLIENT_API_KEY",
  },
  google_calendar: {
    scopes: [...BASE, "https://www.googleapis.com/auth/calendar.events"],
    env: "GOOGLE_CALENDAR_APP_USER_CONNECTOR_CLIENT_API_KEY",
  },
  google_drive: {
    scopes: [...BASE, "https://www.googleapis.com/auth/drive.readonly"],
    env: "GOOGLE_DRIVE_APP_USER_CONNECTOR_CLIENT_API_KEY",
  },
} as const;
export type GoogleConnector = keyof typeof GOOGLE;
