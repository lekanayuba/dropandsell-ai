---
name: Account-deletion authorization
description: How non-admin-triggered account deletions must be authorized in this app
---

# Non-admin account deletion must derive the target server-side

When a normal (non-admin) user action can delete *another* user account — e.g. the
Profile "delete conflicting account so I can reuse its email" flow
(`POST /api/user/profile/delete-conflicting`) — the endpoint must NOT accept a
client-supplied account id to delete.

**Rule:** derive the target account server-side from proof the caller legitimately
owns the action (here: the new email they are claiming) AND re-verify their password
with bcrypt, then look up the victim via `getUserByEmail(email)` and delete only that
row. Reject if it resolves to the caller's own id.

**Why:** the first restore accepted `{conflictingAccountId}` from the body and called
`deleteSubscriber(id)` with no ownership/admin check — an IDOR letting any logged-in
user delete arbitrary accounts by id. Code review flagged it as critical.

**How to apply:** any future "delete/merge conflicting account" or similar
user-triggered destructive action on another user must derive the target id from
re-verified server-side facts, never trust an id passed by the client. Admin-only
deletion endpoints still gate on `role === 'admin' || email === '<founder email>'`.
