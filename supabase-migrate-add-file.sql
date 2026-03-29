-- Migration to add file support to messages_app table
-- Run this in Supabase SQL Editor if the file column doesn't exist

ALTER TABLE public.messages_app
ADD COLUMN IF NOT EXISTS file jsonb;

-- Create index for faster queries
CREATE INDEX IF NOT EXISTS idx_messages_app_file ON public.messages_app USING gin(file);
