-- Migration: WhatsApp-style message features
-- Adds support for delete for me/everyone, reply, forward, and typing indicators

-- Add WhatsApp-style message features to messages table
ALTER TABLE messages
  ADD COLUMN IF NOT EXISTS deleted_for JSONB DEFAULT '[]',
  ADD COLUMN IF NOT EXISTS reply_to_message_id UUID REFERENCES messages(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS forwarded_from_message_id UUID REFERENCES messages(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS deleted_for_everyone BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS message_status TEXT DEFAULT 'sent' CHECK (message_status IN ('pending', 'sent', 'delivered', 'read'));

-- Create indexes for new columns
CREATE INDEX IF NOT EXISTS idx_messages_reply_to ON messages (reply_to_message_id) WHERE reply_to_message_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_messages_forwarded_from ON messages (forwarded_from_message_id) WHERE forwarded_from_message_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_messages_status ON messages (message_status);

-- Create typing indicators table
CREATE TABLE IF NOT EXISTS typing_indicators (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  thread_id UUID NOT NULL REFERENCES message_threads(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  is_typing BOOLEAN DEFAULT false,
  last_updated TIMESTAMPTZ DEFAULT now(),
  UNIQUE(thread_id, user_id)
);

-- Create index for typing indicators
CREATE INDEX IF NOT EXISTS idx_typing_indicators_thread ON typing_indicators (thread_id);

-- Enable RLS on typing_indicators
ALTER TABLE typing_indicators ENABLE ROW LEVEL SECURITY;

-- RLS policies for typing_indicators
-- Users can see typing indicators for threads they participate in
CREATE POLICY typing_select ON typing_indicators
FOR SELECT USING (
  EXISTS (
    SELECT 1 FROM message_participants mp
    WHERE mp.thread_id = typing_indicators.thread_id
    AND mp.user_id = auth.uid()
  )
);

-- Users can only insert their own typing indicator
CREATE POLICY typing_insert ON typing_indicators
FOR INSERT WITH CHECK (user_id = auth.uid());

-- Users can only update their own typing indicator
CREATE POLICY typing_update ON typing_indicators
FOR UPDATE USING (user_id = auth.uid());

-- Users can only delete their own typing indicator
CREATE POLICY typing_delete ON typing_indicators
FOR DELETE USING (user_id = auth.uid());

-- Grant permissions on typing_indicators
GRANT SELECT, INSERT, UPDATE, DELETE ON typing_indicators TO authenticated;

-- Function to update typing indicator (upsert)
CREATE OR REPLACE FUNCTION update_typing_indicator(
  p_thread_id UUID,
  p_is_typing BOOLEAN
)
RETURNS VOID AS $$
BEGIN
  INSERT INTO typing_indicators (thread_id, user_id, is_typing, last_updated)
  VALUES (p_thread_id, auth.uid(), p_is_typing, now())
  ON CONFLICT (thread_id, user_id)
  DO UPDATE SET
    is_typing = p_is_typing,
    last_updated = now();
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute on the function
GRANT EXECUTE ON FUNCTION update_typing_indicator(UUID, BOOLEAN) TO authenticated;

-- Function to delete message for me (soft delete)
CREATE OR REPLACE FUNCTION delete_message_for_me(
  p_message_id UUID
)
RETURNS VOID AS $$
BEGIN
  UPDATE messages
  SET deleted_for = deleted_for || to_jsonb(auth.uid()::text)
  WHERE id = p_message_id
    AND NOT (auth.uid()::text = ANY(ARRAY(SELECT jsonb_array_elements_text(deleted_for))))
    AND EXISTS (
      SELECT 1 FROM message_participants mp
      WHERE mp.thread_id = messages.thread_id
      AND mp.user_id = auth.uid()
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute on the function
GRANT EXECUTE ON FUNCTION delete_message_for_me(UUID) TO authenticated;

-- Function to delete message for everyone (within 1 hour of creation)
CREATE OR REPLACE FUNCTION delete_message_for_everyone(
  p_message_id UUID
)
RETURNS BOOLEAN AS $$
DECLARE
  v_can_delete BOOLEAN := FALSE;
BEGIN
  -- Check if user is sender and message is within 1 hour
  UPDATE messages
  SET deleted_for_everyone = TRUE
  WHERE id = p_message_id
    AND sender_id = auth.uid()
    AND created_at > (now() - interval '1 hour')
    AND deleted_for_everyone = FALSE
  RETURNING TRUE INTO v_can_delete;

  RETURN COALESCE(v_can_delete, FALSE);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute on the function
GRANT EXECUTE ON FUNCTION delete_message_for_everyone(UUID) TO authenticated;

-- Function to edit message (within 15 minutes of creation)
CREATE OR REPLACE FUNCTION edit_message(
  p_message_id UUID,
  p_new_content TEXT
)
RETURNS BOOLEAN AS $$
DECLARE
  v_edited BOOLEAN := FALSE;
BEGIN
  -- Check if user is sender and message is within 15 minutes
  UPDATE messages
  SET
    content = p_new_content,
    edited_at = now()
  WHERE id = p_message_id
    AND sender_id = auth.uid()
    AND created_at > (now() - interval '15 minutes')
    AND deleted_at IS NULL
    AND deleted_for_everyone = FALSE
  RETURNING TRUE INTO v_edited;

  RETURN COALESCE(v_edited, FALSE);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute on the function
GRANT EXECUTE ON FUNCTION edit_message(UUID, TEXT) TO authenticated;

-- Add comments for documentation
COMMENT ON COLUMN messages.deleted_for IS 'Array of user IDs who have deleted this message for themselves';
COMMENT ON COLUMN messages.reply_to_message_id IS 'Reference to the original message if this is a reply';
COMMENT ON COLUMN messages.forwarded_from_message_id IS 'Reference to the original message if this was forwarded';
COMMENT ON COLUMN messages.deleted_for_everyone IS 'True if sender deleted message for all participants';
COMMENT ON COLUMN messages.message_status IS 'Delivery status: pending, sent, delivered, read';
COMMENT ON TABLE typing_indicators IS 'Tracks which users are currently typing in each thread';
