-- Pitik initial schema.
--
-- Design notes
--   * Ids are client-generated UUIDs. Records exist on the device before they
--     ever reach the server, so the server must accept the id it is given
--     rather than minting its own.
--   * Every table is soft-deleted (`deleted_at`) so a deletion made offline can
--     still propagate when the device reconnects.
--   * Row Level Security is on for every table with no exceptions, and the
--     policies are written against a single membership helper so there is one
--     place to audit "who can see this roll".

create extension if not exists "pgcrypto";

-- ---------------------------------------------------------------- profiles

create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  display_name text check (char_length(display_name) <= 60),
  created_at timestamptz not null default now()
);

comment on table public.profiles is
  'Public-facing name for a user. Deliberately minimal: Pitik has no social graph.';

-- Populate a profile row whenever a user signs up.
create function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, display_name)
  values (new.id, nullif(new.raw_user_meta_data ->> 'display_name', ''))
  on conflict (id) do nothing;
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ------------------------------------------------------------------- rolls

create table public.rolls (
  id uuid primary key,
  owner_id uuid not null references auth.users (id) on delete cascade,
  title text not null check (char_length(title) between 1 and 120),
  emoji text check (char_length(emoji) <= 8),
  cover_style text not null default 'envelope'
    check (cover_style in ('envelope', 'contact', 'sleeve', 'polaroid')),
  mode text not null default 'standard' check (mode in ('standard', 'disposable')),
  shot_limit integer check (shot_limit between 1 and 200),
  reveal_at timestamptz,
  developed_at timestamptz,
  -- Unique so a code can be resolved to exactly one roll; null until shared.
  share_code text unique check (share_code ~ '^[A-Z0-9]{6}$'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create index rolls_owner_idx on public.rolls (owner_id, updated_at desc);
create index rolls_share_code_idx on public.rolls (share_code) where share_code is not null;

-- --------------------------------------------------------- roll membership

create table public.roll_members (
  roll_id uuid not null references public.rolls (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  role text not null default 'contributor' check (role in ('owner', 'contributor')),
  joined_at timestamptz not null default now(),
  primary key (roll_id, user_id)
);

create index roll_members_user_idx on public.roll_members (user_id);

-- The owner is always a member, so every policy can be expressed as membership.
create function public.add_owner_as_member()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.roll_members (roll_id, user_id, role)
  values (new.id, new.owner_id, 'owner')
  on conflict do nothing;
  return new;
end;
$$;

create trigger on_roll_created
  after insert on public.rolls
  for each row execute function public.add_owner_as_member();

/*
 * Membership test used by every policy below.
 *
 * SECURITY DEFINER is required and safe here: the policies on `roll_members`
 * would otherwise recurse into themselves when checking access to a roll. The
 * function reads one row by primary key and returns a boolean, so it cannot be
 * used to exfiltrate anything beyond the answer to the question asked.
 */
create function public.is_roll_member(target_roll uuid)
returns boolean
language sql
security definer
stable
set search_path = ''
as $$
  select exists (
    select 1
    from public.roll_members m
    where m.roll_id = target_roll
      and m.user_id = (select auth.uid())
  );
$$;

-- ---------------------------------------------------------------- captures

create table public.captures (
  id uuid primary key,
  roll_id uuid not null references public.rolls (id) on delete cascade,
  author_id uuid not null references auth.users (id) on delete cascade,
  -- Path within the private `captures` bucket, always prefixed with the
  -- author's user id so storage policies can be path-based.
  storage_path text not null,
  width integer not null check (width > 0),
  height integer not null check (height > 0),
  filter_id text not null,
  profile_id text not null,
  aspect text not null,
  source text not null default 'camera' check (source in ('camera', 'booth', 'import')),
  favorite boolean not null default false,
  taken_at timestamptz not null,
  created_at timestamptz not null default now(),
  deleted_at timestamptz
);

create index captures_roll_idx on public.captures (roll_id, taken_at);

-- ------------------------------------------------------------------ strips

create table public.strips (
  id uuid primary key,
  roll_id uuid not null references public.rolls (id) on delete cascade,
  author_id uuid not null references auth.users (id) on delete cascade,
  template_id text not null,
  storage_path text not null,
  width integer not null check (width > 0),
  height integer not null check (height > 0),
  caption text check (char_length(caption) <= 120),
  created_at timestamptz not null default now(),
  deleted_at timestamptz
);

create index strips_roll_idx on public.strips (roll_id, created_at desc);

-- ------------------------------------------------------------ join by code

/*
 * Redeems a share code.
 *
 * SECURITY DEFINER because the caller is by definition not yet a member and so
 * cannot see the roll to look it up. It grants only 'contributor', only for a
 * roll that is live and actually has that code, and returns the roll id so the
 * client can start syncing.
 */
create function public.join_roll_by_code(code text)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  target uuid;
begin
  if (select auth.uid()) is null then
    raise exception 'You must be signed in to join a roll.';
  end if;

  select r.id into target
  from public.rolls r
  where r.share_code = upper(code)
    and r.deleted_at is null;

  if target is null then
    raise exception 'That code does not match a roll.';
  end if;

  insert into public.roll_members (roll_id, user_id, role)
  values (target, (select auth.uid()), 'contributor')
  on conflict do nothing;

  return target;
end;
$$;

revoke all on function public.join_roll_by_code(text) from public;
grant execute on function public.join_roll_by_code(text) to authenticated;

-- ----------------------------------------------------- row level security

alter table public.profiles enable row level security;
alter table public.rolls enable row level security;
alter table public.roll_members enable row level security;
alter table public.captures enable row level security;
alter table public.strips enable row level security;

-- Profiles: you can read the profile of anyone you share a roll with, so
-- contributors have names; you can only write your own.
create policy "profiles are readable by co-members"
  on public.profiles for select
  to authenticated
  using (
    id = (select auth.uid())
    or exists (
      select 1
      from public.roll_members mine
      join public.roll_members theirs on theirs.roll_id = mine.roll_id
      where mine.user_id = (select auth.uid())
        and theirs.user_id = profiles.id
    )
  );

create policy "users update their own profile"
  on public.profiles for update
  to authenticated
  using (id = (select auth.uid()))
  with check (id = (select auth.uid()));

-- Rolls: members read; only the owner writes structure.
create policy "members read rolls"
  on public.rolls for select
  to authenticated
  using (public.is_roll_member(id));

create policy "users create their own rolls"
  on public.rolls for insert
  to authenticated
  with check (owner_id = (select auth.uid()));

create policy "owners update their rolls"
  on public.rolls for update
  to authenticated
  using (owner_id = (select auth.uid()))
  with check (owner_id = (select auth.uid()));

create policy "owners delete their rolls"
  on public.rolls for delete
  to authenticated
  using (owner_id = (select auth.uid()));

-- Membership: you can see who else is on a roll you're on, and you can remove
-- yourself. Adding members happens only through join_roll_by_code.
create policy "members read the member list"
  on public.roll_members for select
  to authenticated
  using (public.is_roll_member(roll_id));

create policy "members can leave"
  on public.roll_members for delete
  to authenticated
  using (user_id = (select auth.uid()));

-- Captures: any member reads; you may only insert photos you took, into a roll
-- you belong to; you may only change or remove your own.
create policy "members read captures"
  on public.captures for select
  to authenticated
  using (public.is_roll_member(roll_id));

create policy "members add their own captures"
  on public.captures for insert
  to authenticated
  with check (author_id = (select auth.uid()) and public.is_roll_member(roll_id));

create policy "authors update their captures"
  on public.captures for update
  to authenticated
  using (author_id = (select auth.uid()))
  with check (author_id = (select auth.uid()));

create policy "authors delete their captures"
  on public.captures for delete
  to authenticated
  using (author_id = (select auth.uid()));

create policy "members read strips"
  on public.strips for select
  to authenticated
  using (public.is_roll_member(roll_id));

create policy "members add their own strips"
  on public.strips for insert
  to authenticated
  with check (author_id = (select auth.uid()) and public.is_roll_member(roll_id));

create policy "authors delete their strips"
  on public.strips for delete
  to authenticated
  using (author_id = (select auth.uid()));

-- ------------------------------------------------------------- storage

-- Private bucket. Photos are only ever reachable through a signed URL minted
-- for a user who passed the policies below.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'captures',
  'captures',
  false,
  26214400, -- 25 MB; comfortably above a full-resolution graded JPEG
  array['image/jpeg', 'image/png', 'image/webp']
)
on conflict (id) do nothing;

/*
 * Object paths are `<user_id>/<roll_id>/<capture_id>.jpg`.
 *
 * Writes are checked against the first path segment, which ties every object to
 * the user who uploaded it and makes a forged path impossible. Reads are
 * checked against the second segment, so co-members of a roll can see each
 * other's photos without being able to browse anything else.
 */
create policy "users upload into their own folder"
  on storage.objects for insert
  to authenticated
  with check (
    bucket_id = 'captures'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );

create policy "users replace their own objects"
  on storage.objects for update
  to authenticated
  using (
    bucket_id = 'captures'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );

create policy "users delete their own objects"
  on storage.objects for delete
  to authenticated
  using (
    bucket_id = 'captures'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );

create policy "roll members read roll objects"
  on storage.objects for select
  to authenticated
  using (
    bucket_id = 'captures'
    and (
      (storage.foldername(name))[1] = (select auth.uid())::text
      or public.is_roll_member(((storage.foldername(name))[2])::uuid)
    )
  );
