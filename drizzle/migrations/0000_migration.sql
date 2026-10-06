create table public.profiles (
  id uuid primary key,
  display_name text,
  avatar_url text,
  household text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
grant select, insert, update on public.profiles to authenticated;
grant all on public.profiles to service_role;
alter table public.profiles enable row level security;
create policy "own profile read" on public.profiles for select to authenticated using (auth.uid() = id);
create policy "own profile insert" on public.profiles for insert to authenticated with check (auth.uid() = id);
create policy "own profile update" on public.profiles for update to authenticated using (auth.uid() = id);

create or replace function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, display_name, avatar_url)
  values (new.id, coalesce(new.raw_user_meta_data->>'full_name', new.raw_user_meta_data->>'name', split_part(new.email,'@',1)), new.raw_user_meta_data->>'avatar_url')
  on conflict (id) do nothing;
  return new;
end; $$;
revoke execute on function public.handle_new_user() from public, anon, authenticated;
create trigger on_auth_user_created after insert on auth.users for each row execute function public.handle_new_user();

create table public.home_items (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid(),
  section text not null,
  title text not null check (char_length(title) between 1 and 200),
  subtitle text not null default '',
  fields jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now()
);
create index home_items_user_section on public.home_items(user_id, section);
grant select, insert, update, delete on public.home_items to authenticated;
grant all on public.home_items to service_role;
alter table public.home_items enable row level security;
create policy "own items select" on public.home_items for select to authenticated using (auth.uid() = user_id);
create policy "own items insert" on public.home_items for insert to authenticated with check (auth.uid() = user_id);
create policy "own items update" on public.home_items for update to authenticated using (auth.uid() = user_id);
create policy "own items delete" on public.home_items for delete to authenticated using (auth.uid() = user_id);