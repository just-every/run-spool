export const artifactStorageTables = { artifact_storage_settings: ['project','artifact_storage_cap','revision','updated'] };
export function validateArtifactStorage(data: any) {
 for(const row of data.artifact_storage_settings) if((row.artifact_storage_cap!==null&&(!Number.isSafeInteger(row.artifact_storage_cap)||row.artifact_storage_cap<0))||!Number.isSafeInteger(row.revision)||row.revision<1||!Number.isSafeInteger(row.updated)||row.updated<0)throw new Error('Archive artifact storage setting');
}
