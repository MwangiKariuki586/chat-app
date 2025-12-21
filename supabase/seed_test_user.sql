-- Run this in Supabase SQL Editor to create a test user
-- (This creates a user profile, not an auth account)

INSERT INTO public.users (id, email, name, avatar_url)
VALUES (
  gen_random_uuid(),
  'testuser@example.com',
  'Test User',
  null
)
ON CONFLICT DO NOTHING;

-- Verify users exist
SELECT * FROM public.users;
