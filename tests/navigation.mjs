// Phone widths fold the workbench navigation behind one Menu button; open it
// only when it is folded and closed, then return the named destination link.
export async function workbenchLink(page,name,exact=true){
 const menu=page.getByRole('button',{name:/^Menu/});
 if(page.viewportSize().width<=760&&await menu.getAttribute('aria-expanded')!=='true')await menu.click();
 return page.getByRole('navigation',{name:'Workbench'}).getByRole('link',{name,exact});
}
