// Match Wrangler's resolveAssetOptions/buildAssetOptions V4 Miniflare inputs.
// Miniflare owns disk-backed assets, routing, and the public HTTP listener.
export function miniflareAssets(config) {
 return {
  directory:config.assets.directory,
  binding:config.assets.binding,
  run_worker_first:config.assets.run_worker_first,
  routerConfig:{has_user_worker:config.main!==undefined},
  assetConfig:{
   html_handling:config.assets.html_handling,
   not_found_handling:config.assets.not_found_handling
  }
 };
}
