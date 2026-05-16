-- Support normalized full Listening tests where one listening_tests row
-- contains four section-level question groups.

alter table public.listening_question_groups
  add column if not exists section_number int check (section_number between 1 and 4);

create index if not exists idx_listening_groups_test_section_sort
  on public.listening_question_groups(test_id, section_number, sort_order);
