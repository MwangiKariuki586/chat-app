-- =============================================
-- Add DELETE policies for conversations
-- Run this in Supabase SQL Editor
-- =============================================

-- Allow users to delete conversations they are part of
CREATE POLICY "Users can delete their conversations"
  ON public.conversations FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.conversation_participants
      WHERE conversation_id = conversations.id
      AND user_id = auth.uid()
    )
  );

-- Allow users to delete their participation (leave conversation)
CREATE POLICY "Users can delete their participation"
  ON public.conversation_participants FOR DELETE
  TO authenticated
  USING (user_id = auth.uid());

-- Allow cascade delete of messages when conversation is deleted
-- (The cascade happens at DB level, but we need policy for direct deletes)
CREATE POLICY "Users can delete messages in their conversations"
  ON public.messages FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.conversation_participants
      WHERE conversation_id = messages.conversation_id
      AND user_id = auth.uid()
    )
  );

-- Allow cascade delete of receipts
CREATE POLICY "Users can delete their receipts"
  ON public.message_receipts FOR DELETE
  TO authenticated
  USING (user_id = auth.uid());
