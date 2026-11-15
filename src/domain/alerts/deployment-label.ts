/** Stable public routing alias: never derived from a label, address or member. */
export function deploymentLabel(id:string) {
 let value=2166136261;
 for(const char of id)value=Math.imul(value^char.charCodeAt(0),16777619)>>>0;
 const trees=['Cedar','Maple','Willow','Aspen','Birch','Pine','Elm','Oak'];
 return `Email route ${trees[value%trees.length]} ${value.toString(16).padStart(8,'0').toUpperCase()}`;
}
