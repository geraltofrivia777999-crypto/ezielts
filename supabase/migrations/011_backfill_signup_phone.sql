-- Backfill phone numbers collected during signup but not copied into profiles.

update public.profiles p
set
  phone = nullif(u.raw_user_meta_data->>'phone', ''),
  updated_at = now()
from auth.users u
where p.id = u.id
  and nullif(u.raw_user_meta_data->>'phone', '') is not null
  and (p.phone is null or btrim(p.phone) = '');
