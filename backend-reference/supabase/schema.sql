-- 서초손잡이 Supabase schema (connected-mode foundation)
-- Apply in the Supabase SQL editor. Never expose service_role to the browser.

create extension if not exists pgcrypto;

create type public.app_role as enum ('senior', 'volunteer', 'partner', 'admin');
create type public.request_status as enum ('open', 'awaiting_schedule', 'matched', 'in_progress', 'awaiting_confirmation', 'completed', 'cancelled');
create type public.point_transaction_type as enum ('earn', 'redeem');

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  nickname text not null check (char_length(nickname) between 1 and 30),
  role public.app_role not null default 'senior',
  neighborhood text not null check (neighborhood in ('방배동','양재동','반포동','서초동','내곡동','잠원동')),
  preferred_categories text[] not null default '{}',
  created_at timestamptz not null default now()
);

create table public.help_requests (
  id uuid primary key default gen_random_uuid(),
  senior_id uuid not null references public.profiles(id) on delete restrict,
  created_by uuid not null references public.profiles(id) on delete restrict,
  created_by_role public.app_role not null default 'senior',
  elder_consent boolean not null default false,
  title text not null check (char_length(title) between 5 and 80),
  description text not null check (char_length(description) between 5 and 240),
  category text not null check (category in ('스마트폰 사용 도움','키오스크 이용 연습','복지관 프로그램 안내','가벼운 물품 운반','공공장소 이동·길 안내','기타 생활 도움')),
  neighborhood text not null check (neighborhood in ('방배동','양재동','반포동','서초동','내곡동','잠원동')),
  requested_date date not null,
  requested_time text not null,
  date_preference text not null default 'specific' check (date_preference in ('earliest','this_week','next_week','specific','flexible')),
  specific_date date,
  time_window text not null default 'flexible' check (time_window in ('morning','afternoon','evening','flexible')),
  estimated_minutes integer not null check (estimated_minutes in (30,45,60)),
  status public.request_status not null default 'open',
  created_at timestamptz not null default now()
);

create table public.schedule_proposals (
  id uuid primary key default gen_random_uuid(),
  request_id uuid not null references public.help_requests(id) on delete cascade,
  volunteer_id uuid not null references public.profiles(id) on delete restrict,
  proposed_start_at timestamptz not null,
  proposed_end_at timestamptz not null,
  status text not null default 'pending' check (status in ('pending','accepted','rejected','withdrawn')),
  created_at timestamptz not null default now(),
  check (proposed_end_at > proposed_start_at),
  unique (request_id, volunteer_id, proposed_start_at)
);

create table public.matches (
  id uuid primary key default gen_random_uuid(),
  request_id uuid not null unique references public.help_requests(id) on delete cascade,
  volunteer_id uuid not null references public.profiles(id) on delete restrict,
  confirmed_start_at timestamptz not null,
  confirmed_end_at timestamptz not null,
  confirmed_at timestamptz not null default now(),
  status text not null default 'matched' check (status in ('matched','cancelled')),
  matched_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  unique (request_id, volunteer_id)
);

create table public.activities (
  id uuid primary key default gen_random_uuid(),
  match_id uuid not null unique references public.matches(id) on delete cascade,
  started_at timestamptz,
  ended_at timestamptz,
  duration_minutes integer check (duration_minutes is null or duration_minutes > 0),
  elder_confirmed_at timestamptz,
  confirmed_by uuid references public.profiles(id) on delete restrict,
  confirmed_by_role public.app_role,
  status public.request_status not null default 'matched',
  created_at timestamptz not null default now()
);

create table public.rewards (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  description text not null default '',
  required_points integer not null check (required_points > 0),
  is_demo boolean not null default true,
  created_at timestamptz not null default now()
);

create table public.point_transactions (
  id uuid primary key default gen_random_uuid(),
  volunteer_id uuid not null references public.profiles(id) on delete restrict,
  activity_id uuid references public.activities(id) on delete restrict,
  reward_id uuid references public.rewards(id) on delete restrict,
  amount integer not null check (amount > 0),
  transaction_type public.point_transaction_type not null,
  title text not null,
  created_at timestamptz not null default now(),
  check ((transaction_type = 'earn' and activity_id is not null and reward_id is null)
      or (transaction_type = 'redeem' and activity_id is null and reward_id is not null))
);
create unique index point_transactions_one_earn_per_activity
  on public.point_transactions(activity_id) where transaction_type = 'earn';

