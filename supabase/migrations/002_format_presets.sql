-- format_presets: shared community library of file column mappings.
-- Keyed by header_signature (sorted, lowercase, pipe-delimited headers).
-- A signature uniquely identifies a file's column structure regardless of bank name.
create table if not exists format_presets (
  id             uuid default gen_random_uuid() primary key,
  header_sig     text not null unique,         -- getFileSignature() output
  sample_headers text[] not null,              -- actual headers (for human readability)
  mapping        jsonb not null,               -- FileMapping object
  status         text not null default 'pending'  -- 'pending' | 'verified' | 'rejected'
                   check (status in ('pending', 'verified', 'rejected')),
  successful_imports int not null default 0,   -- incremented on each confirmed success
  failed_imports     int not null default 0,   -- incremented on each confirmed failure
  created_by     uuid references auth.users(id) on delete set null,
  promoted_by    uuid references auth.users(id) on delete set null,
  created_at     timestamptz default now(),
  updated_at     timestamptz default now()
);

-- Anyone can read verified presets (for import detection).
-- Authenticated users can insert new pending presets (contributing their format).
-- Only admins can update status (via service role in Edge Functions / admin panel).
alter table format_presets enable row level security;

create policy "public read verified presets"
  on format_presets for select
  using (status = 'verified');

-- Admin can read all presets (pending, verified, rejected) for review
create policy "admin read all presets"
  on format_presets for select
  using (is_admin());

create policy "authenticated users submit presets"
  on format_presets for insert
  to authenticated
  with check (status = 'pending');

-- Admin can update preset status (verify / reject)
create policy "admin update presets"
  on format_presets for update
  to authenticated
  using (is_admin())
  with check (is_admin());

-- Index for fast signature lookup
create index if not exists idx_format_presets_sig on format_presets(header_sig);

-- Auto-promote pending presets that reach 3 confirmed successes
create or replace function increment_format_success(p_sig text)
returns void language plpgsql security definer as $$
begin
  update format_presets
  set
    successful_imports = successful_imports + 1,
    updated_at = now(),
    status = case
      when status = 'pending' and (successful_imports + 1) >= 3 then 'verified'
      else status
    end
  where header_sig = p_sig;
end;
$$;

create or replace function increment_format_failure(p_sig text)
returns void language plpgsql security definer as $$
begin
  update format_presets
  set
    failed_imports = failed_imports + 1,
    updated_at = now()
  where header_sig = p_sig;
end;
$$;
