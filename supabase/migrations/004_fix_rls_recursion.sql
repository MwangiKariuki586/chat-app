-- =============================================
-- FIX: SECURITY DEFINER function to break circular dependency
-- This is the industry-standard PostgreSQL pattern
-- Run this in Supabase SQL Editor
-- =============================================

-- Step 1: Create helper function
-- This function checks if a user is a participant in a conversation
-- SECURITY DEFINER runs as the function owner, bypassing RLS
-- This breaks the circular dependency

CREATE OR REPLACE FUNCTION public.is_conversation_member(
  check_conversation_id UUID,
  check_user_id UUID DEFAULT auth.uid()
)
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 
    FROM public.conversation_participants 
    WHERE conversation_id = check_conversation_id 
    AND user_id = check_user_id
  );
$$;

-- Step 2: Drop ALL problematic policies
DROP POLICY IF EXISTS "Users can view their conversations" ON public.conversations;
DROP POLICY IF EXISTS "Users can view participants in their conversations" ON public.conversation_participants;
DROP POLICY IF EXISTS "Users can view messages in their conversations" ON public.messages;
DROP POLICY IF EXISTS "Users can send messages as themselves" ON public.messages;
DROP POLICY IF EXISTS "Users can view receipts in their conversations" ON public.message_receipts;

-- Step 3: Recreate policies using the helper function

-- CONVERSATIONS
CREATE POLICY "Users can view their conversations"
  ON public.conversations FOR SELECT
  TO authenticated
  USING (
    public.is_conversation_member(id)
  );

-- CONVERSATION PARTICIPANTS
CREATE POLICY "Users can view participants in their conversations"
  ON public.conversation_participants FOR SELECT
  TO authenticated
  USING (
    public.is_conversation_member(conversation_id)
  );

-- MESSAGES
CREATE POLICY "Users can view messages in their conversations"
  ON public.messages FOR SELECT
  TO authenticated
  USING (
    public.is_conversation_member(conversation_id)
  );

CREATE POLICY "Users can send messages as themselves"
  ON public.messages FOR INSERT
  TO authenticated
  WITH CHECK (
    sender_id = auth.uid() AND
    public.is_conversation_member(conversation_id)
  );

-- MESSAGE RECEIPTS
CREATE POLICY "Users can view receipts in their conversations"
  ON public.message_receipts FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.messages m
      WHERE m.id = message_receipts.message_id
      AND public.is_conversation_member(m.conversation_id)
    )
  );

-- =============================================
-- Summary of what this does:
-- =============================================
-- 1. is_conversation_member() - A trusted function that checks membership
--    - Runs as function owner (bypasses RLS)
--    - Called by all policies that need to check membership
--    - Single source of truth for "is user in this conversation?"
--
-- 2. All policies now use this function instead of direct queries
--    - No more circular dependencies
--    - Consistent security across all tables
--    - Easy to audit and maintain
-- =============================================