create table public.reward_redemptions (
  id uuid primary key default gen_random_uuid(),
  volunteer_id uuid not null references public.profiles(id) on delete restrict,
  reward_id uuid not null references public.rewards(id) on delete restrict,
  points_spent integer not null check (points_spent > 0),
  created_at timestamptz not null default now()
);

create table public.reports (
  id uuid primary key default gen_random_uuid(),
  reporter_id uuid not null references public.profiles(id) on delete restrict,
  request_id uuid not null references public.help_requests(id) on delete cascade,
  reason text not null check (char_length(reason) between 1 and 300),
  status text not null default '접수' check (status in ('접수','확인 중','처리 완료')),
  created_at timestamptz not null default now()
);

create or replace function public.handle_new_auth_user()
returns trigger language plpgsql security definer set search_path = public as $$
declare v_role public.app_role; v_neighborhood text;
begin
  v_role := case when new.raw_user_meta_data->>'role' in ('volunteer','partner') then (new.raw_user_meta_data->>'role')::public.app_role else 'senior'::public.app_role end;
  v_neighborhood := case when new.raw_user_meta_data->>'neighborhood' in ('방배동','양재동','반포동','서초동','내곡동','잠원동') then new.raw_user_meta_data->>'neighborhood' else '서초동' end;
  insert into public.profiles(id,nickname,role,neighborhood)
  values(new.id, left(coalesce(nullif(new.raw_user_meta_data->>'nickname',''), '손잡이 이웃'),30), v_role, v_neighborhood);
  return new;
end; $$;

create trigger on_auth_user_created_profile
  after insert on auth.users for each row execute function public.handle_new_auth_user();

create index help_requests_open_recommendation on public.help_requests(status, neighborhood, requested_date);
create index schedule_proposals_request_status on public.schedule_proposals(request_id, status, proposed_start_at);
create index schedule_proposals_volunteer_status on public.schedule_proposals(volunteer_id, status);
create index matches_volunteer_status on public.matches(volunteer_id, status);
create index activities_status_created on public.activities(status, created_at desc);
create index point_transactions_volunteer_created on public.point_transactions(volunteer_id, created_at desc);

alter table public.profiles enable row level security;
alter table public.help_requests enable row level security;
alter table public.schedule_proposals enable row level security;
alter table public.matches enable row level security;
alter table public.activities enable row level security;
alter table public.rewards enable row level security;
alter table public.point_transactions enable row level security;
alter table public.reward_redemptions enable row level security;
alter table public.reports enable row level security;

create or replace function public.current_app_role()
returns public.app_role language sql stable security definer set search_path = public as $$
  select role from public.profiles where id=auth.uid();
$$;

