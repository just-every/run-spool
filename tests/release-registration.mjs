import assert from 'node:assert/strict';
import {expect} from '@playwright/test';

export async function registerReleaseAndReturn({page,origin,project,name,build,api,capture=async()=>{}}) {
 const form=page.getByRole('heading',{name:'Register a release',exact:true}).locator('..').locator('form');
 await form.getByLabel('Release name',{exact:true}).fill(name);
 await form.getByLabel('Build identifier',{exact:true}).fill(build);
 await form.getByRole('button',{name:'Register release',exact:true}).click();
 await expect(form.getByRole('status')).toContainText(name);
 await expect(form.getByLabel('Release name',{exact:true})).toHaveValue('');
 await expect(form.getByLabel('Build identifier',{exact:true})).toHaveValue('');
 assert.ok((await api(`/api/projects/${project}/releases`)).some(row=>row.name===name&&row.build===build),'confirmation follows the real saved release');
 const button=form.getByRole('button',{name:'Register release',exact:true}),confirmation=form.getByRole('status');
 await button.scrollIntoViewIfNeeded();
 const [action,message]=await Promise.all([button.boundingBox(),confirmation.boundingBox()]);
 assert.ok(action&&message&&message.y>=action.y+action.height&&message.y-action.y<180,'confirmation is beside the submit action');
 await expect(confirmation).toBeInViewport();
 await capture('release-registered');
 await form.getByRole('link',{name:'Return to capture test',exact:true}).click();
 await expect(page).toHaveURL(origin+`/projects/${project}/capture`);
 await expect(page.getByRole('combobox',{name:'Registered release',exact:true})).toHaveValue(name);
 await expect(page.getByRole('button',{name:'Capture test exception',exact:true})).toBeEnabled();
}
