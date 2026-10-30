export const notificationTypes = ['resolution','regression','assignment','comment','mention','issue_alert','deploy','weekly_report'] as const;
export type EmailPreferences = Record<typeof notificationTypes[number], boolean>;
