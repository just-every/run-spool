// Agent and deploy keys belong to the person whose session minted them. They count only while that
// person is active at the identity fence (oa_operators.version) recorded at minting: a fence from the
// linked Auth install or a suspension moves the version, so they never count again, and nothing comes
// back when the person is restored. SQL condition for a `credentials` lookup.
export const mintedByCurrentPerson = "EXISTS(SELECT 1 FROM oa_operators o WHERE o.id=credentials.minted_by AND o.version=credentials.minted_version AND o.status='active')";
