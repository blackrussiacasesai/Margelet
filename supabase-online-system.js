/**
 * MARGELET ONLINE SYSTEM
 * Полностью онлайн система профилей, поиска и чатов через Supabase
 */

// ============================================================
// ПОИСК ПРОФИЛЕЙ (онлайн)
// ============================================================

/**
 * Поиск пользователей в Supabase по email, username или телефону
 */
async function searchUsersOnline(query) {
    const client = getSupabaseClient();
    if (!client) return [];

    const normalizedQuery = query.trim().toLowerCase();
    if (!normalizedQuery || normalizedQuery.length < 2) return [];

    try {
        const { data, error } = await client
            .from('profiles')
            .select('id, email, display_name, username, phone, avatar_url, about, glow_color')
            .or(`email.ilike.%${normalizedQuery}%,username.ilike.%${normalizedQuery}%,display_name.ilike.%${normalizedQuery}%,phone.ilike.%${normalizedQuery}%`)
            .limit(20);

        if (error) throw error;
        return data || [];
    } catch (error) {
        console.error('Ошибка поиска пользователей:', error);
        return [];
    }
}

/**
 * Получить профиль пользователя по email
 */
async function getUserProfileByEmailOnline(email) {
    const client = getSupabaseClient();
    if (!client) return null;

    try {
        const { data, error } = await client
            .from('profiles')
            .select('*')
            .eq('email', normalizeEmail(email))
            .single();

        if (error && error.code !== 'PGRST116') throw error;
        return data || null;
    } catch (error) {
        console.error('Ошибка получения профиля:', error);
        return null;
    }
}

/**
 * Получить профиль по username
 */
async function getUserProfileByUsernameOnline(username) {
    const client = getSupabaseClient();
    if (!client) return null;

    try {
        const normalized = normalizeUsername(username);
        const { data, error } = await client
            .from('profiles')
            .select('*')
            .eq('username', normalized)
            .single();

        if (error && error.code !== 'PGRST116') throw error;
        return data || null;
    } catch (error) {
        console.error('Ошибка получения профиля:', error);
        return null;
    }
}

/**
 * Получить список всех доступных профилей (исключая текущего пользователя)
 */
async function getAllProfilesOnline(excludeUserId = null) {
    const client = getSupabaseClient();
    if (!client) return [];

    try {
        let query = client
            .from('profiles')
            .select('id, email, display_name, username, phone, avatar_url, about, created_at')
            .order('created_at', { ascending: false });

        if (excludeUserId) {
            query = query.neq('id', excludeUserId);
        }

        const { data, error } = await query;

        if (error) throw error;
        return data || [];
    } catch (error) {
        console.error('Ошибка получения профилей:', error);
        return [];
    }
}

// ============================================================
// УПРАВЛЕНИЕ ЧАТАМИ (онлайн)
// ============================================================

/**
 * Получить или создать разговор между двумя пользователями
 */
async function getOrCreateConversationOnline(userId1, userId2) {
    const client = getSupabaseClient();
    if (!client) return null;

    try {
        // Проверить существующий разговор
        const { data: existingConv, error: existingError } = await client
            .from('conversation_participants')
            .select('conversation_id')
            .eq('user_id', userId1);

        if (!existingError && existingConv) {
            for (const row of existingConv) {
                const { data: participants } = await client
                    .from('conversation_participants')
                    .select('user_id')
                    .eq('conversation_id', row.conversation_id);

                if (participants && participants.length === 2) {
                    const hasUserId2 = participants.some(p => p.user_id === userId2);
                    if (hasUserId2) {
                        return row.conversation_id;
                    }
                }
            }
        }

        // Создать новый разговор
        const { data: newConv, error: createError } = await client
            .from('conversations')
            .insert([{}])
            .select()
            .single();

        if (createError) throw createError;

        const conversationId = newConv.id;

        // Добавить участников
        await client
            .from('conversation_participants')
            .insert([
                { conversation_id: conversationId, user_id: userId1 },
                { conversation_id: conversationId, user_id: userId2 }
            ]);

        return conversationId;
    } catch (error) {
        console.error('Ошибка создания разговора:', error);
        return null;
    }
}

