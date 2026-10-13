declare module 'virtual:spool-docs' {
  const site: Omit<import('../../../vite/docs/site').DocsSite, 'files'>;
  export const repository: string;
  export default site;
}
