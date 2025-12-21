-- =============================================
-- Row Level Security Policies
-- CRITICAL for Supabase Realtime to work!
-- Run this in Supabase SQL Editor AFTER 001_schema.sql
-- =============================================

-- Enable RLS on all tables
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.conversation_participants ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.message_receipts ENABLE ROW LEVEL SECURITY;

-- =============================================
-- USERS POLICIES
-- =============================================

-- Users can view all users (for searching/displaying names)
CREATE POLICY "Users can view all users"
  ON public.users FOR SELECT
  TO authenticated
  USING (true);

-- Users can update their own profile
CREATE POLICY "Users can update own profile"
  ON public.users FOR UPDATE
  TO authenticated
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

-- Users can insert their own profile (on signup)
CREATE POLICY "Users can insert own profile"
  ON public.users FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = id);

-- =============================================
-- CONVERSATIONS POLICIES
-- =============================================

-- Users can view conversations they're part of
CREATE POLICY "Users can view their conversations"
  ON public.conversations FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.conversation_participants
      WHERE conversation_id = conversations.id
      AND user_id = auth.uid()
    )
  );

-- Users can create conversations
CREATE POLICY "Users can create conversations"
  ON public.conversations FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- =============================================
-- CONVERSATION PARTICIPANTS POLICIES
-- =============================================

-- Users can view participants in their conversations
CREATE POLICY "Users can view participants in their conversations"
  ON public.conversation_participants FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.conversation_participants cp
      WHERE cp.conversation_id = conversation_participants.conversation_id
      AND cp.user_id = auth.uid()
    )
  );

-- Users can add participants (to create conversations)
CREATE POLICY "Users can add participants"
  ON public.conversation_participants FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- =============================================
-- MESSAGES POLICIES
-- =============================================

-- Users can view messages in their conversations
CREATE POLICY "Users can view messages in their conversations"
  ON public.messages FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.conversation_participants
      WHERE conversation_id = messages.conversation_id
      AND user_id = auth.uid()
    )
  );

-- Users can send messages as themselves
CREATE POLICY "Users can send messages as themselves"
  ON public.messages FOR INSERT
  TO authenticated
  WITH CHECK (
    sender_id = auth.uid() AND
    EXISTS (
      SELECT 1 FROM public.conversation_participants
      WHERE conversation_id = messages.conversation_id
      AND user_id = auth.uid()
    )
  );

-- =============================================
-- MESSAGE RECEIPTS POLICIES
-- =============================================

-- Users can view receipts for messages in their conversations
CREATE POLICY "Users can view receipts in their conversations"
  ON public.message_receipts FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.messages m
      JOIN public.conversation_participants cp ON cp.conversation_id = m.conversation_id
      WHERE m.id = message_receipts.message_id
      AND cp.user_id = auth.uid()
    )
  );

-- Users can create receipts for themselves
CREATE POLICY "Users can create own receipts"
  ON public.message_receipts FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid());

-- Users can update their own receipts
CREATE POLICY "Users can update own receipts"
  ON public.message_receipts FOR UPDATE
  TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());
