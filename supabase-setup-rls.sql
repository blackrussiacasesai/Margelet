-- ============================================================
-- MARGELET - Row Level Security (RLS) Политики
-- Скопируйте это содержимое в Supabase SQL Editor и выполните
-- ============================================================

-- ============================================================
-- 1. ТАБЛИЦА PROFILES - Политики безопасности
-- ============================================================

-- Включить RLS для profiles
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- Политика: Пользователи могут видеть свой профиль
DROP POLICY IF EXISTS "Users can view their own profile" ON public.profiles;
CREATE POLICY "Users can view their own profile" ON public.profiles
    FOR SELECT
    USING (auth.uid() = id);

-- Политика: Пользователи могут видеть публичные профили других
DROP POLICY IF EXISTS "Users can view other profiles" ON public.profiles;
CREATE POLICY "Users can view other profiles" ON public.profiles
    FOR SELECT
    USING (auth.uid() IS NOT NULL);

-- Политика: Пользователи могут обновлять только свой профиль
DROP POLICY IF EXISTS "Users can update their own profile" ON public.profiles;
CREATE POLICY "Users can update their own profile" ON public.profiles
    FOR UPDATE
    USING (auth.uid() = id)
    WITH CHECK (auth.uid() = id);

-- Политика: Пользователи могут вставлять только свой профиль
DROP POLICY IF EXISTS "Users can insert their own profile" ON public.profiles;
CREATE POLICY "Users can insert their own profile" ON public.profiles
    FOR INSERT
    WITH CHECK (auth.uid() = id);

-- ============================================================
-- 2. ТАБЛИЦА CONVERSATIONS - Политики безопасности
-- ============================================================

-- Включить RLS для conversations
ALTER TABLE public.conversations ENABLE ROW LEVEL SECURITY;

-- Политика: Пользователи могут видеть разговоры в которых участвуют
DROP POLICY IF EXISTS "Users can view conversations they participate in" ON public.conversations;
CREATE POLICY "Users can view conversations they participate in" ON public.conversations
    FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM public.conversation_participants
            WHERE conversation_id = conversations.id
            AND user_id = auth.uid()
        )
    );

-- Политика: Пользователи могут создавать разговоры (будут добавлены через conversation_participants)
DROP POLICY IF EXISTS "Users can create conversations" ON public.conversations;
CREATE POLICY "Users can create conversations" ON public.conversations
    FOR INSERT
    WITH CHECK (true);

-- Политика: Пользователи могут обновлять разговоры в которых участвуют
DROP POLICY IF EXISTS "Users can update conversations they participate in" ON public.conversations;
CREATE POLICY "Users can update conversations they participate in" ON public.conversations
    FOR UPDATE
    USING (
        EXISTS (
            SELECT 1 FROM public.conversation_participants
            WHERE conversation_id = conversations.id
            AND user_id = auth.uid()
        )
    );

-- ============================================================
-- 3. ТАБЛИЦА CONVERSATION_PARTICIPANTS - Политики безопасности
-- ============================================================

-- Включить RLS для conversation_participants
ALTER TABLE public.conversation_participants ENABLE ROW LEVEL SECURITY;

-- Политика: Пользователи могут видеть участников своих разговоров
DROP POLICY IF EXISTS "Users can view participants in their conversations" ON public.conversation_participants;
CREATE POLICY "Users can view participants in their conversations" ON public.conversation_participants
    FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM public.conversation_participants AS cp
            WHERE cp.conversation_id = conversation_participants.conversation_id
            AND cp.user_id = auth.uid()
        )
    );

-- Политика: Пользователи могут добавлять себя как участника
DROP POLICY IF EXISTS "Users can add themselves as participant" ON public.conversation_participants;
CREATE POLICY "Users can add themselves as participant" ON public.conversation_participants
    FOR INSERT
    WITH CHECK (auth.uid() = user_id OR
        EXISTS (
            SELECT 1 FROM public.conversation_participants
            WHERE conversation_id = conversation_participants.conversation_id
            AND user_id = auth.uid()
        )
    );

-- Политика: Пользователи могут удалять себя из разговора
DROP POLICY IF EXISTS "Users can remove themselves from conversation" ON public.conversation_participants;
CREATE POLICY "Users can remove themselves from conversation" ON public.conversation_participants
    FOR DELETE
    USING (auth.uid() = user_id);

-- ============================================================
-- 4. ТАБЛИЦА MESSAGES - Политики безопасности
-- ============================================================

-- Включить RLS для messages
ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;

-- Политика: Пользователи могут видеть сообщения только в своих разговорах
DROP POLICY IF EXISTS "Users can view messages in their conversations" ON public.messages;
CREATE POLICY "Users can view messages in their conversations" ON public.messages
    FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM public.conversation_participants
            WHERE conversation_id = messages.conversation_id
            AND user_id = auth.uid()
        )
    );

-- Политика: Пользователи могут отправлять сообщения только от себя
DROP POLICY IF EXISTS "Users can send messages as themselves" ON public.messages;
CREATE POLICY "Users can send messages as themselves" ON public.messages
    FOR INSERT
    WITH CHECK (
        auth.uid() = sender_id
        AND EXISTS (
            SELECT 1 FROM public.conversation_participants
            WHERE conversation_id = messages.conversation_id
            AND user_id = auth.uid()
        )
    );

