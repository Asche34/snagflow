-- Originals, flattened images and report revisions are append-only bytes.
-- UUID uploads may be retried by checking the completed object; clients never
-- overwrite or delete an existing object. Service-side orphan cleanup is deferred.
-- Removing DELETE also closes cleanup-vs-registration races without relying on
-- a snapshot-sensitive NOT EXISTS policy.
drop policy snag_photos_update on storage.objects;
drop policy snag_photos_delete on storage.objects;
drop policy reports_cleanup on storage.objects;
