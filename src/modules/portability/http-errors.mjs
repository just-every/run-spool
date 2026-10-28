import { importRunningMetadata } from './import-lease.mjs';

// A code's spelling is not evidence that it is public. Keep the established
// vocabulary closed, and discard diagnostic suffixes containing schema/input.
const publicCodes = new Set(`
 D1_RPC_TRANSPORT_LIMIT advance_limit archive_checksum archive_format archive_incomplete archive_json
 binary_checksum binary_inventory binary_order binary_size body_too_large bucket_inventory bucket_not_empty
 closing_missing column_inventory configuration_inventory confirmation_required content_checksum copy_inventory copy_rowid
 data_after_closing dev_data erased_row erasure_epoch excluded_destination_dependents excluded_foreign_key
 export_incomplete export_phase export_row_must_be_pure export_row_not_idempotent extra_part generated_sql
 import_applying import_complete import_lease_expired import_phase import_row_columns import_row_key import_row_must_be_pure
 import_row_not_deterministic import_row_not_idempotent import_row_undeclared import_row_unsafe_value import_running import_safety_table_missing
 invalid_accepted_schema invalid_bookkeeping_rows invalid_bucket_policy invalid_bucket_prefix invalid_extra_payload
 invalid_handler_configuration invalid_import_safety invalid_import_safety_column invalid_journal invalid_json invalid_object_references
 invalid_part_limit invalid_policy invalid_policy_importSafety invalid_policy_importSafety_pair invalid_secret_column invalid_secret_columns
 invalid_policy_excludeTables invalid_policy_includeTables invalid_policy_derivedTables invalid_policy_replaceableTables
 invalid_policy_requiredConfiguration invalid_policy_exportRow invalid_policy_importRow invalid_policy_validateStaged
 job_not_found later_journal ledger_inventory legacy_acknowledgement_required legacy_archive_unverifiable legacy_bucket_not_empty
 legacy_output_exists legacy_output_required legacy_restored_export_failed legacy_target_not_empty legacy_v1_required live_policy_approval
 manifest_counts manifest_identity manifest_inventory migration_ledger missing_bucket object_changed object_references
 object_write_checksum object_write_failed origin_refused part_byte_limit part_checksum part_conflict part_count part_missing
 part_order part_row_limit parts_missing payload_changed payload_inventory platform_table policy_table_missing
 provider_relink_required provider_session_data provider_sign_in_must_be_off provider_transient_data reference_column_excluded reference_column_missing
 route_not_found row_columns row_inventory row_not_null row_order row_part_too_large row_type rowid_inventory rows_missing
 schema_checksum schema_mismatch secret_inventory secret_table_missing staged_table staged_validation table_inventory target_not_empty
 transfer_sql_limit unauthorized unsafe_integer unsupported_column unsupported_copy_rowid unsupported_restore_width unsupported_rowid
 upgrade_row_must_be_pure virtual_table wrong_product
 unauthenticated forbidden owner_required authority_changed step_up_required rate_limited operation_failed
`.trim().split(/\s+/));
const publicCode = code => typeof code === 'string' && publicCodes.has(code.split(':')[0]) ? code.split(':')[0] : 'operation_failed';

// Public errors use the existing {error:code} vocabulary. Native messages can
// contain SQL, row values or credentials; inspect causes only to choose status.
export function httpFailure(error,{actor=null}={}) {
 const seen = new Set();let typed,nativeStatus;
 for (let cause = error; cause && !seen.has(cause) && seen.size < 5; cause = cause.cause) {
  seen.add(cause);
  if (Number.isInteger(cause.status) && cause.status >= 400 && cause.status <= 599) {
   const code = publicCode(cause.code);
   // A generic server wrapper must not turn a known authority refusal into 500.
   if (!typed || typed.status >= 500 && cause.status < 500) typed = { status: cause.status, body: { error: code,
    ...(cause.status === 409 && cause.code === 'import_running' ? importRunningMetadata(cause,actor) : {}) } };
  }
  if (cause.name === 'TimeoutError' || ['ETIMEDOUT', 'UND_ERR_CONNECT_TIMEOUT', 'UND_ERR_HEADERS_TIMEOUT'].includes(cause.code))
   nativeStatus = 504;
  if (['ECONNRESET', 'ECONNREFUSED', 'SQLITE_BUSY', 'SQLITE_LOCKED'].includes(cause.code)
   || /\bD1_ERROR\b/i.test(cause.message ?? '') && /overloaded|temporarily unavailable|reset|timed? out|timeout|SQLITE_BUSY|SQLITE_LOCKED|database is locked/i.test(cause.message))
   nativeStatus ??= 503;
 }
 return typed ?? { status: nativeStatus ?? 500, body: { error: 'operation_failed' } };
}
