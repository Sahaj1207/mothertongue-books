-- Tap-to-learn objects per page: {"1": [{"english": "red kite", "words": {"te": "గాలిపటం"}, "box": [x1, y1, x2, y2]}]}
alter table public.books add column words jsonb not null default '{}';
