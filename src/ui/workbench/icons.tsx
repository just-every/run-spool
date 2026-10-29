// Line icons drawn at 16px on a 1.5px ink stroke; every icon-only control names itself through Tip.
const paths = {
  search: <><circle cx="7" cy="7" r="4.5" /><path d="m10.5 10.5 3.5 3.5" /></>,
  filter: <path d="M2.5 3h11l-4.25 5v4.5l-2.5 1.25V8z" />,
  sort: <path d="M5 13V3M2.5 5.5 5 3l2.5 2.5M11 3v10M8.5 10.5 11 13l2.5-2.5" />,
  display: <><rect x="2.5" y="2.5" width="4.5" height="4.5" rx=".5" /><rect x="9" y="2.5" width="4.5" height="4.5" rx=".5" /><rect x="2.5" y="9" width="4.5" height="4.5" rx=".5" /><rect x="9" y="9" width="4.5" height="4.5" rx=".5" /></>,
  down: <path d="m4 6 4 4 4-4" />,
  right: <path d="m6 4 4 4-4 4" />,
  left: <path d="m10 4-4 4 4 4" />,
  download: <path d="M8 2.5v8M4.5 7 8 10.5 11.5 7M3 13.5h10" />,
  check: <><circle cx="8" cy="8" r="5.75" /><path d="m5.5 8.2 1.8 1.8 3.2-3.6" /></>,
  flag: <path d="M4 14V2.5M4 3h8l-1.75 3L12 9H4" />,
  info: <><circle cx="8" cy="8" r="5.75" /><path d="M8 7.25V11M8 5v.01" /></>,
  group: <><rect x="2.5" y="2.5" width="7" height="7" rx="1" /><path d="M6.5 13.5h7v-7" /></>,
  arrow: <path d="M2.5 8h10.5M9.5 4.5 13 8l-3.5 3.5" />,
  close: <path d="m4 4 8 8M12 4l-8 8" />,
  menu: <path d="M2.5 4.5h11M2.5 8h11M2.5 11.5h11" />,
} as const;
export type IconName = keyof typeof paths;
export function Icon({ name, size = 16 }: { name: IconName; size?: number }) {
  return <svg className="icon" width={size} height={size} viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false">{paths[name]}</svg>;
}
