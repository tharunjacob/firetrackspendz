-- user_settings: generic per-user key/value store for Goals, Budgets, preferences, etc.
create table if not exists user_settings (
  user_id    uuid references auth.users(id) on delete cascade,
  key        text not null,
  value      jsonb,
  updated_at timestamptz default now(),
  primary key (user_id, key)
);

alter table user_settings enable row level security;

create policy "users manage own settings"
  on user_settings
  for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);
