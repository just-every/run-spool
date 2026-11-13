/** Explain browser restore refusals without changing the server's safety checks. */
export function restoreRefusal(code: unknown, status: number): string {
  const reason = typeof code === 'string' ? code : '';
  if (/^(erasure_epoch|erased_row)(:|$)/.test(reason)) return 'This archive contains data that was erased. Restoring it would bring back erased data, so Spool refused it. Choose an archive made after erasure, or create a new project without restoring this archive.';
  if (status === 401) return 'Your session ended. Sign in again, then choose the archive and retry the restore.';
  if (status === 403) return 'Restore requires the installation owner. Open this installation as its owner and try again.';
  if (/^(target_not_empty|bucket_not_empty)(:|$)/.test(reason)) return 'This installation already contains data. Restore into an empty installation, or keep using the current projects. Download an archive before removing any current data.';
  if (/^(import_running|import_lease_expired|import_phase)(:|$)/.test(reason)) return 'Another restore is running or its session ended. Reload to check the installation before trying again.';
  if (/^(wrong_product|schema_mismatch|table_inventory|column_inventory|configuration_inventory|secret_inventory|bucket_inventory|payload_inventory|unsupported_restore_width)(:|$)/.test(reason)) return 'This archive is not compatible with this installation. Check that it is a Spool archive and update Spool before trying again. Keep the original file.';
  if (status === 413 || /limit|budget/.test(reason)) return 'This archive exceeds the browser restore limits. Keep the original file and use the local import command for a supported archive.';
  if (status === 429) return 'Restore is temporarily rate limited. Wait, then try again.';
  if (status >= 500) return 'Spool could not finish the restore. Reload to check the installation before trying again. Keep the original file.';
  return 'This archive is damaged or incomplete and could not be restored. Download it again from the source installation, or choose another intact archive.';
}
