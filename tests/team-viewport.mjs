import assert from 'node:assert/strict';
import {expect} from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

export async function teamViewportProof(page,name) {
 assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),true,name+' reflow');
 assert.deepEqual((await new AxeBuilder({page}).withTags(['wcag2a','wcag2aa','wcag21aa']).analyze()).violations.map(item=>item.id),[],name+' accessibility');
}

export async function teamKeyboardDetails(page,title,observe) {
 const trigger=page.getByRole('button',{name:'Details: '+title,exact:true});
 await trigger.focus();await page.keyboard.press('Enter');
 const dialog=page.getByRole('dialog');await expect(dialog).toBeVisible();
 assert.ok(await dialog.evaluate(element=>element.contains(document.activeElement)),'Details receives keyboard focus');
 await page.keyboard.press('Shift+Tab');
 assert.ok(await dialog.evaluate(element=>element.contains(document.activeElement)),'Details contains keyboard focus');
 await page.keyboard.press('Tab');
 assert.ok(await dialog.evaluate(element=>element.contains(document.activeElement)),'forward Tab wraps within Details');
 await observe();
 await page.keyboard.press('Escape');await expect(dialog).not.toBeVisible();await expect(trigger).toBeFocused();
}
