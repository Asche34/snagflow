# Project snag filters and search

Continue main `6072b8f`, preserving Fieldwork and completed capture behavior.
The user delegated routine design and implementation decisions and requested verification,
commit and push to main; no additional design approval is required.

## Behavior

Project Snags gets a labeled GET form: search, status, priority, assignee (including
unassigned/me), location, category, due date (overdue/today/next seven days/no date),
created by me, and sort (number ascending/descending, priority, due date, newest).
Filters combine with AND. Search uses English web-style full-text search over combined
title/description; a bare number or #number selects the project snag number.
Overdue and upcoming views exclude closed snags. Dates use the web server calendar,
as existing web due-date rendering does. Locations match the exact selected location.

URL parameters preserve results on refresh/back/forward and section navigation. Apply
resets pagination. Clear resets filters and sort. Invalid/repeated enum/UUID values
normalize safely; unknown project options yield no matches rather than widened results.
Show exact result counts, a useful empty state, and previous/next pages (50 rows).
Keep whole-project statistics independent of filtering, without the workspace 1,000-row cap.
Query failures must show an error, never an empty-success state.

## Approach

Client filtering was rejected because workspace reads are capped. Unindexed per-column
search avoids schema changes but has poorer combined-field semantics and scaling.
Chosen: authenticated Supabase queries with RLS, a generated combined tsvector and GIN
index in migration 12, strict URL normalization, deterministic ordering and server pagination.
No new dependency, RPC, permission rule, bulk action, saved-filter database entity, view
switcher, project/team management or unrelated capture change.

## UI and validation

Reuse existing native Select/Input/Button, forest/orange tokens, visible labels and
44px targets. Responsive grid, keyboard-operable GET form, result heading and clear link.
Real Supabase browser tests cover combined filters, URL round trips, search across both
fields, number search, malformed parameters, dates, pagination beyond 1,000 and RLS.
Inspect 375px/1440px and enlarged text. Run touched-package gates, existing browser suites,
database tests, generated type/index checks, and a fresh independent final review.
