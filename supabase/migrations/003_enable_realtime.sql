-- =============================================
-- Enable Realtime for Messages
-- Run this in Supabase SQL Editor AFTER 002_rls_policies.sql
-- =============================================

-- Add the messages table to the realtime publication
-- This is what makes Supabase Realtime work for messages
ALTER PUBLICATION supabase_realtime ADD TABLE public.messages;

-- Optionally, also add message_receipts for read receipt updates
ALTER PUBLICATION supabase_realtime ADD TABLE public.message_receipts;

-- =============================================
-- IMPORTANT: Also enable Realtime in Supabase Dashboard
-- =============================================
-- 1. Go to Database > Replication in Supabase Dashboard
-- 2. Under "supabase_realtime" publication, ensure:
--    - messages table is checked
--    - message_receipts table is checked (optional)
-- 
-- OR use the API settings:
-- 1. Go to Database > Tables
-- 2. Click on "messages" table
-- 3. Enable "Realtime" toggle
-- =============================================
