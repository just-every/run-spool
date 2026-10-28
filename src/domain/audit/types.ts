export const actorKinds = ['owner','member','agent','deploy','ingest','service','anonymous','unknown'] as const;
export type ActorKind = typeof actorKinds[number];
export type AuditActor = { kind: ActorKind; label: string };
export const subjectKinds = ['installation','project','credential','issue','policy','release','artifact','correction','destination','rule','delivery','repair','reproducer','run','workflow','feedback','import','erasure','identity','session','audit','unknown'] as const;
export type SubjectKind = typeof subjectKinds[number];
export const auditActions = [
 'organization.create','member.invite','member.change','member.remove','member.transfer','team.change','service.create','service.credential','service.remove','billing.read',
 'review.views','retention.policy','retention.hold','retention.scheduled','identity.preview','identity.policy','project.create','credential.create','credential.revoke','credential.loader','checkin.route','issue.suspect','origin.change','issue.triage','issue.assign','issue.bulk_triage','suppression.change',
 'grouping.propose','grouping.proposals','grouping.approve','grouping.reject','grouping.preview','grouping.apply','grouping.undo','grouping.policy','filter.preview','filter.change','release.preview','release.policy','release.register','commit.sharing','artifact.upload',
 'evidence.packet','evidence.export','archive.export','archive.restore','retention.preview_or_apply','erasure.preview','erasure.start','erasure.resume','owner.erasure','owner.successor',
 'alert.destination.create','alert.destination.change','alert.destination.test','alert.rule.preview','alert.rule.create','alert.rule.change','alert.delivery.resolve','alert.digest.settings','alert.snooze','notification.attempt','automation.follow_up',
 'repair.create','repair.check','repair.fact','reproducer.create','reproducer.queue','reproducer.read','reproducer.finish','fix.propose','fix.approve','fix.advance','fix.provider_step',
 'feedback.withdraw','import.upload','import.plan','import.apply','import.status','import.reconcile','import.undo','import.resume','import.originals','import.settings','import.archive','import.restore_check','cutover.status',
 'auth.bootstrap','auth.claim','auth.magic_link','auth.confirm','auth.owner_signin','auth.one_click','auth.review_session','auth.signout','auth.invite','auth.invite_cancel','auth.operator_status','auth.operator_role','auth.session_revoke','auth.step_up','auth.domain_rule','auth.provider_unlink','auth.provider_relink','auth.identity_settings','auth.setup_complete','auth.email','auth.display_name','auth.oidc','auth.dependency',
 'deployment.start','deployment.callback','deployment.timeout','cli.chunk','cli.assemble','cli.release','cli.deploy','cli.debug_files','cli.read','cli.unsupported','erasure.complete','capture.native','capture.sentry','capture.otlp','capture.exposure','audit.read','audit.export','private.action',
] as const;
export type AuditAction = typeof auditActions[number];
export const outcomes = ['succeeded','accepted','suppressed','denied','conflict','invalid','failed','uncertain','started'] as const;
export type AuditOutcome = typeof outcomes[number];
export const sources = ['request','transaction','service','legacy'] as const;
export type AuditFact = {
 id?: string; created?: number; source: typeof sources[number]; actor: AuditActor; action: AuditAction;
 subject: { kind: SubjectKind; label: string }; projectLabel?: string | null; outcome: AuditOutcome; status?: number | null;
};
export type AuditRow = {
 sequence: number; id: string; created: number; source: typeof sources[number]; actor_kind: ActorKind; actor_label: string;
 action: AuditAction; subject_kind: SubjectKind; subject_label: string; project_label: string | null; outcome: AuditOutcome; status: number | null;
};
export const safeAlias = (value: unknown): value is string => typeof value === 'string' && /^audit:[a-f0-9]{32}$/.test(value);
