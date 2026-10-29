-- Combined-field full-text search without widening row access or adding a definer RPC.
alter table public.snags add column search_document tsvector
  generated always as (
    to_tsvector('english'::regconfig, coalesce(title, '') || ' ' || coalesce(description, ''))
  ) stored;

create index snags_search_document_idx on public.snags using gin (search_document);
notify pgrst, 'reload schema';
