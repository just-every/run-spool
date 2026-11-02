import { all, canonicalJson, insist, quote, chunks } from './sql.mjs';
import { matching } from './plan.mjs';

/** Every foreign key between two deleted tables, grouped per constraint. Schema
 * only: it never reads a row, so a later step can use it without a plan. */
export async function foreignKeyLinks(db, d) {
  const links = [];
  for (const table of d.deleted) {
    const groups = new Map();
    for (const fk of await all(db, `PRAGMA foreign_key_list(${quote(table)})`)) {
      if (!groups.has(fk.id)) groups.set(fk.id, []);
      groups.get(fk.id).push(fk);
    }
    for (const group of groups.values()) {
      const parentTable = d.deleted.find(name => name.toLowerCase() === group[0].table.toLowerCase());
      if (parentTable) links.push({ table, parentTable, group });
    }
  }
  return links;
}

/** Topological row order across every path, not the depth of the first visit.
 * Actual FK links also constrain order, even if a row was reached by another edge. */
export async function deletionOrder(db, d, plan) {
  const id = e => e.table + '\0' + canonicalJson(e.key);
  const selected = plan.entries.filter(e => d.deleted.includes(e.table));
  const entries = new Map(selected.map(e => [id(e), e]));
  const children = new Map(selected.map(e => [id(e), new Set()]));
  const link = (parent, child) => {
    if (id(parent) !== id(child) && children.has(id(parent)) && entries.has(id(child))) children.get(id(parent)).add(id(child));
  };
  for (const edge of d.edges) {
    const keys = plan.keys.get(edge.table).pk;
    const edgeParents = [...plan.rows.get(edge.from).values()];
    if (edge.on) {
      const pairs = Object.entries(edge.on);
      for (const part of chunks(edgeParents, 200)) {
        // Drive indexed child lookups from the parent page, retaining which
        // parent each child belongs to without a query for every parent.
        const found = await all(db, `SELECT j.key AS parent_index,${keys.map((c, i) => `c.${quote(c)} AS child_${i}`).join(',')} FROM json_each(?) j CROSS JOIN ${quote(edge.table)} c WHERE ${pairs.map(([child], i) => `c.${quote(child)}=json_extract(j.value,'$[${i}]')`).join(' AND ')}`, JSON.stringify(part.map(parent => pairs.map(([, column]) => parent.row[column]))));
        for (const row of found) {
          const child = entries.get(edge.table + '\0' + canonicalJson(Object.fromEntries(keys.map((c, i) => [c, row[`child_${i}`]]))));
          if (child) link(part[Number(row.parent_index)], child);
        }
      }
    } else for (const parent of edgeParents) {
      for (const row of await matching(db, edge, [parent.row], keys.map(c => c === 'rowid' ? 'rowid AS rowid' : quote(c)).join(','))) {
        const child = entries.get(edge.table + '\0' + canonicalJson(Object.fromEntries(keys.map(c => [c, row[c]]))));
        if (child) link(parent, child);
      }
    }
  }
  plan.foreignKeys = await foreignKeyLinks(db, d);
  for (const { table, parentTable, group } of plan.foreignKeys) {
    const parentKeys = plan.keys.get(parentTable).pk, cols = plan.keys.get(table).pk;
    for (const part of chunks([...plan.rows.get(parentTable).values()], 200)) {
      // Read the actual join: FK columns need not be part of a declared edge's projection.
      const found = await all(db, `SELECT j.key AS parent_index,${cols.map((c, i) => `c.${quote(c)} AS child_${i}`).join(',')} FROM json_each(?) j CROSS JOIN ${quote(parentTable)} p CROSS JOIN ${quote(table)} c WHERE ${parentKeys.map((c, i) => `p.${quote(c)}=json_extract(j.value,'$[${i}]')`).join(' AND ')} AND ${group.map(f => `c.${quote(f.from)}=p.${quote(f.to || parentKeys[f.seq])}`).join(' AND ')}`, JSON.stringify(part.map(parent => parentKeys.map(c => parent.key[c]))));
      for (const row of found) {
        const child = entries.get(table + '\0' + canonicalJson(Object.fromEntries(cols.map((c, i) => [c, row[`child_${i}`]]))));
        insist(child, `unreached_dependent:${table}:${parentTable}`, 409);
        link(part[Number(row.parent_index)], child);
      }
    }
  }
  const remaining = new Map([...children].map(([key, deps]) => [key, deps.size]));
  const parents = new Map(selected.map(e => [id(e), []]));
  for (const [parent, deps] of children) for (const child of deps) parents.get(child).push(parent);
  const queue = [...remaining].filter(([, n]) => n === 0).map(([key]) => key), result = [];
  for (let i = 0; i < queue.length; i++) {
    const key = queue[i]; result.push(entries.get(key));
    for (const parent of parents.get(key)) { remaining.set(parent, remaining.get(parent) - 1); if (remaining.get(parent) === 0) queue.push(parent); }
  }
  insist(result.length === entries.size, 'cyclic_deletion_graph', 409);
  return result.filter(e => e !== plan.root);
}