-- Политика: Пользователи могут удалять только свои сообщения
DROP POLICY IF EXISTS "Users can delete their own messages" ON public.messages;
CREATE POLICY "Users can delete their own messages" ON public.messages
    FOR DELETE
    USING (auth.uid() = sender_id);

-- ============================================================
-- 5. ХРАНИЛИЩЕ - Политики для аватаров
-- ============================================================

-- Создать bucket для аватаров если не существует
INSERT INTO storage.buckets (id, name, public)
VALUES ('avatars', 'avatars', true)
ON CONFLICT (id) DO NOTHING;

-- Политика для хранилища: Пользователи могут загружать свои аватары
DROP POLICY IF EXISTS "Users can upload their own avatar" ON storage.objects;
CREATE POLICY "Users can upload their own avatar" ON storage.objects
    FOR INSERT
    WITH CHECK (
        bucket_id = 'avatars'
        AND (storage.foldername(name))[1] = auth.uid()::text
    );

-- Политика: Пользователи могут обновлять свои аватары
DROP POLICY IF EXISTS "Users can update their own avatar" ON storage.objects;
CREATE POLICY "Users can update their own avatar" ON storage.objects
    FOR UPDATE
    USING (
        bucket_id = 'avatars'
        AND (storage.foldername(name))[1] = auth.uid()::text
    );

-- Политика: Все могут просматривать аватары
DROP POLICY IF EXISTS "Public can view avatars" ON storage.objects;
CREATE POLICY "Public can view avatars" ON storage.objects
    FOR SELECT
    USING (bucket_id = 'avatars');

-- ============================================================
-- 6. ИНДЕКСЫ для оптимизации поиска
-- ============================================================

-- Индекс на email для быстрого поиска
CREATE INDEX IF NOT EXISTS idx_profiles_email ON public.profiles(email);

-- Индекс на username для быстрого поиска
CREATE INDEX IF NOT EXISTS idx_profiles_username ON public.profiles(username);

-- Индекс на display_name для поиска
CREATE INDEX IF NOT EXISTS idx_profiles_display_name ON public.profiles(display_name);

-- Индекс на phone для поиска по телефону
CREATE INDEX IF NOT EXISTS idx_profiles_phone ON public.profiles(phone);

-- Индекс на conversation_id в messages
CREATE INDEX IF NOT EXISTS idx_messages_conversation_id ON public.messages(conversation_id);

-- Индекс на created_at в messages для сортировки
CREATE INDEX IF NOT EXISTS idx_messages_created_at ON public.messages(created_at DESC);

-- Индекс на sender_id
CREATE INDEX IF NOT EXISTS idx_messages_sender_id ON public.messages(sender_id);

-- Индекс на conversation_participants
CREATE INDEX IF NOT EXISTS idx_conversation_participants_user_id ON public.conversation_participants(user_id);

-- ============================================================
-- 7. ФУНКЦИИ ПОИСКА (Full Text Search) - опционально
-- ============================================================

-- Создать индекс для полнотекстового поиска
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS search_vector tsvector
    GENERATED ALWAYS AS (
        to_tsvector('russian', coalesce(display_name, '') || ' ' || 
                   coalesce(username, '') || ' ' ||
                   coalesce(email, '') || ' ' ||
                   coalesce(about, ''))
    ) STORED;

-- Индекс для полнотекстового поиска
CREATE INDEX IF NOT EXISTS idx_profiles_search ON public.profiles USING GIN(search_vector);

-- ============================================================
-- 8. ОПЦИОНАЛЬНЫЕ ТАБЛИЦЫ РАСШИРЕНИЯ
-- ============================================================

-- Таблица для блокировок (опционально)
-- CREATE TABLE IF NOT EXISTS public.blocked_users (
--   id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
--   blocker_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
--   blocked_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
--   blocked_at timestamptz NOT NULL DEFAULT now(),
--   UNIQUE(blocker_id, blocked_id)
-- );

-- Таблица для контактов (друзей) (опционально)
-- CREATE TABLE IF NOT EXISTS public.contacts (
--   id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
--   user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
--   contact_user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
--   added_at timestamptz NOT NULL DEFAULT now(),
--   is_favorite boolean DEFAULT false,
--   UNIQUE(user_id, contact_user_id)
-- );

-- ============================================================
-- ПРОВЕРКА: Выполнить эти SELECT для проверки
-- ============================================================

-- Проверить включение RLS
-- SELECT tablename, 
--        (SELECT count(*) FROM pg_policies WHERE tablename = 'public.' || schemaname || '.' || tablename) as policy_count
-- FROM pg_tables
-- WHERE schemaname = 'public'
-- AND tablename IN ('profiles', 'conversations', 'conversation_participants', 'messages');

-- Проверить существующие индексы
-- SELECT indexname FROM pg_indexes WHERE schemaname = 'public' AND tablename LIKE '%profiles%' OR tablename LIKE '%messages%';
