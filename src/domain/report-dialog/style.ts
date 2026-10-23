export const reportDialogStyle = `
.spool-report-dialog{box-sizing:border-box;width:34rem;max-width:calc(100vw - 2rem);max-height:calc(100dvh - 2rem);overflow:auto;padding:1.5rem;border:1px solid #bcb9b0;border-radius:12px;background:#f7f6f2;color:#20211e;font:16px/1.5 system-ui,sans-serif;box-shadow:0 12px 60px #0005}
.spool-report-dialog::backdrop{background:#1119}
.spool-report-dialog *{box-sizing:border-box}
.spool-report-dialog h2{font-size:1.5rem;line-height:1.2;margin:0 0 .75rem;overflow-wrap:anywhere}
.spool-report-dialog p{margin:.75rem 0;overflow-wrap:anywhere}
.spool-report-dialog label{display:block;margin:.75rem 0;font-weight:600;overflow-wrap:anywhere}
.spool-report-dialog textarea{display:block;width:100%;min-height:9rem;margin-top:.4rem;padding:.65rem;border:1px solid #777;border-radius:4px;background:#fff;color:#20211e;font:inherit;resize:vertical}
.spool-report-dialog .spool-report-consent{display:flex;align-items:flex-start;gap:.6rem;font-weight:400}
.spool-report-dialog input{flex:none;margin-top:.35rem;accent-color:#222}
.spool-report-dialog footer{display:flex;flex-wrap:wrap;justify-content:flex-end;gap:.75rem;margin-top:1rem}
.spool-report-dialog button{max-width:100%;padding:.65rem 1.25rem;border:1px solid #555;border-radius:24px;background:#fff;color:#20211e;font:600 1rem/1.4 system-ui,sans-serif;overflow-wrap:anywhere;cursor:pointer}
.spool-report-dialog button[type=submit]{background:#20211e;color:#fff}
.spool-report-dialog :focus-visible{outline:3px solid #365fa1;outline-offset:3px}
.spool-report-dialog [role=alert]{color:#8a2424;font-weight:600}
.spool-report-dialog [hidden]{display:none!important}
`;
