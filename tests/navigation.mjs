// Phone widths fold the workbench navigation behind one Menu button; open it
// only when it is folded and closed, then return the named destination link.
export async function workbenchLink(page,name,exact=true){
 const menu=page.getByRole('button',{name:/^Menu/});
 if(page.viewportSize().width<=760&&await menu.getAttribute('aria-expanded')!=='true')await menu.click();
 return page.getByRole('navigation',{name:'Workbench'}).getByRole('link',{name,exact});
}
// A record page folds each long-tail section into one row; open it in place before reading or using its controls.
export async function openSection(scope,name){
 const button=scope.getByRole('heading',{name,exact:true}).getByRole('button',{name,exact:true});
 if(await button.getAttribute('aria-expanded')!=='true')await button.click();
}
// Icon-only controls are allowed only inside the shared tooltip, named by the same words the tip shows.
export const untippedIconButtons=page=>page.locator('button').evaluateAll(nodes=>nodes.filter(n=>n.getClientRects().length&&!n.textContent.trim()&&!(n.parentElement?.classList.contains('tip')&&n.getAttribute('aria-label'))).map(n=>n.getAttribute('aria-label')));
// Settings has one path per section; its section list folds into one control at phone width.
export async function settingsSection(page,name){
 const toggle=page.locator('.settings-toggle');
 if(await toggle.isVisible()&&await toggle.getAttribute('aria-expanded')!=='true')await toggle.click();
 await page.getByRole('navigation',{name:'Settings sections'}).getByRole('link',{name,exact:true}).click();
}
