/** Public read vocabulary. Codes are stable; clients render the labels from
 * this table instead of turning identifiers or exception text into sentences. */
const definitions = {
 native_edit_conflict: ['Records were edited in Spool after this import.', 'Native edit conflict; previous imported targets preserved.'],
 import_superseded: ['Undo a newer import that holds these records first.'],
 job_timestamps_not_recorded: ['This installation did not record import job transition times.'],
 key_metadata_not_provided: ['The trusted key configuration provides no name or creation date.'],
 snapshot_withdrawn: ['Erasure withdrew the private source snapshot.'],
 record_label_unavailable: ['The source supplies no safe readable label for this record.'],
 organization_unavailable: ['The retained source supplies no safe organization name.'],
 record_not_importable: ['This record cannot be represented in Spool.'],
 invalid_project_name: ['The project has no valid name.', 'Invalid project name'],
 invalid_timestamp: ['A required source timestamp is missing or invalid.', 'Source timestamp required', 'Event detail timestamp required'],
 issue_project_unavailable: ['The issue belongs to a missing or rejected project.', 'Issue project is missing or rejected'],
 event_project_unavailable: ['The event belongs to a missing or rejected project.', 'Event project is missing or rejected'],
 event_issue_unavailable: ['The event belongs to a missing or rejected issue.', 'Event issue is missing or rejected'],
 invalid_issue_title: ['The issue has no valid title.', 'Invalid issue title'],
 unsupported_issue_state: ['Spool cannot represent this issue state.', 'Unsupported source issue state'],
 reversed_issue_times: ['The issue ends before it begins.', 'Issue timestamps are reversed'],
 invalid_release: ['The release has no valid version.', 'Invalid release'],
 release_projects_required: ['The release names no projects.', 'Release project membership required'],
 release_project_unavailable: ['The release belongs to a missing or rejected project.', 'Release project is missing or rejected', 'Release project missing'],
 multiple_distributions: ['Spool cannot represent multiple distributions of one release.', 'Multiple distributions for one release are outside the native release contract'],
 event_release_unavailable: ['The event release is missing from the export.', 'Event release missing from export'],
 event_detail_required: ['The event has no supported exception detail.', 'Event detail entries required', 'Exception event detail required', 'Event unavailable'],
 event_stack_required: ['The event has no supported stack locations.', 'Event detail stack required'],
 conflicting_environment: ['The event names conflicting environments.', 'Conflicting exported environment'],
 invalid_source_reference: ['A required source reference is missing or invalid.', 'Invalid issue id', 'Invalid event groupID', 'Invalid release project', 'Source project missing'],
} as const;

export type ReadReasonCode = keyof typeof definitions;
export const importReadReasons = Object.fromEntries(Object.entries(definitions).map(([code, [label]]) => [code, label]));
export function rejectionReasonCode(reason: string): ReadReasonCode {
 for (const [code, [, ...messages]] of Object.entries(definitions)) {
  if (messages.some(message => message === reason)) return code as ReadReasonCode;
 }
 return 'record_not_importable';
}
export const unknownJobTimes = () => ({createdAt:null, appliedAt:null, undoneAt:null, timestampsReasonCode:'job_timestamps_not_recorded' as const});
