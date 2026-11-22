alter table public.reminders
add column if not exists delivered_at timestamptz;

create unique index if not exists reminders_one_pending_per_memory
on public.reminders(memory_id)
where not completed;

create index if not exists reminders_pending_due_idx
on public.reminders(user_id, remind_at)
where not completed;

update public.memories
set memory_type = 'place'
where memory_type = 'location';

update public.memories
set memory_type = 'fact'
where memory_type = 'general';

alter table public.memories
alter column memory_type drop default;

alter table public.memories
drop constraint if exists memories_memory_type_check;

alter table public.memories
add constraint memories_memory_type_check
check (memory_type in ('event', 'person', 'place', 'task', 'fact'));
