export type RefusalTarget={kind:'rule'|'sensitive'|'safe';ruleId?:string;field?:string};
export class ScrubbingRefusal extends Error {
 constructor(code:string,public target?:RefusalTarget){super(code)}
}
export const refusalCode=(error:unknown)=>error instanceof Error?error.message:'invalid_scrubbing_policy';
export function refusalMessage(code:string,target?:RefusalTarget):string {
 const field=target?.field??'This field';
 const messages:Record<string,string>={
 invalid_scrubbing_policy:'Choose a valid scrubbing policy and preview again.',
 scrubbing_field_limit:'Use at most 40 sensitive and safe fields in total.',
 invalid_scrubbing_field:'Enter a field name or selector, such as $tags.tenant.',
 scrubbing_rule_limit:'Use at most 20 custom scrubbing rules.',
 invalid_scrubbing_rule:'Choose a selector, pattern and method for this rule.',
 regex_required:'Enter a regular expression for this rule.',
 regex_not_allowed:'Choose Custom regular expression before entering an expression.',
 replacement_required:'Enter replacement text of at most 256 characters.',
 replacement_not_allowed:'Choose Replace before entering replacement text.',
 project_safe_conflicts_with_installation:`${field} is protected for every project by the installation; a project safe field cannot unmask it.`,
 project_rule_conflicts_with_installation:'The installation protects this selector; edit the installation rule instead.',
 regex_too_long:'Use an expression of at most 256 characters.',
 regex_backreference:'Backreferences are not supported; match the text directly.',
 regex_lookaround:'Lookarounds are not supported; match the text directly.',
 regex_quantified_group:'Repeating groups are not supported; repeat one character or character class.',
 regex_nested_quantifier:'Use only one repeat on each character or character class.',
 regex_large_repeat:'Use a repeat bound of at most 999.',
 regex_groups_not_supported:'Groups are not supported; match characters without parentheses.',
 regex_multiple_quantifiers:'Use at most one variable repeat in the expression.',
 regex_quantifier_requires_anchors:'A repeat needs ^ and $ around the whole expression, for example ^acme-[0-9]+$.',
 regex_ambiguous_quantifier:'Use a repeat without alternatives.',
 regex_invalid:'Check the expression’s syntax and preview again.',
 scrubbing_text_limit:'A retained field exceeds the preview text limit; narrow this rule’s selector.',
 };
 return messages[code]??'Scrubbing could not be previewed. Check the draft and try again.';
}
