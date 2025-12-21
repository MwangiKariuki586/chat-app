-- =============================================
-- Add soft delete columns to conversation_participants
-- Run this in Supabase SQL Editor
-- =============================================

-- left_at: When null, user is active in conversation. When set, user has left.
-- visible_from: Messages created before this timestamp are hidden from the user.
--               Used for "fresh start" when rejoining.

ALTER TABLE public.conversation_participants 
ADD COLUMN IF NOT EXISTS left_at TIMESTAMPTZ DEFAULT NULL;

ALTER TABLE public.conversation_participants 
ADD COLUMN IF NOT EXISTS visible_from TIMESTAMPTZ DEFAULT NULL;

-- Set visible_from to joined_at for existing participants (show all messages)
UPDATE public.conversation_participants 
SET visible_from = joined_at 
WHERE visible_from IS NULL;

-- Make visible_from NOT NULL going forward with default of now()
ALTER TABLE public.conversation_participants 
ALTER COLUMN visible_from SET DEFAULT now();

-- Add index for faster queries
CREATE INDEX IF NOT EXISTS idx_participants_left_at 
ON public.conversation_participants(user_id, left_at);

COMMENT ON COLUMN public.conversation_participants.left_at IS 
'When the user left/deleted the conversation. NULL means active.';

COMMENT ON COLUMN public.conversation_participants.visible_from IS 
'Messages before this timestamp are hidden. Used for fresh start on rejoin.';
