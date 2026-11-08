import { generateMigrationEvidence } from '@runeditrun/rer/portability-evidence';

// The direct Worker harnesses consume the same real checkout evidence as Vite.
export const migrationEvidence = {
 name: 'migration-evidence',
 setup(build) {
  build.onResolve({filter: /^virtual:rer-legacy-migration-evidence$/}, () => ({path: 'history', namespace: 'migration-evidence'}));
  build.onLoad({filter: /.*/, namespace: 'migration-evidence'}, async () => ({
   loader: 'js', contents: `export default ${JSON.stringify(await generateMigrationEvidence(process.cwd()))};`,
  }));
 },
};