/**
 * Получить все разговоры текущего пользователя
 */
async function getUserConversationsOnline(userId) {
    const client = getSupabaseClient();
    if (!client) return [];

    try {
        // Получить ID всех разговоров пользователя
        const { data: conversations, error: convError } = await client
            .from('conversation_participants')
            .select('conversation_id')
            .eq('user_id', userId);

        if (convError) throw convError;

        if (!conversations || conversations.length === 0) return [];

        const conversationIds = conversations.map(c => c.conversation_id);

        // Получить последние сообщения для каждого разговора
        const result = [];

        for (const convId of conversationIds) {
            // Получить участников разговора
            const { data: participants } = await client
                .from('conversation_participants')
                .select('user_id, profiles(email, display_name, avatar_url)')
                .eq('conversation_id', convId)
                .neq('user_id', userId);

            // Получить последнее сообщение
            const { data: lastMessage } = await client
                .from('messages')
                .select('body, sender_id, created_at')
                .eq('conversation_id', convId)
                .order('created_at', { ascending: false })
                .limit(1)
                .single();

            if (participants && participants[0]) {
                const participant = participants[0];
                result.push({
                    conversationId: convId,
                    otherUser: participant.profiles,
                    lastMessage: lastMessage?.body || '',
                    lastMessageTime: lastMessage?.created_at || new Date().toISOString(),
                    unread: false // TODO: добавить систему непрочитанных
                });
            }
        }

        return result.sort((a, b) => 
            new Date(b.lastMessageTime) - new Date(a.lastMessageTime)
        );
    } catch (error) {
        console.error('Ошибка получения разговоров:', error);
        return [];
    }
}

// ============================================================
// СООБЩЕНИЯ (онлайн)
// ============================================================

/**
 * Отправить сообщение в разговор
 */
async function sendMessageOnline(conversationId, senderId, messageText) {
    const client = getSupabaseClient();
    if (!client) return null;

    try {
        const { data, error } = await client
            .from('messages')
            .insert([{
                conversation_id: conversationId,
                sender_id: senderId,
                body: messageText.trim(),
                created_at: new Date().toISOString()
            }])
            .select()
            .single();

        if (error) throw error;
        return data;
    } catch (error) {
        console.error('Ошибка отправки сообщения:', error);
        return null;
    }
}

/**
 * Получить сообщения разговора
 */
async function getConversationMessagesOnline(conversationId, limit = 50) {
    const client = getSupabaseClient();
    if (!client) return [];

    try {
        const { data, error } = await client
            .from('messages')
            .select(`
                id,
                body,
                sender_id,
                created_at,
                profiles:sender_id(email, display_name, avatar_url)
            `)
            .eq('conversation_id', conversationId)
            .order('created_at', { ascending: false })
            .limit(limit);

        if (error) throw error;
        return (data || []).reverse();
    } catch (error) {
        console.error('Ошибка получения сообщений:', error);
        return [];
    }
}

/**
 * Подписаться на новые сообщения в реальном времени
 */
function subscribeToConversationMessagesOnline(conversationId, onNewMessage) {
    const client = getSupabaseClient();
    if (!client) return null;

    const subscription = client
        .channel(`messages:${conversationId}`)
        .on(
            'postgres_changes',
            {
                event: 'INSERT',
                schema: 'public',
                table: 'messages',
                filter: `conversation_id=eq.${conversationId}`
            },
            async (payload) => {
                const message = payload.new;
                const { data: profile } = await client
                    .from('profiles')
                    .select('email, display_name, avatar_url')
                    .eq('id', message.sender_id)
                    .single();

                onNewMessage({
                    ...message,
                    profiles: profile
                });
            }
        )
        .subscribe();

    return subscription;
}

/**
 * Удалить сообщение для всех (полное удаление)
 */
async function deleteMessageForEveryone(messageId) {
    const client = getSupabaseClient();
    if (!client) return false;

    try {
        const { error } = await client
            .from('messages_app')
            .delete()
            .eq('id', messageId);

        if (error) throw error;
        return true;
    } catch (error) {
        console.error('Ошибка удаления сообщения:', error);
        return false;
    }
}

/**
 * Удалить сообщение для текущего пользователя (добавить в deleted_for)
 */
