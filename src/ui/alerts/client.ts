export { api as alertApi } from '../workbench/client';
export { date } from '../workbench/shared';
export const status=(value:string)=>value.replaceAll('_',' ');

export const mailStatus = (row: { state: string; code?: string | null }) => row.code === 'mail_development' ? 'suppressed locally' : status(row.state);
