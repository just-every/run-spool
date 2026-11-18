export function identityMessage(failure: unknown) {
 const code = failure instanceof Error ? failure.message : '';
 return ({
  step_up_required: 'Sign in again to verify your identity, then finish changing your details.',
  email_in_use: 'That email is already used by another account. Choose another email.',
  email_not_allowed: 'That email is not allowed for this installation. Choose an allowed email.',
  invalid_email: 'Enter your email address.',
  invalid_display_name: 'Enter your name, using up to 120 characters.',
  unauthenticated: 'Sign in again to change your details.',
 } as Record<string, string>)[code] ?? 'Your details could not be saved. Please try again.';
}