async function deleteMessageForMe(messageId, userEmail) {
    const client = getSupabaseClient();
    if (!client) return false;

    try {
        // Получить текущий deleted_for массив
        const { data: message, error: fetchError } = await client
            .from('messages_app')
            .select('deleted_for')
            .eq('id', messageId)
            .single();

        if (fetchError) throw fetchError;

        const deletedFor = message?.deleted_for || [];
        // Добавить текущего пользователя если его еще там нет
        if (!deletedFor.includes(userEmail)) {
            deletedFor.push(userEmail);
        }

        // Обновить массив deleted_for
        const { error: updateError } = await client
            .from('messages_app')
            .update({ deleted_for: deletedFor })
            .eq('id', messageId);

        if (updateError) throw updateError;
        return true;
    } catch (error) {
        console.error('Ошибка скрытия сообщения:', error);
        return false;
    }
}

/**
 * Подписаться на новые разговоры пользователя
 */
function subscribeToUserConversationsOnline(userId, onNewConversation) {
    const client = getSupabaseClient();
    if (!client) return null;

    const subscription = client
        .channel(`conversations:${userId}`)
        .on(
            'postgres_changes',
            {
                event: 'INSERT',
                schema: 'public',
                table: 'conversation_participants',
                filter: `user_id=eq.${userId}`
            },
            (payload) => {
                onNewConversation(payload.new);
            }
        )
        .subscribe();

    return subscription;
}

// ============================================================
// ОБНОВЛЕНИЕ ПРОФИЛЕЙ (онлайн)
// ============================================================

/**
 * Обновить профиль пользователя на Supabase
 */
async function updateUserProfileOnline(userId, updates) {
    const client = getSupabaseClient();
    if (!client) return null;

    try {
        const { data, error } = await client
            .from('profiles')
            .update({
                ...updates,
                updated_at: new Date().toISOString()
            })
            .eq('id', userId)
            .select()
            .single();

        if (error) throw error;
        return data;
    } catch (error) {
        console.error('Ошибка обновления профиля:', error);
        return null;
    }
}

/**
 * Загрузить аватар пользователя
 */
async function uploadUserAvatarOnline(userId, file) {
    const client = getSupabaseClient();
    if (!client) return null;

    try {
        const fileName = `${userId}-${Date.now()}-${file.name}`;
        const { data: uploadData, error: uploadError } = await client
            .storage
            .from('avatars')
            .upload(fileName, file);

        if (uploadError) throw uploadError;

        const { data: urlData } = client
            .storage
            .from('avatars')
            .getPublicUrl(fileName);

        // Обновить профиль с новым аватаром
        await updateUserProfileOnline(userId, {
            avatar_url: urlData.publicUrl
        });

        return urlData.publicUrl;
    } catch (error) {
        console.error('Ошибка загрузки аватара:', error);
        return null;
    }
}

// ============================================================
// УТИЛИТЫ
// ============================================================

/**
 * Инициализировать полностью онлайн систему
 */
async function initializeOnlineSystem() {
    const client = getSupabaseClient();
    if (!client) {
        console.error('Supabase не инициализирован');
        return false;
    }

    try {
        // Проверить, аутентифицирован ли пользователь
        const { data: authData, error: authError } = await client.auth.getUser();
        
        if (authError || !authData?.user) {
            console.log('Пользователь не аутентифицирован');
            return false;
        }

        console.log('✅ Онлайн система инициализирована');
        return true;
    } catch (error) {
        console.error('Ошибка инициализации:', error);
        return false;
    }
}

// ============================================================
// ЭКСПОРТ ФУНКЦИЙ
// ============================================================

if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        searchUsersOnline,
        getUserProfileByEmailOnline,
        getUserProfileByUsernameOnline,
        getAllProfilesOnline,
        getOrCreateConversationOnline,
        getUserConversationsOnline,
        sendMessageOnline,
        getConversationMessagesOnline,
        subscribeToConversationMessagesOnline,
        deleteMessageForEveryone,
        deleteMessageForMe,
        subscribeToUserConversationsOnline,
        updateUserProfileOnline,
        uploadUserAvatarOnline,
        initializeOnlineSystem
    };
}
