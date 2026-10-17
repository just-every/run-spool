import type { RepositorySourceLink } from '../../domain/repository-links';

const reasons = {
 deployment_unavailable: 'No deployment manifest for this release, build and environment.',
 repository_unsupported: 'The recorded repository cannot provide a supported exact-revision link.',
 mapping_unavailable: 'No explicit repository path mapping is recorded.',
 mapping_invalid: 'The recorded repository path mapping is invalid.',
 path_unmatched: 'This source path does not match a recorded mapping.',
 original_source_unavailable: 'Original source coordinates are unavailable.',
 unsafe_source_path: 'This source path cannot safely identify a repository file.',
 historical_source_unverified: 'Imported historical source has no verified deployment association.',
};

export function RepositorySource({ source }: { source?: RepositorySourceLink }) {
 if (!source || source.status === 'unmapped') return <span className="repository-source metadata" title={source ? reasons[source.reason] : 'Repository source evidence is unavailable.'}>Repository: unmapped. {source ? reasons[source.reason] : 'Repository source evidence is unavailable.'}</span>;
 return <span className="repository-source"><a href={source.url} target="_blank" rel="noopener noreferrer" title={`${source.path}:${source.line} at ${source.commitSha}`}>View recorded source</a><span className="metadata"> · Owner/deploy-recorded; repository and file unverified</span></span>;
}
