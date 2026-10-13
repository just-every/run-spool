// The optional identity link (Base dependencies, migrations 0020-0024) adds two
// archived tables: the installation's sector and its link, which an export marks
// as needing re-link. Archives made before them restore with both empty.
export const linkArchiveTables = ['rer_dependency_installation', 'rer_dependency_link'];
export const linkMigrations = ['0020_dependencies.sql', '0021_dependency_approval.sql', '0022_dependency_setup.sql', '0023_idp_owner.sql', '0024_identity_providers.sql'];
export const emptyLinkTables = () => Object.fromEntries(linkArchiveTables.map(table => [table, [] as any[]]));
