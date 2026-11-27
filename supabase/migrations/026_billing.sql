-- Stripe billing state on users.
--
-- The Stripe webhook (service role) is the only writer: it re-fetches the
-- subscription from Stripe and sets these columns plus users.tier.
--
-- The "Users can update own profile" policy (001) covers every column, so the
-- guard trigger from 025 is widened: a signed-in user changing their own
-- stripe_customer_id could otherwise open another customer's billing portal.

alter table public.users
  add column if not exists stripe_customer_id text,
  add column if not exists stripe_subscription_id text,
  add column if not exists subscription_status text,
  add column if not exists current_period_end timestamptz;

create unique index if not exists idx_users_stripe_customer
  on public.users(stripe_customer_id)
  where stripe_customer_id is not null;

create or replace function public.guard_user_tier_change()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if coalesce(auth.role(), '') in ('authenticated', 'anon') and (
       new.tier is distinct from old.tier
    or new.stripe_customer_id is distinct from old.stripe_customer_id
    or new.stripe_subscription_id is distinct from old.stripe_subscription_id
    or new.subscription_status is distinct from old.subscription_status
    or new.current_period_end is distinct from old.current_period_end
  ) then
    raise exception 'plan and billing fields can only be changed by the service role'
      using errcode = '42501';
  end if;
  return new;
end;
$$;
