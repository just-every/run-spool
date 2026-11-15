/** Archive metadata is untrusted input; only counts reach the ordinary preview. */
export function ArchivePreview({manifest,empty}:{manifest:any;empty:boolean}) {
 const counts=new Map<string,number>();
 if(manifest.kind==='manifest')for(const table of manifest.tables??[])if(typeof table.name==='string'&&Number.isSafeInteger(table.count)&&table.count>=0)counts.set(table.name,table.count);
 if(manifest.kind!=='manifest')for(const [name,rows] of Object.entries(manifest.data??{}))if(Array.isArray(rows))counts.set(name,rows.length);
 const categories=[['Projects','projects'],['Issues','issues'],['Events','events'],['Private source maps','artifacts']] as const;
 const listed=new Set<string>(categories.map(([,key])=>key));
 const other=[...counts].filter(([key])=>!listed.has(key)).reduce((total,[,count])=>total+count,0);
 return <div><h3>Contents</h3><dl>{categories.map(([label,key])=><div key={key}><dt>{label}</dt><dd>{counts.get(key)??0}</dd></div>)}<div><dt>Other saved records</dt><dd>{other}</dd></div></dl>
 <p>Includes private source maps and saved project data. Owner sessions and project credential grants are excluded. Create fresh keys after restoring.</p>
 <p>{empty?'Ready for server validation in this empty installation.':'Restore is unavailable while this installation contains data.'} Selecting a file does not verify its integrity. The server validates the complete archive before restoring.</p></div>;
}
