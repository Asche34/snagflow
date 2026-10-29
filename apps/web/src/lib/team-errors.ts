export function teamError(message: string): string {
  if (message.includes('PERMISSION')) return 'You no longer have permission to manage this team.';
  if (message.includes('TEAM_ACCOUNT'))
    return 'No active, confirmed account matches that email. An administrator can invite a new account.';
  if (message.includes('MEMBER_EXISTS'))
    return 'This person is already on the project. Change their role in the roster.';
  if (message.includes('TEAM_MISSING'))
    return 'This person is no longer on the project. Refresh the team.';
  if (message.includes('INVITE_EXISTING'))
    return 'An account already exists for this email. Use Add member instead.';
  if (message.includes('INVITE_PENDING'))
    return 'A pending invitation already exists. Retry it or cancel it before sending another.';
  if (message.includes('INVITE_DETAILS'))
    return 'This pending invitation cannot be changed or resent by this account. Cancel it and create a new invitation.';
  if (message.includes('INVITE_INVALID') || message.includes('INVITE_USED'))
    return 'This invitation is unavailable, expired, or belongs to another account.';
  return 'The team could not be updated. Refresh, check your access and try again.';
}
