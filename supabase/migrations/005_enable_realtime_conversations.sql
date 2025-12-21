-- =============================================
-- Enable Realtime for Conversation Participants
-- Run this in Supabase SQL Editor
-- =============================================

-- Add conversation_participants table to the realtime publication
-- This enables realtime updates when users are added to conversations
ALTER PUBLICATION supabase_realtime ADD TABLE public.conversation_participants;

-- Also add conversations table for completeness
ALTER PUBLICATION supabase_realtime ADD TABLE public.conversations;

-- =============================================
-- IMPORTANT: Verify in Supabase Dashboard
-- =============================================
-- 1. Go to Database > Replication in Supabase Dashboard
-- 2. Under "supabase_realtime" publication, ensure:
--    - conversation_participants table is checked
--    - conversations table is checked
-- =============================================