create or replace function public.is_request_owner(p_request_id uuid, p_user_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists(select 1 from public.help_requests where id=p_request_id and senior_id=p_user_id);
$$;

create or replace function public.is_request_volunteer(p_request_id uuid, p_user_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists(select 1 from public.matches where request_id=p_request_id and volunteer_id=p_user_id and status='matched');
$$;

create or replace function public.can_view_profile(p_profile_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists(
    select 1 from public.matches m join public.help_requests r on r.id=m.request_id
    where m.status='matched' and ((m.volunteer_id=auth.uid() and r.senior_id=p_profile_id)
      or (r.senior_id=auth.uid() and m.volunteer_id=p_profile_id)
      or (r.created_by=auth.uid() and r.senior_id=p_profile_id))
    union all
    select 1 from public.schedule_proposals s join public.help_requests r on r.id=s.request_id
    where s.status='pending' and ((s.volunteer_id=auth.uid() and r.senior_id=p_profile_id) or (r.senior_id=auth.uid() and s.volunteer_id=p_profile_id))
    union all
    select 1 from public.help_requests r where r.created_by=auth.uid() and r.senior_id=p_profile_id and r.elder_consent
  );
$$;

create or replace function public.can_view_activity(p_match_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists(select 1 from public.matches m join public.help_requests r on r.id=m.request_id
    where m.id=p_match_id and (m.volunteer_id=auth.uid() or r.senior_id=auth.uid() or r.created_by=auth.uid()));
$$;

create policy "profiles read self or admin" on public.profiles for select to authenticated
  using (id = auth.uid() or public.can_view_profile(id) or public.current_app_role() in ('partner','admin'));
create policy "profiles update self" on public.profiles for update to authenticated
  using (id = auth.uid()) with check (id = auth.uid());
revoke update on public.profiles from authenticated;
grant update (nickname, neighborhood, preferred_categories) on public.profiles to authenticated;

-- Requests contain no street address or contact details. Open cards only expose neighborhood-level fields.
create policy "requests visible to community" on public.help_requests for select to authenticated
  using (status in ('open','awaiting_schedule') or senior_id = auth.uid() or created_by = auth.uid() or public.is_request_volunteer(id,auth.uid()) or public.current_app_role() = 'admin');
create policy "senior or consented partner creates request" on public.help_requests for insert to authenticated
  with check (
    (senior_id = auth.uid() and created_by = auth.uid() and created_by_role = 'senior' and elder_consent = false and exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'senior'))
    or (created_by = auth.uid() and created_by_role = 'partner' and elder_consent = true and exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'partner') and exists (select 1 from public.profiles s where s.id = senior_id and s.role = 'senior'))
  );
create policy "proposal parties read" on public.schedule_proposals for select to authenticated
  using (volunteer_id = auth.uid() or exists (select 1 from public.help_requests r where r.id=request_id and (r.senior_id=auth.uid() or r.created_by=auth.uid())) or public.current_app_role()='admin');
create policy "match parties and admin read" on public.matches for select to authenticated
  using (volunteer_id = auth.uid() or public.is_request_owner(request_id,auth.uid()) or exists(select 1 from public.help_requests r where r.id=request_id and r.created_by=auth.uid()) or public.current_app_role() = 'admin');
create policy "activity parties and admin read" on public.activities for select to authenticated
  using (public.can_view_activity(match_id) or public.current_app_role() = 'admin');
create policy "demo rewards visible" on public.rewards for select to authenticated using (is_demo = true);
create policy "own point history" on public.point_transactions for select to authenticated using (volunteer_id = auth.uid() or public.current_app_role() = 'admin');
create policy "own redemptions" on public.reward_redemptions for select to authenticated using (volunteer_id = auth.uid());
create policy "reporter and admin read" on public.reports for select to authenticated
  using (reporter_id = auth.uid() or public.current_app_role() = 'admin');
create policy "authenticated report insert" on public.reports for insert to authenticated
  with check (reporter_id = auth.uid() and exists (
    select 1 from public.help_requests r where r.id=request_id and
      (r.status in ('open','awaiting_schedule') or r.senior_id=auth.uid() or r.created_by=auth.uid() or public.is_request_volunteer(r.id,auth.uid()))
  ));

grant select on public.profiles, public.help_requests, public.schedule_proposals, public.matches, public.activities,
  public.rewards, public.point_transactions, public.reward_redemptions, public.reports to authenticated;
grant insert on public.help_requests, public.reports to authenticated;

create or replace function public.submit_schedule_proposals(p_request_id uuid, p_proposals jsonb)
returns uuid[] language plpgsql security definer set search_path = public as $$
declare
  v_request public.help_requests%rowtype;
  v_item jsonb;
  v_start timestamptz;
  v_end timestamptz;
  v_local_date date;
  v_local_time time;
  v_today date := (now() at time zone 'Asia/Seoul')::date;
  v_next_monday date;
  v_ids uuid[] := '{}';
  v_id uuid;
begin
  if not exists (select 1 from public.profiles where id=auth.uid() and role='volunteer') then raise exception 'volunteer role required'; end if;
  perform 1 from public.profiles where id=auth.uid() for update;
  if jsonb_typeof(p_proposals) <> 'array' or jsonb_array_length(p_proposals) not between 1 and 2 then raise exception 'one or two proposals are required'; end if;
  select * into v_request from public.help_requests where id=p_request_id for update;
  if not found or v_request.status not in ('open','awaiting_schedule') then raise exception 'request is no longer available'; end if;
  v_next_monday := date_trunc('week', v_today::timestamp)::date + 7;

  for v_item in select value from jsonb_array_elements(p_proposals) loop
    begin
      v_start := (v_item->>'proposed_start_at')::timestamptz;
      v_end := (v_item->>'proposed_end_at')::timestamptz;
    exception when others then raise exception 'proposal datetime is invalid';
    end;
    if v_start <= now() or v_end <= v_start or v_end - v_start > interval '2 hours' then raise exception 'proposal must be a future time of up to two hours'; end if;
    v_local_date := (v_start at time zone 'Asia/Seoul')::date;
    v_local_time := (v_start at time zone 'Asia/Seoul')::time;
    if v_request.date_preference='specific' and v_local_date <> v_request.specific_date then raise exception 'proposal does not match the requested date'; end if;
    if v_request.date_preference='this_week' and (v_local_date < v_today or v_local_date > date_trunc('week', v_today::timestamp)::date + 6) then raise exception 'proposal does not match this week'; end if;
    if v_request.date_preference='next_week' and (v_local_date < v_next_monday or v_local_date > v_next_monday + 6) then raise exception 'proposal does not match next week'; end if;
    if v_request.time_window='morning' and (v_local_time < time '09:00' or v_local_time >= time '12:00') then raise exception 'proposal does not match morning availability'; end if;
    if v_request.time_window='afternoon' and (v_local_time < time '12:00' or v_local_time >= time '18:00') then raise exception 'proposal does not match afternoon availability'; end if;
    if v_request.time_window='evening' and (v_local_time < time '18:00' or v_local_time >= time '21:00') then raise exception 'proposal does not match evening availability'; end if;
    if exists (select 1 from public.matches m where m.volunteer_id=auth.uid() and m.status='matched' and m.confirmed_start_at < v_end and m.confirmed_end_at > v_start) then raise exception 'volunteer already has an activity at that time'; end if;
    insert into public.schedule_proposals(request_id,volunteer_id,proposed_start_at,proposed_end_at)
      values(p_request_id,auth.uid(),v_start,v_end) returning id into v_id;
    v_ids := array_append(v_ids,v_id);
  end loop;
  update public.help_requests set status='awaiting_schedule' where id=p_request_id and status in ('open','awaiting_schedule');
  return v_ids;
end; $$;

create or replace function public.respond_schedule_proposal(p_proposal_id uuid, p_accept boolean)
returns uuid language plpgsql security definer set search_path = public as $$
declare
  v_proposal public.schedule_proposals%rowtype;
  v_request public.help_requests%rowtype;
  v_match_id uuid;
  v_activity_id uuid;
begin
  select r.* into v_request from public.help_requests r join public.schedule_proposals s on s.request_id=r.id where s.id=p_proposal_id for update of r;
  if not found then raise exception 'schedule proposal not found'; end if;
  select * into v_proposal from public.schedule_proposals where id=p_proposal_id for update;
  if v_proposal.status <> 'pending' or v_request.status <> 'awaiting_schedule' then raise exception 'schedule proposal is already handled'; end if;
  if not (
    (v_request.senior_id=auth.uid() and exists(select 1 from public.profiles where id=auth.uid() and role='senior'))
    or (v_request.created_by=auth.uid() and v_request.created_by_role='partner' and v_request.elder_consent=true and exists(select 1 from public.profiles where id=auth.uid() and role='partner'))
  ) then raise exception 'senior or consented partner role required'; end if;
  if p_accept then
    if v_proposal.proposed_start_at <= now() then raise exception 'proposal time has passed'; end if;
    perform 1 from public.profiles where id=v_proposal.volunteer_id for update;
    if exists (select 1 from public.matches m where m.volunteer_id=v_proposal.volunteer_id and m.status='matched' and m.confirmed_start_at < v_proposal.proposed_end_at and m.confirmed_end_at > v_proposal.proposed_start_at) then raise exception 'volunteer already has an activity at that time'; end if;
    update public.schedule_proposals set status='accepted' where id=p_proposal_id;
    update public.schedule_proposals set status='rejected' where request_id=v_request.id and id<>p_proposal_id and status='pending';
    insert into public.matches(request_id,volunteer_id,confirmed_start_at,confirmed_end_at)
      values(v_request.id,v_proposal.volunteer_id,v_proposal.proposed_start_at,v_proposal.proposed_end_at) returning id into v_match_id;
    insert into public.activities(match_id,status) values(v_match_id,'matched') returning id into v_activity_id;
    update public.help_requests set status='matched', requested_date=(v_proposal.proposed_start_at at time zone 'Asia/Seoul')::date,
      requested_time=to_char(v_proposal.proposed_start_at at time zone 'Asia/Seoul','HH24:MI') where id=v_request.id;
    return v_activity_id;
  end if;
  update public.schedule_proposals set status='rejected' where id=p_proposal_id;
  if not exists(select 1 from public.schedule_proposals where request_id=v_request.id and status='pending') then
    update public.help_requests set status='open' where id=v_request.id and status='awaiting_schedule';
  end if;
  return null;
end; $$;

create or replace function public.start_activity(p_activity_id uuid)
returns void language plpgsql security definer set search_path = public as $$
declare v_request_id uuid;
begin
  update public.activities a set status='in_progress', started_at=now()
  from public.matches m where a.id=p_activity_id and m.id=a.match_id and m.volunteer_id=auth.uid() and a.status='matched'
  returning m.request_id into v_request_id;
  if not found then raise exception 'activity cannot be started by this user'; end if;
  update public.help_requests set status='in_progress' where id=v_request_id and status='matched';
end; $$;

create or replace function public.cancel_help_request(p_request_id uuid)
returns void language plpgsql security definer set search_path = public as $$
begin
  update public.help_requests set status='cancelled'
    where id=p_request_id and (senior_id=auth.uid() or (created_by=auth.uid() and created_by_role='partner' and elder_consent=true)) and status in ('open','awaiting_schedule','matched');
  if not found then raise exception 'request cannot be cancelled by this user'; end if;
  update public.schedule_proposals set status='withdrawn' where request_id=p_request_id and status='pending';
  update public.matches set status='cancelled' where request_id=p_request_id and status='matched';
  update public.activities a set status='cancelled' from public.matches m where m.request_id=p_request_id and a.match_id=m.id and a.status='matched';
end; $$;

create or replace function public.finish_activity(p_activity_id uuid)
returns void language plpgsql security definer set search_path = public as $$
declare v_request_id uuid;
begin
  update public.activities a set status='awaiting_confirmation', ended_at=now(),
    duration_minutes=greatest(1, floor(extract(epoch from (now()-a.started_at))/60)::integer)
  from public.matches m where a.id=p_activity_id and m.id=a.match_id and m.volunteer_id=auth.uid()
    and a.status='in_progress' and a.started_at is not null
  returning m.request_id into v_request_id;
  if not found then raise exception 'activity cannot be finished by this user'; end if;
  update public.help_requests set status='awaiting_confirmation' where id=v_request_id and status='in_progress';
end; $$;

create or replace function public.confirm_activity(p_activity_id uuid)
returns integer language plpgsql security definer set search_path = public as $$
declare
  v_senior_id uuid; v_created_by uuid; v_created_by_role public.app_role; v_elder_consent boolean;
  v_volunteer_id uuid; v_request_id uuid; v_duration integer;
  v_earned_today integer; v_points integer;
begin
  select r.senior_id, r.created_by, r.created_by_role, r.elder_consent, m.volunteer_id, m.request_id, a.duration_minutes
    into v_senior_id, v_created_by, v_created_by_role, v_elder_consent, v_volunteer_id, v_request_id, v_duration
  from public.activities a join public.matches m on m.id=a.match_id
  join public.help_requests r on r.id=m.request_id
  where a.id=p_activity_id and a.status='awaiting_confirmation' for update of a;
  if not found or not (
    (v_senior_id=auth.uid() and exists(select 1 from public.profiles where id=auth.uid() and role='senior'))
    or (v_created_by=auth.uid() and v_created_by_role='partner' and v_elder_consent=true and exists(select 1 from public.profiles where id=auth.uid() and role='partner'))
  ) then raise exception 'activity cannot be confirmed by this user'; end if;
  perform 1 from public.profiles where id=v_volunteer_id for update;
  v_points := case when coalesce(v_duration,0)<30 then 50 else floor(v_duration/30.0)::integer*100 end;
  select coalesce(sum(amount),0) into v_earned_today from public.point_transactions
    where volunteer_id=v_volunteer_id and transaction_type='earn' and (created_at at time zone 'Asia/Seoul')::date=(now() at time zone 'Asia/Seoul')::date;
  v_points := greatest(0, least(v_points,600-v_earned_today));
  update public.activities set status='completed', elder_confirmed_at=now(), confirmed_by=auth.uid(), confirmed_by_role=(select role from public.profiles where id=auth.uid()) where id=p_activity_id;
  update public.help_requests set status='completed' where id=v_request_id and status='awaiting_confirmation';
  if v_points > 0 then
    insert into public.point_transactions(volunteer_id,activity_id,amount,transaction_type,title)
      values(v_volunteer_id,p_activity_id,v_points,'earn','활동 확인 포인트');
  end if;
  return v_points;
end; $$;

create or replace function public.redeem_reward(p_reward_id uuid)
returns uuid language plpgsql security definer set search_path = public as $$
declare v_reward public.rewards%rowtype; v_balance integer; v_redemption_id uuid;
begin
  perform 1 from public.profiles where id=auth.uid() and role='volunteer' for update;
  if not found then raise exception 'volunteer role required'; end if;
  select * into v_reward from public.rewards where id=p_reward_id and is_demo=true;
  if not found then raise exception 'demo reward not found'; end if;
  select coalesce(sum(case when transaction_type='earn' then amount else -amount end),0)
    into v_balance from public.point_transactions where volunteer_id=auth.uid();
  if v_balance < v_reward.required_points then raise exception 'not enough points'; end if;
  insert into public.reward_redemptions(volunteer_id,reward_id,points_spent)
    values(auth.uid(),v_reward.id,v_reward.required_points) returning id into v_redemption_id;
  insert into public.point_transactions(volunteer_id,reward_id,amount,transaction_type,title)
    values(auth.uid(),v_reward.id,v_reward.required_points,'redeem',v_reward.title);
  return v_redemption_id;
end; $$;

drop function if exists public.match_help_request(uuid);
revoke all on function public.start_activity(uuid) from public;
revoke all on function public.finish_activity(uuid) from public;
revoke all on function public.confirm_activity(uuid) from public;
revoke all on function public.redeem_reward(uuid) from public;
revoke all on function public.cancel_help_request(uuid) from public;
revoke all on function public.submit_schedule_proposals(uuid,jsonb) from public;
revoke all on function public.respond_schedule_proposal(uuid,boolean) from public;
grant execute on function public.cancel_help_request(uuid) to authenticated;
grant execute on function public.submit_schedule_proposals(uuid,jsonb) to authenticated;
grant execute on function public.respond_schedule_proposal(uuid,boolean) to authenticated;
grant execute on function public.start_activity(uuid) to authenticated;
grant execute on function public.finish_activity(uuid) to authenticated;
grant execute on function public.confirm_activity(uuid) to authenticated;
grant execute on function public.redeem_reward(uuid) to authenticated;

insert into public.rewards(id,title,description,required_points,is_demo) values
  ('00000000-0000-4000-8000-000000000001','가상 제휴 카페 1,000원 할인','시연용 가상 혜택입니다.',500,true),
  ('00000000-0000-4000-8000-000000000002','가상 제휴 식당 2,000원 할인','시연용 가상 혜택입니다.',1000,true),
  ('00000000-0000-4000-8000-000000000003','가상 문화 프로그램 할인','시연용 가상 혜택입니다.',1200,true)
on conflict (id) do nothing;
