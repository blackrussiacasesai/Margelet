// Обработка навигационных ссылок в формах
document.querySelectorAll('.nav-link').forEach(link => {
    link.addEventListener('click', function(e) {
        e.preventDefault();
        const screenId = this.getAttribute('data-screen');
        if (screenId) {
            goToScreen(screenId);
        }
    });
});

// Глобальные переменные для сессии
let currentUserEmail = null;
let resetEmailTarget = null;
let currentRegistrationEmail = null;
let currentRegistrationPassword = null;
let currentRegistrationName = null;
let activeConversationId = null;
let messagingInitialized = false;
let lastScreenBeforeUserProfile = 'screen-main';
let currentViewedUserProfileEmail = null;
let registrationRequestInFlight = false;
let passwordResetRequestInFlight = false;

const CHAT_STORAGE_KEY = 'margeletConversations_v1';
let supabaseClient = null;
let supabaseMessagesChannel = null;
let supabaseChatInitializedForEmail = null;
let supabaseMessagesTableAvailable = true;
let supabaseMessagesMissingWarningShown = false;
let supabaseProfilesSyncInFlight = false;
let supabaseProfilesLastSyncAt = 0;
let supabaseProfilesTableAvailable = true;
let supabaseProfilesMissingWarningShown = false;
let supabaseMessagesPollingStarted = false;
let chatSearchDebounceTimer = null;
let userPresencePollingStarted = false;
let userPresenceMap = {};
let unreadConversationIds = {};
let conversationsStoreCache = null;
let conversationsPersistTimer = null;
let chatAreaUpdateRafId = null;
let pendingChatAreaUpdateOptions = null;
let pendingMessageSend = false;
let initAppBootstrapped = false;
let navigationInitialized = false;
let profileMenuInitialized = false;
let searchToggleInitialized = false;
let imageModalInitialized = false;
let themeToggleInitialized = false;
let messageReadSyncInFlight = false;
let pendingReadSyncConversationId = null;
let readSyncTimer = null;
let lastRenderedConversationSignature = '';
let searchModeActive = false;
let activeSearchSubmenuTab = 'users';
let cachedUsersDirectory = null;
let cachedUsersDirectoryRaw = null;
let userPresenceChannel = null;
let userPresenceHeartbeatTimer = null;
let userPresenceRefreshTimer = null;
let activeThreadDom = null;
let activeMainSubmenuTab = 'chats';
let chatAreaScrollState = {
    top: 0,
    height: 0
};

let notificationPermissionRequested = localStorage.getItem('notificationPermissionRequested') === 'true';
// Shared audio context used to enable audio on mobile after first user interaction
let __sharedAudioContext = null;
let __audioUnlocked = false;

function tryUnlockAudioOnFirstInteraction() {
    if (__audioUnlocked) return;

    function unlock() {
        try {
            // Создаём AudioContext в рамках пользовательского события — это "разблокирует" звук на мобильных
            const ctx = new (window.AudioContext || window.webkitAudioContext)();
            if (ctx.state === 'suspended') {
                ctx.resume().then(() => {
                    __sharedAudioContext = ctx;
                    __audioUnlocked = true;
                }).catch(() => {
                    __sharedAudioContext = ctx;
                    __audioUnlocked = true;
                });
            } else {
                __sharedAudioContext = ctx;
                __audioUnlocked = true;
            }
        } catch (e) {
            // ignore
        }

        document.removeEventListener('touchstart', unlock);
        document.removeEventListener('pointerdown', unlock);
        document.removeEventListener('click', unlock);
    }

    document.addEventListener('touchstart', unlock, { passive: true });
    document.addEventListener('pointerdown', unlock, { passive: true });
    document.addEventListener('click', unlock, { passive: true });
}

function playSendMessageSound() {
    try {
        if (Notification.permission === 'denied') return;

        if (Notification.permission === 'default' && !notificationPermissionRequested) {
            notificationPermissionRequested = true;
            localStorage.setItem('notificationPermissionRequested', 'true');
            Notification.requestPermission().catch(() => {});
            return;
        }

        const audioContext = __sharedAudioContext || new (window.AudioContext || window.webkitAudioContext)();
        const now = audioContext.currentTime;

        // Фильтр для приглушенного звука
        const filter = audioContext.createBiquadFilter();
        filter.type = 'lowpass';
        filter.frequency.setValueAtTime(500, now);
        filter.Q.setValueAtTime(0.8, now);
        filter.connect(audioContext.destination);

        // Первый тон
        const osc1 = audioContext.createOscillator();
        const gain1 = audioContext.createGain();
        osc1.connect(gain1);
        gain1.connect(filter);
        osc1.frequency.setValueAtTime(380, now);
        osc1.type = 'sine';
        gain1.gain.setValueAtTime(0.12, now);
        gain1.gain.exponentialRampToValueAtTime(0.005, now + 0.13);
        osc1.start(now);
        osc1.stop(now + 0.13);

        // Второй тон
        const osc2 = audioContext.createOscillator();
        const gain2 = audioContext.createGain();
        osc2.connect(gain2);
        gain2.connect(filter);
        osc2.frequency.setValueAtTime(500, now + 0.08);
        osc2.type = 'sine';
        gain2.gain.setValueAtTime(0.12, now + 0.08);
        gain2.gain.exponentialRampToValueAtTime(0.005, now + 0.21);
        osc2.start(now + 0.08);
        osc2.stop(now + 0.21);
    } catch (e) {
        // ignore if audio cannot be created
    }
}

function getSignupCooldownKey(email) {
    return 'supabaseSignupCooldownUntil_' + normalizeEmail(email);
}

function getSignupCooldownUntil(email) {
    return Number(localStorage.getItem(getSignupCooldownKey(email)) || 0);
}

function setSignupCooldownUntil(email, timestamp) {
    localStorage.setItem(getSignupCooldownKey(email), String(timestamp));
}

function isSupabaseMessagesTableMissing(error) {
    if (!error) return false;
    if (error.status === 404) return true;
    const code = String(error.code || '').toUpperCase();
    const message = String(error.message || '').toLowerCase();
    return code === 'PGRST205' || message.includes('messages_app') && message.includes('not found');
}

function isSupabaseProfilesTableMissing(error) {
    if (!error) return false;
    if (error.status === 404) return true;
    const code = String(error.code || '').toUpperCase();
    const message = String(error.message || '').toLowerCase();
    return code === 'PGRST205' || message.includes('profiles') && message.includes('not found');
}

function appendLocalMessageToActiveConversation(messageText, fileData) {
    const store = getConversationsStore();
    const conversation = store[activeConversationId];
    if (!conversation) return;

    const messageBody = messageText.trim() || (fileData ? `📎 ${fileData.name}` : 'Сообщение');
    
    const messageObj = {
        sender: currentUserEmail,
        text: messageBody,
        timestamp: Date.now()
    };
    
    if (fileData) {
        messageObj.file = fileData;
    }

    conversation.messages.push(messageObj);

    conversation.updatedAt = Date.now();
    store[activeConversationId] = conversation;
    saveConversationsStore(store);
    updateChatArea();
}

function getSupabaseClient() {
    if (supabaseClient) return supabaseClient;

    const hasRuntime = typeof window !== 'undefined' && window.supabase && typeof window.supabase.createClient === 'function';
    const url = typeof window !== 'undefined' ? (window.SUPABASE_URL || '').trim() : '';
    const key = typeof window !== 'undefined' ? (window.SUPABASE_ANON_KEY || '').trim() : '';

    if (!hasRuntime || !url || !key) return null;

    supabaseClient = window.supabase.createClient(url, key);
    return supabaseClient;
}

function isSupabaseEnabled() {
    return Boolean(getSupabaseClient());
}

function normalizeEmail(value = '') {
    return String(value).trim().toLowerCase();
}

function getLocalUsersSafe() {
    try {
        const parsed = JSON.parse(localStorage.getItem('socialNetworkUsers') || '[]');
        if (Array.isArray(parsed)) return parsed;
    } catch (_error) {
        // Восстанавливаем поврежденное хранилище пользователей.
    }

    try {
        localStorage.setItem('socialNetworkUsers', '[]');
    } catch (_error) {
        // Хранилище может быть переполнено — вернем пустой массив без записи.
    }
    return [];
}

function compactUserForStorage(user) {
    const normalizedEmail = normalizeEmail(user?.email || '');
    if (!normalizedEmail) return null;

    return {
        email: normalizedEmail,
        password: String(user?.password || ''),
        name: String(user?.name || user?.displayName || normalizedEmail.split('@')[0] || 'Пользователь'),
        username: String(user?.username || ''),
        phone: String(user?.phone || ''),
        birthday: String(user?.birthday || ''),
        status: String(user?.status || ''),
        glowColor: String(user?.glowColor || '')
    };
}

function saveLocalUsersSafe(users) {
    try {
        localStorage.setItem('socialNetworkUsers', JSON.stringify(users || []));
        return true;
    } catch (error) {
        const isQuotaExceeded = String(error?.name || '').includes('QuotaExceeded') || String(error?.message || '').toLowerCase().includes('quota');
        if (!isQuotaExceeded) return false;

        // При переполнении пробуем сохранить облегченный список без тяжелых полей (например, base64-аватаров).
        const compactUsers = [];
        const seen = new Set();
        (users || []).forEach((user) => {
            const compact = compactUserForStorage(user);
            if (!compact) return;
            if (seen.has(compact.email)) return;
            seen.add(compact.email);
            compactUsers.push(compact);
        });

        try {
            localStorage.setItem('socialNetworkUsers', JSON.stringify(compactUsers));
            return true;
        } catch (_error) {
            return false;
        }
    }
}

function upsertUserInLocalDirectory(email, name = '') {
    const normalizedEmail = normalizeEmail(email);
    if (!normalizedEmail) return;

    const users = getLocalUsersSafe();
    const userIndex = users.findIndex(user => normalizeEmail(user.email) === normalizedEmail);

    if (userIndex === -1) {
        users.push({ email: normalizedEmail, name: name || normalizedEmail.split('@')[0] || 'Пользователь' });
    } else if (name && !users[userIndex].name) {
        users[userIndex] = {
            ...users[userIndex],
            email: normalizedEmail,
            name
        };
    } else if (users[userIndex].email !== normalizedEmail) {
        users[userIndex] = {
            ...users[userIndex],
            email: normalizedEmail
        };
    }

    saveLocalUsersSafe(users);
    invalidateUsersDirectoryCache();
}

async function syncCurrentUserProfileToSupabase() {
    const client = getSupabaseClient();
    if (!client || !currentUserEmail || !supabaseProfilesTableAvailable) return;

    const displayName = (localStorage.getItem('userDisplayName_' + currentUserEmail) || '').trim();
    const username = normalizeUsername(localStorage.getItem('userName_' + currentUserEmail) || '');
    const phone = String(localStorage.getItem('userPhone_' + currentUserEmail) || '').trim();
    const about = String(localStorage.getItem('userStatus_' + currentUserEmail) || '').trim();
    const birthdayRaw = String(localStorage.getItem('userBirthday_' + currentUserEmail) || '').trim();
    const glowColor = String(localStorage.getItem('glowColor_' + currentUserEmail) || 'gradient').trim();
    const avatarUrl = localStorage.getItem('userAvatar_' + currentUserEmail) || null;

    const payload = {
        email: currentUserEmail,
        display_name: displayName || currentUserEmail.split('@')[0] || 'Пользователь',
        username: username || null,
        phone: phone || null,
        about: about || null,
         birthday: birthdayRaw || null,
        glow_color: glowColor || 'gradient',
        avatar_url: avatarUrl
    };

    // Используем upsert с правильным синтаксисом
    const { error } = await client
        .from('profiles')
        .upsert([payload], { onConflict: 'email', ignoreDuplicates: false });

    if (error) {
        if (isSupabaseProfilesTableMissing(error)) {
            supabaseProfilesTableAvailable = false;
            if (!supabaseProfilesMissingWarningShown) {
                console.warn('Supabase table public.profiles is missing. User search remains local-only.');
                supabaseProfilesMissingWarningShown = true;
            }
        } else {
            console.error('Ошибка синхронизации профиля:', error);
        }
        return;
    }
}

async function syncSupabaseProfilesToLocalDirectory(force = false) {
    const client = getSupabaseClient();
    if (!client || !supabaseProfilesTableAvailable) return;

    const now = Date.now();
    if (!force && now - supabaseProfilesLastSyncAt < 30000) return;
    if (supabaseProfilesSyncInFlight) return;

    supabaseProfilesSyncInFlight = true;
    try {
        const { data, error } = await client
            .from('profiles')
            .select('email, display_name, username, phone, avatar_url, about, birthday, glow_color, last_seen_at')
            .order('created_at', { ascending: false })
            .limit(1000);

        if (error) {
            if (isSupabaseProfilesTableMissing(error)) {
                supabaseProfilesTableAvailable = false;
                if (!supabaseProfilesMissingWarningShown) {
                    console.warn('Supabase table public.profiles is missing. User search remains local-only.');
                    supabaseProfilesMissingWarningShown = true;
                }
            }
            return;
        }

        const users = JSON.parse(localStorage.getItem('socialNetworkUsers')) || [];
        const usersByEmail = new Map(
            users
                .filter(user => normalizeEmail(user.email))
                .map(user => [normalizeEmail(user.email), user])
        );

        (data || []).forEach(profile => {
            const email = normalizeEmail(profile.email || '');
            if (!email) return;

            const existing = usersByEmail.get(email) || { email };
            usersByEmail.set(email, {
                ...existing,
                email,
                name: (profile.display_name || existing.name || email.split('@')[0] || 'Пользователь').trim(),
                username: normalizeUsername(profile.username || existing.username || ''),
                phone: profile.phone || existing.phone || '',
                avatar: profile.avatar_url || existing.avatar || null,
                status: profile.about || existing.status || '',
                birthday: profile.birthday || existing.birthday || '',
                glowColor: profile.glow_color || existing.glowColor || 'gradient',
                lastSeenAt: profile.last_seen_at ? new Date(profile.last_seen_at).getTime() : (existing.lastSeenAt || 0)
            });

            if (email === currentUserEmail) {
                if (profile.display_name) localStorage.setItem('userDisplayName_' + currentUserEmail, profile.display_name);
                if (profile.username) localStorage.setItem('userName_' + currentUserEmail, normalizeUsername(profile.username));
                if (profile.phone) localStorage.setItem('userPhone_' + currentUserEmail, profile.phone);
                if (profile.about) localStorage.setItem('userStatus_' + currentUserEmail, profile.about);
                if (profile.birthday) localStorage.setItem('userBirthday_' + currentUserEmail, profile.birthday);
                if (profile.glow_color) localStorage.setItem('glowColor_' + currentUserEmail, profile.glow_color);
                if (profile.avatar_url) localStorage.setItem('userAvatar_' + currentUserEmail, profile.avatar_url);
            }
        });

        localStorage.setItem('socialNetworkUsers', JSON.stringify(Array.from(usersByEmail.values())));
        invalidateUsersDirectoryCache();
        supabaseProfilesLastSyncAt = now;
    } finally {
        supabaseProfilesSyncInFlight = false;
    }
}

async function restoreSupabaseSessionIfPossible() {
    const client = getSupabaseClient();
    if (!client) return false;

    try {
        const { data, error } = await client.auth.getSession();
        if (error) return false;

        const sessionEmail = normalizeEmail(data?.session?.user?.email || '');
        if (!sessionEmail) return false;

        currentUserEmail = sessionEmail;
        localStorage.setItem('currentUserEmail', currentUserEmail);
        upsertUserInLocalDirectory(currentUserEmail);
        goToMainScreen();
        return true;
    } catch (_error) {
        return false;
    }
}

function getUnreadStorageKey() {
    return 'margeletUnreadConversations_' + normalizeEmail(currentUserEmail || 'guest');
}

function getReadMarkersStorageKey() {
    return 'margeletReadMarkers_' + normalizeEmail(currentUserEmail || 'guest');
}

function getReadMarkersMap() {
    if (!currentUserEmail) return {};
    return JSON.parse(localStorage.getItem(getReadMarkersStorageKey()) || '{}') || {};
}

function saveReadMarkersMap(map) {
    if (!currentUserEmail) return;
    localStorage.setItem(getReadMarkersStorageKey(), JSON.stringify(map || {}));
}

function getConversationReadAt(conversationId) {
    if (!conversationId) return 0;
    const map = getReadMarkersMap();
    return Number(map[conversationId] || 0);
}

function setConversationReadAt(conversationId, timestamp) {
    if (!conversationId || !currentUserEmail) return;
    const readAt = Number(timestamp || Date.now());
    const map = getReadMarkersMap();
    if (readAt <= Number(map[conversationId] || 0)) return;
    map[conversationId] = readAt;
    saveReadMarkersMap(map);
}

function getUnreadConversationMap() {
    if (!currentUserEmail) return {};
    unreadConversationIds = JSON.parse(localStorage.getItem(getUnreadStorageKey()) || '{}') || {};
    return unreadConversationIds;
}

function saveUnreadConversationMap(map) {
    unreadConversationIds = map || {};
    if (!currentUserEmail) return;
    localStorage.setItem(getUnreadStorageKey(), JSON.stringify(unreadConversationIds));
}

function initSlidingSubmenu(inner, defaultTab, onChange) {
    if (!inner) return null;

    let indicator = inner.querySelector('.submenu-indicator');
    if (!indicator) {
        indicator = document.createElement('div');
        indicator.className = 'submenu-indicator';
        inner.insertBefore(indicator, inner.firstChild);
    }

    const buttons = Array.from(inner.querySelectorAll('.submenu-btn[data-tab]'));
    if (!buttons.length) return null;

    const isSearchSubmenu = inner.id === 'search-submenu-inner';

    function moveTo(btn) {
        const btnWidth = btn.offsetWidth;
        const btnLeft = btn.offsetLeft;

        const reduce = isSearchSubmenu ? 0 : Math.min(16, Math.round(btnWidth * 0.07));
        let width = Math.max(24, btnWidth - reduce);
        let left = btnLeft + Math.round((btnWidth - width) / 2);

        const maxLeft = isSearchSubmenu
            ? Math.max(0, inner.scrollWidth - width - 2)
            : Math.max(0, inner.clientWidth - width - 2);
        if (left < 2) left = 2;
        if (left > maxLeft) left = maxLeft;

        indicator.style.width = width + 'px';
        indicator.style.transform = 'translateX(' + left + 'px)';
        buttons.forEach(b => b.classList.toggle('active', b === btn));
    }

    function refreshActiveIndicator() {
        const active = inner.querySelector('.submenu-btn.active') || buttons[0];
        if (active) moveTo(active);
    }

    const startBtn = inner.querySelector('.submenu-btn[data-tab="' + defaultTab + '"]') || buttons[0];
    buttons.forEach(b => b.classList.remove('active'));
    startBtn.classList.add('active');

    requestAnimationFrame(() => {
        moveTo(startBtn);
        if (typeof onChange === 'function') {
            onChange(startBtn.getAttribute('data-tab') || '');
        }
    });
    setTimeout(refreshActiveIndicator, 80);
    setTimeout(refreshActiveIndicator, 220);

    buttons.forEach(btn => {
        btn.addEventListener('click', () => {
            if (typeof btn.scrollIntoView === 'function') {
                btn.scrollIntoView({ inline: 'center', block: 'nearest', behavior: 'smooth' });
            }
            requestAnimationFrame(() => moveTo(btn));
            setTimeout(() => moveTo(btn), 180);
            setTimeout(() => moveTo(btn), 320);
            if (typeof onChange === 'function') {
                onChange(btn.getAttribute('data-tab') || '');
            }
        });
    });

    const onResize = () => {
        refreshActiveIndicator();
    };
    window.addEventListener('resize', onResize);
    inner.addEventListener('scroll', refreshActiveIndicator, { passive: true });

    inner.__refreshSubmenuIndicator = refreshActiveIndicator;

    return { moveTo, buttons };
}

/* Chat submenu logic: sliding indicator and active state */
function initChatSubmenu() {
    const inner = document.querySelector('#screen-main .chat-submenu-inner');
    if (!inner) return;
    initSlidingSubmenu(inner, 'chats', (tab) => {
        const ev = new CustomEvent('chatSubmenuChange', { detail: { tab } });
        document.dispatchEvent(ev);
    });
}

document.addEventListener('DOMContentLoaded', initChatSubmenu);

function refreshMainSubmenuIndicator() {
    const mainInner = document.querySelector('#screen-main .chat-submenu-inner');
    if (!mainInner) return;
    const refresh = mainInner.__refreshSubmenuIndicator;
    if (typeof refresh === 'function') {
        refresh();
    }
}

document.addEventListener('chatSubmenuChange', (event) => {
    const tab = event?.detail?.tab || 'chats';
    if (activeMainSubmenuTab === tab) return;
    activeMainSubmenuTab = tab;

    const chatArea = document.getElementById('chat-area');
    if (chatArea) {
        chatArea.classList.remove('tab-switching');
        void chatArea.offsetWidth;
        chatArea.classList.add('tab-switching');
    }

    scheduleChatAreaUpdate({ skipRemoteRefresh: true });
});

function initUserProfileMediaTabs() {
    const inner = document.getElementById('user-profile-media-tabs');
    const panelsRoot = document.getElementById('user-profile-media-panels');
    if (!inner || !panelsRoot) return;
    if (inner.dataset.initialized === '1') {
        const refresh = inner.__refreshSubmenuIndicator;
        if (typeof refresh === 'function') {
            requestAnimationFrame(() => refresh());
        }
        return;
    }

    const panels = Array.from(panelsRoot.querySelectorAll('.profile-media-panel'));
    initSlidingSubmenu(inner, 'stories', (tab) => {
        panels.forEach(panel => {
            panel.classList.toggle('active', panel.getAttribute('data-panel') === tab);
        });
    });

    inner.dataset.initialized = '1';
}

function markConversationAsRead(conversationId) {
    if (!conversationId) return;
    const unreadMap = getUnreadConversationMap();
    if (unreadMap[conversationId]) {
        delete unreadMap[conversationId];
        saveUnreadConversationMap(unreadMap);
    }

    const conversation = getConversationById(conversationId);
    if (!conversation) return;

    const visibleMessages = conversation.messages.filter(message => {
        if (message.sender === currentUserEmail) return false;
        if (message.deleted_for && message.deleted_for.includes(currentUserEmail)) return false;
        return true;
    });

    const lastIncomingTimestamp = visibleMessages.length
        ? Math.max(...visibleMessages.map(message => Number(message.timestamp || 0)))
        : 0;

    if (lastIncomingTimestamp > 0) {
        setConversationReadAt(conversationId, lastIncomingTimestamp);
        syncConversationReadState(conversationId).catch(() => {
            // noop
        });
    }
}

function markConversationAsUnread(conversationId) {
    if (!conversationId) return;
    if (conversationId === activeConversationId && document.getElementById('screen-main')?.classList.contains('active')) {
        return;
    }
    const unreadMap = getUnreadConversationMap();
    unreadMap[conversationId] = true;
    saveUnreadConversationMap(unreadMap);
}

function getContactsStorageKey() {
    return 'margeletContacts_' + normalizeEmail(currentUserEmail || 'guest');
}

function getCurrentUserContacts() {
    if (!currentUserEmail) return [];
    const raw = JSON.parse(localStorage.getItem(getContactsStorageKey()) || '[]');
    if (!Array.isArray(raw)) return [];
    return raw.map(email => normalizeEmail(email)).filter(Boolean);
}

function setCurrentUserContacts(contacts) {
    if (!currentUserEmail) return;
    const normalized = Array.from(new Set((contacts || []).map(email => normalizeEmail(email)).filter(Boolean)));
    localStorage.setItem(getContactsStorageKey(), JSON.stringify(normalized));
}

function isUserInContacts(email) {
    const normalized = normalizeEmail(email);
    if (!normalized) return false;
    return getCurrentUserContacts().includes(normalized);
}

function addUserToContacts(email) {
    const normalized = normalizeEmail(email);
    if (!normalized || !currentUserEmail || normalized === normalizeEmail(currentUserEmail)) return false;
    const contacts = getCurrentUserContacts();
    if (contacts.includes(normalized)) return false;
    contacts.push(normalized);
    setCurrentUserContacts(contacts);
    return true;
}

function getSearchHistoryStorageKey() {
    return 'margeletSearchHistory_' + normalizeEmail(currentUserEmail || 'guest');
}

function getSearchHistoryItems() {
    if (!currentUserEmail) return [];
    const raw = JSON.parse(localStorage.getItem(getSearchHistoryStorageKey()) || '[]');
    return Array.isArray(raw) ? raw : [];
}

function setSearchHistoryItems(items) {
    if (!currentUserEmail) return;
    localStorage.setItem(getSearchHistoryStorageKey(), JSON.stringify(items || []));
}

function addSearchHistoryItem(type, id, title, subtitle = '') {
    if (!currentUserEmail || !type || !id) return;
    const items = getSearchHistoryItems();
    const next = {
        type,
        id,
        title: String(title || ''),
        subtitle: String(subtitle || ''),
        updatedAt: Date.now()
    };

    const deduped = items.filter(item => !(item.type === type && item.id === id));
    deduped.unshift(next);
    setSearchHistoryItems(deduped.slice(0, 50));
}

function renderSearchHistoryList(chatArea, type) {
    const items = getSearchHistoryItems().filter(item => item.type === type);
    if (!items.length) {
        chatArea.innerHTML = '<div class="no-chats-message">История пуста</div>';
        return;
    }

    chatArea.innerHTML = '<div class="chat-list"></div>';
    const list = chatArea.querySelector('.chat-list');

    items.forEach(item => {
        const row = document.createElement('button');
        row.type = 'button';
        row.className = 'chat-list-item';
        row.innerHTML = `
            <div class="chat-avatar fallback">${escapeHtml((item.title || '•').charAt(0).toUpperCase())}</div>
            <div class="chat-list-content">
                <div class="chat-list-top">
                    <span class="chat-list-name">${escapeHtml(item.title || 'Без названия')}</span>
                    <span class="chat-list-time">История</span>
                </div>
                <div class="chat-list-bottom">${escapeHtml(item.subtitle || '')}</div>
            </div>
        `;

        row.addEventListener('click', () => {
            if (type === 'users') {
                openUserProfileScreenByEmail(item.id, 'screen-main');
                return;
            }
            if (type === 'chats') {
                const conversation = getConversationById(item.id);
                if (conversation) {
                    activeConversationId = conversation.id;
                    scheduleChatAreaUpdate({ skipRemoteRefresh: true });
                }
                return;
            }
            if (type === 'communities') {
                alert('Раздел сообществ пока в разработке');
            }
        });

        list.appendChild(row);
    });
}

function renderChatsSearchResults(query, chatArea) {
    const normalizedQuery = (query || '').trim().toLowerCase();
    const conversations = getCurrentUserConversations();
    const filtered = conversations.filter(conversation => {
        const peerEmail = getOtherParticipantEmail(conversation);
        if (!peerEmail) return false;
        const peerName = getDisplayNameByEmail(peerEmail).toLowerCase();
        const peerUsername = getUsernameByEmail(peerEmail).toLowerCase();
        const lastMessage = (conversation.messages[conversation.messages.length - 1]?.text || '').toLowerCase();
        return peerName.includes(normalizedQuery) || peerUsername.includes(normalizedQuery) || lastMessage.includes(normalizedQuery);
    });

    if (!filtered.length) {
        chatArea.innerHTML = '<div class="no-chats-message">Чаты не найдены</div>';
        return;
    }

    chatArea.innerHTML = '<div class="chat-list"></div>';
    const list = chatArea.querySelector('.chat-list');
    filtered.forEach(conversation => {
        const peerEmail = getOtherParticipantEmail(conversation);
        if (!peerEmail) return;
        const peer = {
            email: peerEmail,
            displayName: getDisplayNameByEmail(peerEmail),
            username: getUsernameByEmail(peerEmail),
            avatar: getAvatarByEmail(peerEmail)
        };

        const row = document.createElement('button');
        row.type = 'button';
        row.className = 'chat-list-item';
        row.innerHTML = `
            ${createAvatarMarkup(peer)}
            <div class="chat-list-content">
                <div class="chat-list-top">
                    <span class="chat-list-name">${escapeHtml(peer.displayName)}</span>
                    <span class="chat-list-time">Чат</span>
                </div>
                <div class="chat-list-bottom">${escapeHtml(conversation.messages[conversation.messages.length - 1]?.text || 'Начните диалог')}</div>
            </div>
        `;

        row.addEventListener('click', (e) => {
            if (e.target.closest('.user-profile-trigger')) return;
            activeConversationId = conversation.id;
            addSearchHistoryItem('chats', conversation.id, peer.displayName, '@' + (peer.username || 'username'));
            if (typeof window.closeSearchMode === 'function') {
                window.closeSearchMode();
            }
            scheduleChatAreaUpdate({ skipRemoteRefresh: true });
        });

        const avatarTrigger = row.querySelector('.user-profile-trigger');
        if (avatarTrigger) {
            avatarTrigger.addEventListener('click', (e) => {
                e.preventDefault();
                e.stopPropagation();
                addSearchHistoryItem('users', peer.email, peer.displayName, '@' + (peer.username || 'username'));
                openUserProfileScreenByEmail(peer.email, 'screen-main');
            });
        }

        list.appendChild(row);
    });
}

function renderSearchMode(chatArea, query) {
    const normalizedQuery = (query || '').trim();
    if (activeSearchSubmenuTab === 'users') {
        if (!normalizedQuery) {
            renderSearchHistoryList(chatArea, 'users');
            return;
        }
        renderUserSearchResults(normalizedQuery, chatArea);
        return;
    }

    if (activeSearchSubmenuTab === 'chats') {
        if (!normalizedQuery) {
            renderSearchHistoryList(chatArea, 'chats');
            return;
        }
        renderChatsSearchResults(normalizedQuery, chatArea);
        return;
    }

    if (activeSearchSubmenuTab === 'communities') {
        if (!normalizedQuery) {
            renderSearchHistoryList(chatArea, 'communities');
            return;
        }
        chatArea.innerHTML = '<div class="no-chats-message">Сообщества не найдены</div>';
        return;
    }

    if (activeSearchSubmenuTab === 'downloads') {
        chatArea.innerHTML = '<div class="no-chats-message">Загрузки появятся в следующих версиях</div>';
        return;
    }
    if (activeSearchSubmenuTab === 'music') {
        chatArea.innerHTML = '<div class="no-chats-message">Музыка появится в следующих версиях</div>';
        return;
    }
    if (activeSearchSubmenuTab === 'files') {
        chatArea.innerHTML = '<div class="no-chats-message">Файлы появятся в следующих версиях</div>';
    }
}

function getStoredConversations() {
    if (conversationsStoreCache) return conversationsStoreCache;
    conversationsStoreCache = JSON.parse(localStorage.getItem(CHAT_STORAGE_KEY)) || {};
    return conversationsStoreCache;
}

function persistConversations(store) {
    conversationsStoreCache = store;
    localStorage.setItem(CHAT_STORAGE_KEY, JSON.stringify(store));
}

function schedulePersistConversations() {
    if (conversationsPersistTimer) {
        clearTimeout(conversationsPersistTimer);
    }

    conversationsPersistTimer = setTimeout(() => {
        conversationsPersistTimer = null;
        if (conversationsStoreCache) {
            localStorage.setItem(CHAT_STORAGE_KEY, JSON.stringify(conversationsStoreCache));
        }
    }, 300);
}

function scheduleChatAreaUpdate(options = {}) {
    const nextOptions = options || {};
    pendingChatAreaUpdateOptions = {
        ...(pendingChatAreaUpdateOptions || {}),
        ...nextOptions
    };

    if (chatAreaUpdateRafId) {
        return;
    }

    chatAreaUpdateRafId = requestAnimationFrame(() => {
        chatAreaUpdateRafId = null;
        const scheduledOptions = pendingChatAreaUpdateOptions || {};
        pendingChatAreaUpdateOptions = null;
        updateChatArea(scheduledOptions);
    });
}

function normalizeSupabaseConversationRow(row) {
    const conversationId = row.conversation_id;
    const participants = Array.isArray(row.participants)
        ? row.participants
        : String(row.participants || '')
            .replace(/[{}]/g, '')
            .split(',')
            .map(v => v.trim())
            .filter(Boolean);

    return {
        conversationId,
        participants,
        message: {
            id: row.id,
            remoteId: row.id,
            sender: row.sender_email,
            text: row.body,
            timestamp: Number(row.sent_at || Date.now()),
            deleted_for: Array.isArray(row.deleted_for) ? row.deleted_for : [],
            read_by: Array.isArray(row.read_by) ? row.read_by : [],
            file: row.file
        }
    };
}

function mergeSupabaseMessageRowIntoStore(row) {
    const normalized = normalizeSupabaseConversationRow(row);
    if (!normalized.conversationId || !normalized.participants.length) return;
    if (!normalized.participants.includes(currentUserEmail)) return;

    const store = getStoredConversations();
    if (!store[normalized.conversationId]) {
        store[normalized.conversationId] = {
            id: normalized.conversationId,
            participants: normalized.participants,
            messages: [],
            updatedAt: normalized.message.timestamp
        };
    }

    const conversation = store[normalized.conversationId];
    const alreadyExists = conversation.messages.some(msg => msg.remoteId && msg.remoteId === normalized.message.remoteId);
    if (!alreadyExists) {
        conversation.messages.push(normalized.message);
        conversation.updatedAt = Math.max(conversation.updatedAt || 0, normalized.message.timestamp);
        if (normalized.message.sender !== currentUserEmail) {
            markConversationAsUnread(normalized.conversationId);
        }
    } else {
        conversation.updatedAt = Math.max(conversation.updatedAt || 0, normalized.message.timestamp);
    }

    store[normalized.conversationId] = conversation;
    persistConversations(store);
}

async function loadSupabaseMessagesToLocalStore() {
    const client = getSupabaseClient();
    if (!client || !currentUserEmail || !supabaseMessagesTableAvailable) return;

    let data = null;

    try {
        const result = await client
            .from('messages_app')
            .select('id, conversation_id, participants, sender_email, body, sent_at, deleted_for, read_by, file')
            .order('sent_at', { ascending: true })
            .limit(1000);

        data = result.data;
        const error = result.error;

        if (error) {
            console.error('Erro ao carregar mensagens:', error);
            if (isSupabaseMessagesTableMissing(error)) {
                supabaseMessagesTableAvailable = false;
                if (!supabaseMessagesMissingWarningShown) {
                    console.warn('Supabase table public.messages_app is missing. Chat works in local mode until table is created.');
                    supabaseMessagesMissingWarningShown = true;
                }
            }
            return;
        }
    } catch (err) {
        console.error('Erro ao conectar com Supabase:', err);
        return;
    }
    if (!Array.isArray(data)) return;

    // Не очищаем локальные сообщения перед синхронизацией,
    // иначе у отправителя появляется мигание: сообщение исчезает
    // до прихода ответа из Supabase/realtime, а потом появляется снова.
    data.filter(row => {
        const participants = Array.isArray(row?.participants) ? row.participants : [];
        return participants.includes(currentUserEmail);
    }).forEach(row => mergeSupabaseMessageRowIntoStore(row));
}

async function refreshSupabaseMessagesSilently() {
    const client = getSupabaseClient();
    if (!client || !currentUserEmail || !supabaseMessagesTableAvailable) return;

    await loadSupabaseMessagesToLocalStore();
    if (document.getElementById('screen-main')?.classList.contains('active')) {
        scheduleChatAreaUpdate({ skipRemoteRefresh: true });
    }
}

function startSupabaseMessagesPolling() {
    if (supabaseMessagesPollingStarted) return;
    supabaseMessagesPollingStarted = true;

    setInterval(() => {
        if (document.hidden) return;
        if (!currentUserEmail || !isSupabaseEnabled() || !supabaseMessagesTableAvailable) return;
        refreshSupabaseMessagesSilently().catch(() => {
            // noop
        });
    }, 15000);
}

async function initSupabaseRealtimeChats() {
    const client = getSupabaseClient();
    if (!client || !currentUserEmail || !supabaseMessagesTableAvailable) return;
    if (supabaseChatInitializedForEmail === currentUserEmail) return;

    await loadSupabaseMessagesToLocalStore();
    if (!supabaseMessagesTableAvailable) return;

    if (supabaseMessagesChannel) {
        try {
            await client.removeChannel(supabaseMessagesChannel);
        } catch (_error) {
            // noop
        }
    }

    supabaseMessagesChannel = client
        .channel('messages-app-' + currentUserEmail)
        .on(
            'postgres_changes',
            { event: 'INSERT', schema: 'public', table: 'messages_app' },
            (payload) => {
                const row = payload.new;
                const participants = Array.isArray(row?.participants) ? row.participants : [];
                if (!participants.includes(currentUserEmail)) return;

                mergeSupabaseMessageRowIntoStore(row);
                if (document.getElementById('screen-main')?.classList.contains('active')) {
                    scheduleChatAreaUpdate({ skipRemoteRefresh: true });
                }
            }
        )
        .on(
            'postgres_changes',
            { event: 'UPDATE', schema: 'public', table: 'messages_app' },
            (payload) => {
                const row = payload.new;
                const participants = Array.isArray(row?.participants) ? row.participants : [];
                if (!participants.includes(currentUserEmail)) return;

                // Обновить сообщение в локальном хранилище
                const store = getConversationsStore();
                const conversation = store[row.conversation_id];
                if (conversation) {
                    for (let i = 0; i < conversation.messages.length; i++) {
                        if (conversation.messages[i].id === row.id) {
                            conversation.messages[i].deleted_for = Array.isArray(row.deleted_for) ? row.deleted_for : [];
                            conversation.messages[i].read_by = Array.isArray(row.read_by) ? row.read_by : [];
                            break;
                        }
                    }
                    saveConversationsStore(store);
                }

                if (document.getElementById('screen-main')?.classList.contains('active')) {
                    scheduleChatAreaUpdate({ skipRemoteRefresh: true });
                }
            }
        )
        .on(
            'postgres_changes',
            { event: 'DELETE', schema: 'public', table: 'messages_app' },
            (payload) => {
                const row = payload.old;
                const participants = Array.isArray(row?.participants) ? row.participants : [];
                if (!participants.includes(currentUserEmail)) return;

                const store = getConversationsStore();
                const conversation = store[row.conversation_id];
                if (conversation) {
                    conversation.messages = conversation.messages.filter(msg => msg.id !== row.id);
                    saveConversationsStore(store);
                }

                if (document.getElementById('screen-main')?.classList.contains('active')) {
                    scheduleChatAreaUpdate({ skipRemoteRefresh: true });
                }
            }
        )
        .subscribe();

    supabaseChatInitializedForEmail = currentUserEmail;
}

// При загрузке страницы проверяем, не был ли пользователь уже авторизован
async function bootstrapApp() {
    if (initAppBootstrapped) return;
    initAppBootstrapped = true;

    loadSavedTheme();
    initThemeToggle();
    initImageModal();

    const restoredFromSupabase = await restoreSupabaseSessionIfPossible();
    if (!restoredFromSupabase) {
        const stored = localStorage.getItem('currentUserEmail');
        if (stored) {
            currentUserEmail = stored;
            goToMainScreen();
        } else {
            // Если пользователь нажал "Добавить аккаунт", попал на авторизацию и обновил страницу,
            // возвращаем его в первый ранее авторизованный аккаунт.
            const fallbackAccount = getLoggedInAccounts()[0];
            const fallbackEmail = normalizeEmail(fallbackAccount?.email || '');
            if (fallbackEmail) {
                currentUserEmail = fallbackEmail;
                localStorage.setItem('currentUserEmail', fallbackEmail);
                goToMainScreen();
            }
        }
    }

    const usernameContainer = document.querySelector('.username-container');
    if (usernameContainer) {
        usernameContainer.style.display = 'none';
    }

    initNavigation();
    setTimeout(() => {
        initProfileMenu();
    }, 500);
    initSearchToggle();
    initMessaging();
}

window.addEventListener('DOMContentLoaded', () => {
    bootstrapApp();
});

// Функция переключения экранов
function goToScreen(screenId) {
    document.querySelectorAll('.screen').forEach(screen => {
        screen.classList.remove('active');
    });
    document.getElementById(screenId).classList.add('active');

    requestAnimationFrame(() => {
        const inners = document.querySelectorAll('#' + screenId + ' .profile-media-tabs-inner, #' + screenId + ' .chat-submenu-inner');
        inners.forEach((node) => {
            if (typeof node.__refreshSubmenuIndicator === 'function') {
                node.__refreshSubmenuIndicator();
            }
        });
    });

    const authCard = document.getElementById('auth-card');
    if (authCard) {
        authCard.style.display = screenId === 'screen-main' ? 'none' : 'block';
    }

    if(screenId === 'screen-reset-code') {
        setTimeout(() => document.querySelector('.reset-code-input').focus(), 100);
    }
    
    // Обновляем активный пункт навигации с анимацией
    updateActiveNavItem(screenId);
}

// Функция перехода на главный экран
function goToMainScreen() {
    if (currentUserEmail) {
        // Убедимся, что email сохранён в localStorage (для обновления страницы)
        if (!localStorage.getItem('currentUserEmail')) {
            localStorage.setItem('currentUserEmail', currentUserEmail);
        }
        
        // Добавляем текущий аккаунт в список сохранённых
        addAccountToLoggedList(currentUserEmail);

        const emailDisplay = document.getElementById('display-email');
        if (emailDisplay) emailDisplay.textContent = currentUserEmail;
        
        const joinDateDisplay = document.getElementById('display-join-date');
        if (joinDateDisplay) {
            const today = new Date();
            const options = { year: 'numeric', month: 'long', day: 'numeric' };
            joinDateDisplay.textContent = today.toLocaleDateString('ru-RU', options);
        }
        
        // Загружаем аватар
        loadUserAvatar();
        
        // Обновляем отображение имени пользователя в профиле
        updateProfileUsernameDisplay();

        // Добавляем класс logged-in для отображения навигации
        document.documentElement.classList.add('logged-in');

        goToScreen('screen-main');

        const searchInput = document.getElementById('chat-search');
        if (searchInput) {
            searchInput.value = '';
        }

        activeConversationId = null;
        activeThreadDom = null;
        lastRenderedConversationSignature = '';
        scheduleChatAreaUpdate({ skipRemoteRefresh: true });

        if (isSupabaseEnabled()) {
            syncCurrentUserProfileToSupabase().then(() => {
                return syncSupabaseProfilesToLocalDirectory(true);
            }).then(() => {
                scheduleChatAreaUpdate({ skipRemoteRefresh: true });
            });

            initSupabaseRealtimeChats().then(() => {
                startSupabaseMessagesPolling();
                startUserPresencePolling();
                scheduleChatAreaUpdate({ skipRemoteRefresh: true });
            });
        }
        
        // Обновляем профиль при переходе на главный экран
        setTimeout(() => {
            createUsernameDisplay();
            createAccountDetailsSection();
            initProfileMenu();
        }, 100);
    } else {
        goToScreen('screen-login');
    }
}

// Функция загрузки аватара пользователя
function loadUserAvatar() {
    const savedAvatar = localStorage.getItem('userAvatar_' + currentUserEmail);
    const userDisplayName = localStorage.getItem('userDisplayName_' + currentUserEmail) || 'Пользователь';
    
    // Аватар в шапке
    const avatarBtn = document.getElementById('avatar-btn');
    // Аватар в профиле
    const profileAvatar = document.getElementById('profile-avatar-display');
    // Аватар в редакторе
    const editAvatar = document.getElementById('edit-avatar-display');
    
    if (savedAvatar) {
        // Если есть загруженный аватар, используем его
        const avatarUrl = savedAvatar;
        
        if (avatarBtn) {
            avatarBtn.style.backgroundImage = `url(${avatarUrl})`;
            avatarBtn.style.backgroundSize = 'cover';
            avatarBtn.style.backgroundPosition = 'center';
            avatarBtn.style.backgroundColor = 'transparent';
        }
        
        if (profileAvatar) {
            profileAvatar.style.backgroundImage = `url(${avatarUrl})`;
            profileAvatar.style.backgroundSize = 'cover';
            profileAvatar.style.backgroundPosition = 'center';
            profileAvatar.style.backgroundColor = 'transparent';
        }
        
        if (editAvatar) {
            editAvatar.style.backgroundImage = `url(${avatarUrl})`;
            editAvatar.style.backgroundSize = 'cover';
            editAvatar.style.backgroundPosition = 'center';
            editAvatar.style.backgroundColor = 'transparent';
        }
    } else {
        // Если нет загруженного аватара, создаем аватар с первой буквой
        const firstLetter = userDisplayName.charAt(0).toUpperCase();
        const colors = ['#ff5e98', '#8b41df', '#30a1ff', '#00e676', '#ff9800', '#f44336', '#00bcd4'];
        const randomColor = colors[Math.floor(Math.random() * colors.length)];
        
        // Создаем canvas для генерации изображения с буквой
        const canvas = document.createElement('canvas');
        canvas.width = 200;
        canvas.height = 200;
        const ctx = canvas.getContext('2d');
        
        // Рисуем квадратную подложку, чтобы при увеличении аватар был квадратным.
        ctx.fillStyle = randomColor;
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        
        // Рисуем букву
        ctx.font = 'bold 100px Inter, sans-serif';
        ctx.fillStyle = 'white';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(firstLetter, 100, 100);
        
        const avatarDataUrl = canvas.toDataURL();
        
        // Сохраняем сгенерированный аватар
        localStorage.setItem('userAvatar_' + currentUserEmail, avatarDataUrl);
        
        // Применяем аватар
        if (avatarBtn) {
            avatarBtn.style.backgroundImage = `url(${avatarDataUrl})`;
            avatarBtn.style.backgroundSize = 'cover';
            avatarBtn.style.backgroundPosition = 'center';
            avatarBtn.style.backgroundColor = 'transparent';
        }
        
        if (profileAvatar) {
            profileAvatar.style.backgroundImage = `url(${avatarDataUrl})`;
            profileAvatar.style.backgroundSize = 'cover';
            profileAvatar.style.backgroundPosition = 'center';
            profileAvatar.style.backgroundColor = 'transparent';
        }
        
        if (editAvatar) {
            editAvatar.style.backgroundImage = `url(${avatarDataUrl})`;
            editAvatar.style.backgroundSize = 'cover';
            editAvatar.style.backgroundPosition = 'center';
            editAvatar.style.backgroundColor = 'transparent';
        }
    }
}

// Функция обновления отображения имени в профиле
function updateProfileUsernameDisplay() {
    const usernameDisplay = document.querySelector('.profile-username-display');
    if (usernameDisplay && currentUserEmail) {
        const savedDisplayName = localStorage.getItem('userDisplayName_' + currentUserEmail);
        usernameDisplay.textContent = savedDisplayName || 'Пользователь';
    }
}

// Функция полного выхода (без переключения на другой аккаунт)
function performFullLogout() {
    const client = getSupabaseClient();
    if (client) {
        if (supabaseMessagesChannel) {
            client.removeChannel(supabaseMessagesChannel).catch(() => {
                // ignore
            });
            supabaseMessagesChannel = null;
        }
        supabaseChatInitializedForEmail = null;
        client.auth.signOut().catch(() => {
            // Если удаленный выход не удался, все равно очищаем локальную сессию.
        });
    }

    currentUserEmail = null;
    activeConversationId = null;
    activeThreadDom = null;
    lastRenderedConversationSignature = '';
    localStorage.removeItem('currentUserEmail');
    document.documentElement.classList.remove('logged-in');
    
    // Очищаем аватары
    const avatarBtn = document.getElementById('avatar-btn');
    if (avatarBtn) {
        avatarBtn.style.backgroundImage = 'none';
        avatarBtn.style.backgroundColor = 'rgba(255,255,255,0.1)';
    }
    
    const profileAvatar = document.getElementById('profile-avatar-display');
    if (profileAvatar) {
        profileAvatar.style.backgroundImage = 'none';
        profileAvatar.style.backgroundColor = 'rgba(255,255,255,0.1)';
    }

    // Скрываем поиск, если был открыт
    const searchInput = document.getElementById('chat-search');
    if (searchInput) searchInput.classList.remove('active');
    
    goToScreen('screen-login');
}

// Обновлённая функция выхода (удаляет текущий аккаунт и переключается на другой, если есть)
function logout() {
    const accounts = getLoggedInAccounts();
    const otherAccounts = accounts.filter(acc => acc.email !== currentUserEmail);
    
    // Удаляем текущий аккаунт из списка
    removeAccount(currentUserEmail);

    if (otherAccounts.length > 0) {
        // Переключаемся на первый другой аккаунт
        switchToAccount(otherAccounts[0].email);
    } else {
        // Если других нет, выходим полностью
        performFullLogout();
    }
}

// Элементы профиля
const avatarBtn = document.getElementById('avatar-btn');
const backFromProfileBtn = document.getElementById('back-from-profile');
const backFromEditBtn = document.getElementById('back-from-edit');
const logoutBtnProfile = document.getElementById('logout-btn-profile');
const changeAvatarBtn = document.getElementById('change-avatar-btn');
const avatarUpload = document.getElementById('avatar-upload');
const profileAvatarDisplay = document.getElementById('profile-avatar-display');
const saveProfileBtn = document.getElementById('save-profile-btn');
const servicesBtn = document.getElementById('services-btn');
const businessAccountBtn = document.getElementById('business-account-btn');

// Элементы отображения
const displayName = document.getElementById('profile-display-name');
const displayPhone = document.getElementById('display-phone');
const displayUsername = document.getElementById('display-username');
const displayBirthday = document.getElementById('display-birthday');
const displayEmail = document.getElementById('display-email');
const displayJoinDate = document.getElementById('display-join-date');

// Элементы редактирования
const editDisplayName = document.getElementById('edit-display-name');
const editUsername = document.getElementById('edit-username');
const editPhone = document.getElementById('edit-phone');
const editBirthday = document.getElementById('edit-birthday');
const editStatus = document.getElementById('edit-status');

// Элементы для редактирования аватара
const editAvatarDisplay = document.getElementById('edit-avatar-display');
const editChangeAvatarBtn = document.getElementById('edit-change-avatar-btn');
const editCountryPicker = document.getElementById('edit-country-picker');
const editCurrentFlag = document.getElementById('edit-current-flag');
const editCurrentCode = document.getElementById('edit-current-code');

function collapseSquareAvatars() {
    document.querySelectorAll('.avatar-wrapper-glass.square-expanded').forEach(wrapper => {
        wrapper.classList.remove('square-expanded');
    });
}

function toggleAvatarSquarePreview(avatarElement) {
    const wrapper = avatarElement?.closest('.avatar-wrapper-glass');
    if (!wrapper) return;

    const shouldExpand = !wrapper.classList.contains('square-expanded');
    collapseSquareAvatars();

    if (shouldExpand) {
        wrapper.classList.add('square-expanded');
    }
}

document.addEventListener('click', (event) => {
    if (!event.target.closest('.avatar-wrapper-glass.square-expanded')) {
        collapseSquareAvatars();
    }
});

if (profileAvatarDisplay) {
    profileAvatarDisplay.addEventListener('click', (event) => {
        event.stopPropagation();
        toggleAvatarSquarePreview(profileAvatarDisplay);
    });
}

const userProfileAvatarDisplay = document.getElementById('user-profile-avatar-display');
if (userProfileAvatarDisplay) {
    userProfileAvatarDisplay.addEventListener('click', (event) => {
        event.stopPropagation();
        toggleAvatarSquarePreview(userProfileAvatarDisplay);
    });
}

// Функция обновления отображаемых данных
function updateDisplayData() {
    if (!currentUserEmail) return;
    
    const savedDisplayName = localStorage.getItem('userDisplayName_' + currentUserEmail);
    const savedUsername = localStorage.getItem('userName_' + currentUserEmail);
    const savedPhone = localStorage.getItem('userPhone_' + currentUserEmail);
    const savedBirthday = localStorage.getItem('userBirthday_' + currentUserEmail);
    const savedStatus = localStorage.getItem('userStatus_' + currentUserEmail);
    
    // Обновляем имя под аватаркой
    const usernameDisplay = document.querySelector('.profile-username-display');
    if (usernameDisplay) {
        usernameDisplay.textContent = savedDisplayName || 'Пользователь';
    }
    
    // Обновляем секцию с деталями
    createAccountDetailsSection();
}

// Функция загрузки данных в форму редактирования
function loadEditData() {
    if (!currentUserEmail) return;
    
    const savedDisplayName = localStorage.getItem('userDisplayName_' + currentUserEmail);
    const savedUsername = localStorage.getItem('userName_' + currentUserEmail);
    const savedPhone = localStorage.getItem('userPhone_' + currentUserEmail);
    const savedBirthday = localStorage.getItem('userBirthday_' + currentUserEmail);
    const savedStatus = localStorage.getItem('userStatus_' + currentUserEmail);
    const savedGlowColor = localStorage.getItem('glowColor_' + currentUserEmail) || 'gradient';
    
    if (editDisplayName) editDisplayName.value = savedDisplayName || '';
    if (editUsername) editUsername.value = savedUsername || '';
    if (editPhone) editPhone.value = savedPhone || '';
    if (editBirthday) editBirthday.value = savedBirthday || '';
    if (editStatus) editStatus.value = savedStatus || '';
    
    // Загружаем аватар
    const savedAvatar = localStorage.getItem('userAvatar_' + currentUserEmail);
    if (savedAvatar && editAvatarDisplay) {
        editAvatarDisplay.style.backgroundImage = `url(${savedAvatar})`;
        editAvatarDisplay.style.backgroundSize = 'cover';
        editAvatarDisplay.style.backgroundPosition = 'center';
        editAvatarDisplay.style.backgroundColor = 'transparent';
    }
    
    // Устанавливаем цвет свечения
    setGlowColor(savedGlowColor);
}

// Функция сохранения данных из формы редактирования
function saveEditData() {
    if (!currentUserEmail) return;
    
    if (editDisplayName) localStorage.setItem('userDisplayName_' + currentUserEmail, editDisplayName.value);
    
    // Сохраняем username без @, но при отображении будем добавлять @
    let usernameValue = editUsername.value;
    if (usernameValue.startsWith('@')) {
        usernameValue = usernameValue.substring(1);
    }
    if (editUsername) localStorage.setItem('userName_' + currentUserEmail, usernameValue);
    
    if (editPhone) localStorage.setItem('userPhone_' + currentUserEmail, editPhone.value);
    if (editBirthday) localStorage.setItem('userBirthday_' + currentUserEmail, editBirthday.value);
    if (editStatus) localStorage.setItem('userStatus_' + currentUserEmail, editStatus.value);
    
    // Сохраняем цвет свечения
    const selectedColor = document.querySelector('.glow-color-option.selected');
    if (selectedColor) {
        const color = selectedColor.getAttribute('data-color');
        localStorage.setItem('glowColor_' + currentUserEmail, color);
    }

    // Синхронизируем данные с базой пользователей, чтобы профиль корректно открывался в чатах.
    const users = JSON.parse(localStorage.getItem('socialNetworkUsers')) || [];
    const userIndex = users.findIndex(user => user.email === currentUserEmail);
    if (userIndex !== -1) {
        const existingUser = users[userIndex];
        users[userIndex] = {
            ...existingUser,
            username: localStorage.getItem('userName_' + currentUserEmail) || existingUser.username || '',
            phone: localStorage.getItem('userPhone_' + currentUserEmail) || existingUser.phone || '',
            birthday: localStorage.getItem('userBirthday_' + currentUserEmail) || existingUser.birthday || '',
            status: localStorage.getItem('userStatus_' + currentUserEmail) || existingUser.status || '',
            glowColor: localStorage.getItem('glowColor_' + currentUserEmail) || existingUser.glowColor || 'gradient'
        };
        localStorage.setItem('socialNetworkUsers', JSON.stringify(users));
        invalidateUsersDirectoryCache();
    }
    
    // Обновляем имя в аватаре, если нет загруженного аватара
    const savedAvatar = localStorage.getItem('userAvatar_' + currentUserEmail);
    if (!savedAvatar) {
        loadUserAvatar(); // Перегенерируем аватар с новой первой буквой
    }

    if (isSupabaseEnabled()) {
        syncCurrentUserProfileToSupabase().then(() => {
            return syncSupabaseProfilesToLocalDirectory(true);
        }).then(() => {
            updateChatArea();
        });
    }
    
    updateDisplayData();
    goToScreen('screen-profile');
}

// Функция копирования текста
function copyToClipboard(text) {
    navigator.clipboard.writeText(text).then(() => {
        const notification = document.createElement('div');
        notification.className = 'copy-notification';
        notification.textContent = 'Скопировано!';
        document.body.appendChild(notification);
        
        setTimeout(() => {
            notification.remove();
        }, 2000);
    });
}

// Обработчик клика по аватару в шапке
if (avatarBtn) {
    avatarBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        goToScreen('screen-profile');
        
        loadUserAvatar();
        
        // Создаем отображение имени
        createUsernameDisplay();
        
        // Создаем секцию с деталями
        createAccountDetailsSection();
        
        // Инициализируем меню профиля
        setTimeout(() => {
            initProfileMenu();
        }, 100);
        
        updateDisplayData();
    });
}

// Обработчик кнопки "Назад" из профиля
if (backFromProfileBtn) {
    backFromProfileBtn.addEventListener('click', () => {
        goToScreen('screen-main');
    });
}

// Обработчик кнопки "Назад" из редактирования
if (backFromEditBtn) {
    backFromEditBtn.addEventListener('click', () => {
        goToScreen('screen-profile');
    });
}

// Обработчик кнопки "Сохранить"
if (saveProfileBtn) {
    saveProfileBtn.addEventListener('click', () => {
        saveEditData();
    });
}

// Обработчик кнопки выхода (старый, скрыт)
if (logoutBtnProfile) {
    logoutBtnProfile.addEventListener('click', () => {
        logout();
    });
}

// Обработчик кнопки "Сервисы" (теперь переход на экран сервисов)
if (servicesBtn) {
    servicesBtn.addEventListener('click', goToServicesScreen);
}

// Обработчик кнопки "Business Account"
if (businessAccountBtn) {
    businessAccountBtn.addEventListener('click', () => {
        alert('Margelet Business не активен');
    });
}

// Смена аватарки
if (changeAvatarBtn && avatarUpload) {
    changeAvatarBtn.addEventListener('click', () => {
        avatarUpload.click();
    });
    
    avatarUpload.addEventListener('change', (e) => {
        const file = e.target.files[0];
        if (file && currentUserEmail) {
            const reader = new FileReader();
            reader.onload = (event) => {
                localStorage.setItem('userAvatar_' + currentUserEmail, event.target.result);
                loadUserAvatar();
            };
            reader.readAsDataURL(file);
        }
    });
}

// Обработка регистрации - теперь с именем пользователя
document.getElementById('register-form').addEventListener('submit', function(e) {
    e.preventDefault(); 
    
    const inputs = e.target.querySelectorAll('input');
    const email = normalizeEmail(inputs[0].value);
    const password = inputs[1].value;
    if (!email) {
        alert('Введите корректную почту');
        return;
    }
    
    const users = JSON.parse(localStorage.getItem('socialNetworkUsers')) || [];
    const userExistsLocally = users.some(u => normalizeEmail(u.email) === email);

    if (userExistsLocally && !isSupabaseEnabled()) {
        alert('Пользователь с такой почтой уже существует!');
        return;
    }

    // Сохраняем данные для следующего шага
    currentRegistrationEmail = email;
    currentRegistrationPassword = password;

    // Переходим на экран ввода имени
    goToScreen('screen-name');
});

// Обработка ввода имени
const nameForm = document.getElementById('name-form');
if (nameForm) {
    nameForm.addEventListener('submit', async function(e) {
        e.preventDefault();
        const nameInput = document.getElementById('register-name');
        const name = nameInput.value.trim();
        
        if (name) {
            currentRegistrationName = name;
            await registerCurrentPendingUser();
        } else {
            alert('Введите имя пользователя');
        }
    });
}

function completeSuccessfulLogin(email, displayName = '') {
    currentUserEmail = normalizeEmail(email);
    if (!currentUserEmail) return;
    localStorage.setItem('currentUserEmail', currentUserEmail);
    if (displayName) {
        localStorage.setItem('userDisplayName_' + currentUserEmail, displayName);
    }
    upsertUserInLocalDirectory(currentUserEmail, displayName);
    document.documentElement.classList.add('logged-in');
    addAccountToLoggedList(currentUserEmail);
    goToMainScreen();
}

function tryLegacyLocalLogin(email, password) {
    const normalizedEmail = normalizeEmail(email);
    const users = getLocalUsersSafe();
    const user = users.find(u => normalizeEmail(u.email) === normalizedEmail && u.password === password);
    if (!user) return false;

    completeSuccessfulLogin(normalizeEmail(user.email), user.name || '');
    return true;
}

function getLegacyLocalUserByEmail(email) {
    const normalizedEmail = normalizeEmail(email);
    const users = getLocalUsersSafe();
    return users.find(u => normalizeEmail(u.email) === normalizedEmail) || null;
}

async function migrateLegacyUserToSupabase(legacyUser) {
    const client = getSupabaseClient();
    if (!client || !legacyUser?.email || !legacyUser?.password) return;

    const normalizedEmail = normalizeEmail(legacyUser.email);
    if (Date.now() < getSignupCooldownUntil(normalizedEmail)) return;

    const throttleKey = 'legacySupabaseMigrationAttempt_' + normalizedEmail;
    const now = Date.now();
    const lastAttempt = Number(localStorage.getItem(throttleKey) || 0);
    // Не дергаем signUp чаще одного раза в сутки для одного legacy аккаунта.
    if (now - lastAttempt < 24 * 60 * 60 * 1000) return;
    localStorage.setItem(throttleKey, String(now));

    const { error } = await client.auth.signUp({
        email: legacyUser.email,
        password: legacyUser.password,
        options: {
            data: {
                display_name: legacyUser.name || legacyUser.email.split('@')[0] || 'Пользователь'
            },
            skipEmailVerification: true
        }
    });

    if (!error) return;

    const reason = String(error.message || '').toLowerCase();
    const alreadyExists = reason.includes('already') || reason.includes('registered') || reason.includes('exists');
    if (!alreadyExists) {
        // Миграция вторична: не блокируем вход, только логируем для диагностики.
        console.warn('Не удалось автоматически мигрировать локальный аккаунт в Supabase:', error.message);
    }
}

// Обработка входа
document.getElementById('login-form').addEventListener('submit', async function(e) {
    e.preventDefault();
    
    const inputs = e.target.querySelectorAll('input');
    const email = normalizeEmail(inputs[0].value);
    const password = inputs[1].value;
    const legacyUserByEmail = getLegacyLocalUserByEmail(email);

    // Для аккаунтов, созданных до Supabase, не стреляем в signInWithPassword каждый раз
    // (это и давало постоянные 400 в консоли).
    if (legacyUserByEmail && legacyUserByEmail.password === password) {
        completeSuccessfulLogin(legacyUserByEmail.email, legacyUserByEmail.name || '');
        migrateLegacyUserToSupabase(legacyUserByEmail).catch(() => {
            // Миграция выполняется фоном и не должна мешать пользователю.
        });
        return;
    }
    
    // БЕЗ Supabase Auth - используем только localStorage (без лимитов!)
    if (!tryLegacyLocalLogin(email, password)) {
        alert('Аккаунт не найден или пароль неверный.');
        return;
    }
});

async function registerCurrentPendingUser() {
    if (registrationRequestInFlight) return;
    if (!currentRegistrationEmail || !currentRegistrationPassword || !currentRegistrationName) return;

    registrationRequestInFlight = true;
    try {
        // Сохраняем только в localStorage и в базу, БЕЗ Supabase Auth (без лимитов!)
        const users = getLocalUsersSafe();
        
        // Проверяем, не существует ли уже такой email
        if (users.some(u => normalizeEmail(u.email) === normalizeEmail(currentRegistrationEmail))) {
            alert('Аккаунт с такой почтой уже существует');
            registrationRequestInFlight = false;
            return;
        }

        // Добавляем в localStorage
        users.push({ 
            email: currentRegistrationEmail, 
            password: currentRegistrationPassword,
            name: currentRegistrationName
        });
        const saved = saveLocalUsersSafe(users);
        if (!saved) {
            alert('Не удалось сохранить новый аккаунт: переполнено хранилище браузера. Очистите часть данных сайта и повторите.');
            return;
        }

        // Завершаем регистрацию единым проверенным сценарием логина.
        completeSuccessfulLogin(currentRegistrationEmail, currentRegistrationName);

        currentRegistrationEmail = null;
        currentRegistrationPassword = null;
        currentRegistrationName = null;
    } catch (error) {
        console.error('Ошибка регистрации:', error);
        const isQuotaExceeded = String(error?.name || '').includes('QuotaExceeded') || String(error?.message || '').toLowerCase().includes('quota');
        if (isQuotaExceeded) {
            alert('Переполнено хранилище браузера (localStorage). Очистите часть данных сайта и повторите регистрацию.');
        } else {
            alert('Не удалось завершить регистрацию. Попробуйте снова.');
        }
    } finally {
        registrationRequestInFlight = false;
    }
}

// База стран
const countries = [
    { name: "Россия", code: "+7", flag: "RU" },
    { name: "Украина", code: "+380", flag: "UA" },
    { name: "Беларусь", code: "+375", flag: "BY" },
    { name: "Казахстан", code: "+7", flag: "KZ" },
    { name: "Узбекистан", code: "+998", flag: "UZ" },
    { name: "США", code: "+1", flag: "US" },
    { name: "Германия", code: "+49", flag: "DE" },
    { name: "Франция", code: "+33", flag: "FR" },
    { name: "Великобритания", code: "+44", flag: "GB" },
    { name: "Турция", code: "+90", flag: "TR" }
];

const countryPickerTrigger = document.getElementById('country-picker-trigger');
const countryDropdown = document.getElementById('country-dropdown');
const countryList = document.getElementById('country-list');
const countrySearch = document.getElementById('country-search');
const currentFlag = document.getElementById('current-flag');
const currentCode = document.getElementById('current-code');

function renderCountries(filter = '') {
    countryList.innerHTML = '';
    const filtered = countries.filter(c => c.name.toLowerCase().includes(filter.toLowerCase()));
    
    filtered.forEach(country => {
        const li = document.createElement('li');
        li.className = 'country-item';
        li.innerHTML = `
            <span class="flag">${country.flag}</span>
            <span class="name">${country.name}</span>
            <span class="code">${country.code}</span>
        `;
        li.onclick = () => {
            currentFlag.textContent = country.flag;
            currentCode.textContent = country.code;
            countryDropdown.classList.remove('show');
        };
        countryList.appendChild(li);
    });
}

if (countryPickerTrigger) {
    countryPickerTrigger.onclick = (e) => {
        e.stopPropagation();
        countryDropdown.classList.toggle('show');
        if (countryDropdown.classList.contains('show') && countrySearch) countrySearch.focus();
    };
}

if (countrySearch) {
    countrySearch.oninput = (e) => renderCountries(e.target.value);
}

document.addEventListener('click', () => {
    if (countryDropdown) countryDropdown.classList.remove('show');
});

renderCountries();

// Сброс пароля
function startPasswordReset() {
    const loginEmailInput = document.getElementById('login-email');
    const resetEmailInput = document.getElementById('reset-email-input');
    
    if (loginEmailInput && loginEmailInput.value) {
        resetEmailInput.value = loginEmailInput.value;
    }
    goToScreen('screen-reset-email');
}

document.getElementById('reset-email-form').addEventListener('submit', async function(e) {
    e.preventDefault();
    if (passwordResetRequestInFlight) return;

    const email = normalizeEmail(document.getElementById('reset-email-input').value);
    const client = getSupabaseClient();

    if (client) {
        const throttleKey = 'passwordResetLastRequestAt_' + String(email).toLowerCase();
        const now = Date.now();
        const lastAttempt = Number(localStorage.getItem(throttleKey) || 0);
        if (now - lastAttempt < 60 * 1000) {
            alert('Подождите 60 секунд перед повторной отправкой письма.');
            return;
        }

        passwordResetRequestInFlight = true;
        localStorage.setItem(throttleKey, String(now));
        const redirectTo = window.location.origin + window.location.pathname;
        const { error } = await client.auth.resetPasswordForEmail(email, { redirectTo });
        if (error) {
            const reason = String(error.message || '').toLowerCase();
            const isRateLimit = error.status === 429 || reason.includes('too many requests') || reason.includes('over_email_send_rate_limit');
            if (isRateLimit) {
                alert('Слишком много запросов на восстановление. Подождите 1-2 минуты и попробуйте снова.');
            } else {
                alert('Не удалось отправить письмо для сброса: ' + error.message);
            }
            passwordResetRequestInFlight = false;
            return;
        }

        passwordResetRequestInFlight = false;
        alert('Письмо для сброса отправлено. Перейдите по ссылке из письма.');
        goToScreen('screen-login');
        return;
    }

    const users = JSON.parse(localStorage.getItem('socialNetworkUsers')) || [];
    const userExists = users.some(u => u.email === email);

    if (!userExists) {
        alert('Аккаунт с такой почтой не найден!');
        return;
    }

    resetEmailTarget = email;
    goToScreen('screen-reset-code');
});

const resetCodeInputs = document.querySelectorAll('.reset-code-input');

resetCodeInputs.forEach((input, index) => {
    input.addEventListener('input', (e) => {
        e.target.value = e.target.value.replace(/[^0-9]/g, ''); 
        if (e.target.value !== '') {
            if (index < resetCodeInputs.length - 1) resetCodeInputs[index + 1].focus();
            checkResetCodeComplete();
        }
    });

    input.addEventListener('keydown', (e) => {
        if (e.key === 'Backspace' && e.target.value === '' && index > 0) {
            resetCodeInputs[index - 1].focus();
            resetCodeInputs[index - 1].value = '';
        }
    });

    input.addEventListener('paste', (e) => {
        e.preventDefault();
        const pastedData = e.clipboardData.getData('text').replace(/[^0-9]/g, '').slice(0, resetCodeInputs.length);
        pastedData.split('').forEach((char, i) => {
            if (index + i < resetCodeInputs.length) resetCodeInputs[index + i].value = char;
        });
        const nextFocusIndex = Math.min(index + pastedData.length, resetCodeInputs.length - 1);
        resetCodeInputs[nextFocusIndex].focus();
        checkResetCodeComplete();
    });
});

function checkResetCodeComplete() {
    const isComplete = Array.from(resetCodeInputs).every(input => input.value !== '');
    if (isComplete) {
        resetCodeInputs.forEach(input => input.blur());
        setTimeout(() => {
            resetCodeInputs.forEach(input => input.classList.add('success'));
            setTimeout(() => {
                resetCodeInputs.forEach(input => {
                    input.classList.remove('success');
                    input.value = '';
                });
                goToScreen('screen-new-password');
            }, 1000);
        }, 300);
    }
}

document.getElementById('new-password-form').addEventListener('submit', async function(e) {
    e.preventDefault();
    const newPassword = document.getElementById('new-password-input').value;
    const client = getSupabaseClient();
    if (client) {
        const { data: sessionData } = await client.auth.getSession();
        if (!sessionData?.session) {
            alert('Для смены пароля откройте ссылку из письма и попробуйте снова.');
            goToScreen('screen-login');
            return;
        }

        const { error } = await client.auth.updateUser({ password: newPassword });
        if (error) {
            alert('Не удалось обновить пароль: ' + error.message);
            return;
        }

        alert('Пароль обновлен.');
        currentUserEmail = sessionData.session.user.email;
        localStorage.setItem('currentUserEmail', currentUserEmail);
        document.documentElement.classList.add('logged-in');
        goToMainScreen();
        return;
    }

    const users = JSON.parse(localStorage.getItem('socialNetworkUsers')) || [];
    const userIndex = users.findIndex(u => u.email === resetEmailTarget);
    if (userIndex !== -1) {
        users[userIndex].password = newPassword;
        localStorage.setItem('socialNetworkUsers', JSON.stringify(users));

        currentUserEmail = resetEmailTarget;
        document.documentElement.classList.add('logged-in');
        goToMainScreen();
    }
});

// Обновляем отображение чата - только надпись, без функционала
function updateChatArea(options = {}) {
    const chatArea = document.getElementById('chat-area');
    const chatForm = document.getElementById('chat-form');
    const messageInput = document.getElementById('chat-message-input');
    const searchInput = document.getElementById('chat-search');

    if (!chatArea || !chatForm || !messageInput) return;

    if (!currentUserEmail) {
        chatArea.innerHTML = '<div class="no-chats-message">Сначала войдите в аккаунт</div>';
        chatForm.classList.add('hidden');
        updateBottomNavigationVisibility();
        return;
    }

    const query = (searchInput?.value || '').trim();

    if (searchModeActive) {
        renderSearchMode(chatArea, query);
        chatForm.classList.add('hidden');
        updateBottomNavigationVisibility();
        return;
    }

    if (query) {
        renderUserSearchResults(query, chatArea);
        chatForm.classList.add('hidden');
        updateBottomNavigationVisibility();
        return;
    }

    if (activeMainSubmenuTab !== 'chats') {
        if (activeMainSubmenuTab === 'contacts') {
            renderContactsList(chatArea);
        } else {
            renderCommunitiesList(chatArea);
        }
        chatForm.classList.add('hidden');
        updateBottomNavigationVisibility();
        return;
    }

    if (activeConversationId) {
        const conversation = getConversationById(activeConversationId);
        if (conversation && conversation.participants.includes(currentUserEmail)) {
            renderConversationThread(chatArea, conversation);
            chatForm.classList.remove('hidden');
            updateBottomNavigationVisibility();
            return;
        }

        activeConversationId = null;
        activeThreadDom = null;
        lastRenderedConversationSignature = '';
    }

    renderConversationsList(chatArea);
    chatForm.classList.add('hidden');
    updateBottomNavigationVisibility();
}

function renderCommunitiesList(chatArea) {
    chatArea.innerHTML = '<div class="no-chats-message">Раздел Сообщества скоро появится</div>';
}

function updateBottomNavigationVisibility() {
    const root = document.documentElement;
    const screenMain = document.getElementById('screen-main');
    const userProfileScreen = document.getElementById('screen-user-profile');
    const threadView = document.querySelector('#chat-area .thread-view');
    const isMainActive = Boolean(screenMain && screenMain.classList.contains('active'));
    const isThreadOpen = Boolean(threadView && isMainActive);
    const isUserProfileOpen = Boolean(userProfileScreen && userProfileScreen.classList.contains('active'));

    root.classList.toggle('chat-thread-open', isThreadOpen);
    root.classList.toggle('user-profile-open', isUserProfileOpen);
}


function normalizePhone(value = '') {
    return String(value).replace(/\D/g, '');
}

function escapeHtml(value = '') {
    return String(value)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

function normalizeUsername(value = '') {
    return String(value).trim().replace(/^@/, '').toLowerCase();
}

function getCachedUsersDirectory() {
    const raw = localStorage.getItem('socialNetworkUsers') || '[]';
    if (cachedUsersDirectory && cachedUsersDirectoryRaw === raw) {
        return cachedUsersDirectory;
    }

    cachedUsersDirectoryRaw = raw;
    cachedUsersDirectory = JSON.parse(raw) || [];
    return cachedUsersDirectory;
}

function invalidateUsersDirectoryCache() {
    cachedUsersDirectory = null;
    cachedUsersDirectoryRaw = null;
}

function getUserRecordByEmail(email) {
    const normalizedEmail = normalizeEmail(email);
    if (!normalizedEmail) return null;
    const users = getCachedUsersDirectory();
    return users.find(user => normalizeEmail(user.email) === normalizedEmail) || null;
}

function getDisplayNameByEmail(email) {
    const displayName = localStorage.getItem('userDisplayName_' + email);
    if (displayName && displayName.trim()) return displayName.trim();

    const user = getUserRecordByEmail(email);
    if (user?.name) return user.name;

    return email.split('@')[0] || 'Пользователь';
}

function getUsernameByEmail(email) {
    const usernameFromStorage = localStorage.getItem('userName_' + email) || '';
    if (usernameFromStorage.trim()) return normalizeUsername(usernameFromStorage);

    const user = getUserRecordByEmail(email);
    const usernameFromRecord = user?.username || user?.userName || '';
    if (String(usernameFromRecord).trim()) return normalizeUsername(usernameFromRecord);

    // Используем часть email как стабильный fallback username.
    return normalizeUsername((email || '').split('@')[0] || '');
}

function getPhoneByEmail(email) {
    const phoneFromStorage = localStorage.getItem('userPhone_' + email) || '';
    if (String(phoneFromStorage).trim()) return phoneFromStorage;

    const user = getUserRecordByEmail(email);
    return user?.phone || user?.phoneNumber || user?.mobile || '';
}

function getAvatarByEmail(email) {
    const avatarFromStorage = localStorage.getItem('userAvatar_' + email);
    if (avatarFromStorage) return avatarFromStorage;

    const user = getUserRecordByEmail(email);
    return user?.avatar || user?.avatarUrl || null;
}

function getUserPresenceText(email) {
    if (!email) return 'не в сети';
    return userPresenceMap[email] ? 'в сети' : 'не в сети';
}

function getUserPresenceUpdatedAt(email) {
    const user = getUserRecordByEmail(email);
    return Number(user?.lastSeenAt || 0);
}

async function updateCurrentUserPresenceOnline() {
    const client = getSupabaseClient();
    if (!client || !currentUserEmail || !supabaseProfilesTableAvailable) return;

    const timestamp = new Date().toISOString();
    const { error } = await client
        .from('profiles')
        .upsert([
            {
                email: currentUserEmail,
                display_name: getDisplayNameByEmail(currentUserEmail),
                username: getUsernameByEmail(currentUserEmail) || null,
                avatar_url: getAvatarByEmail(currentUserEmail),
                phone: getPhoneByEmail(currentUserEmail) || null,
                about: localStorage.getItem('userStatus_' + currentUserEmail) || null,
                birthday: localStorage.getItem('userBirthday_' + currentUserEmail) || null,
                glow_color: localStorage.getItem('glowColor_' + currentUserEmail) || 'gradient',
                last_seen_at: timestamp
            }
        ], { onConflict: 'email', ignoreDuplicates: false });

    if (error) {
        if (isSupabaseProfilesTableMissing(error)) {
            supabaseProfilesTableAvailable = false;
        }
        return;
    }

    const users = getCachedUsersDirectory().slice();
    const userIndex = users.findIndex(user => normalizeEmail(user.email) === currentUserEmail);
    if (userIndex !== -1) {
        users[userIndex] = {
            ...users[userIndex],
            lastSeenAt: Date.now()
        };
        localStorage.setItem('socialNetworkUsers', JSON.stringify(users));
        invalidateUsersDirectoryCache();
    }
}

async function refreshUserPresenceMap() {
    if (!currentUserEmail) return;

    try {
        if (isSupabaseEnabled() && supabaseProfilesTableAvailable) {
            await syncSupabaseProfilesToLocalDirectory(true);
        }

        const users = getAllUsersForSearch();
        const emailsToCheck = Array.from(new Set(
            users
                .map(user => normalizeEmail(user.email))
                .filter(Boolean)
        ));

        if (!emailsToCheck.length) return;

        const now = Date.now();
        const presence = {};

        emailsToCheck.forEach((email) => {
            const lastSeenAt = getUserPresenceUpdatedAt(email);
            presence[email] = lastSeenAt > 0 && now - lastSeenAt < 90000;
        });

        userPresenceMap = presence;

        const screenMain = document.getElementById('screen-main');
        if (screenMain && screenMain.classList.contains('active')) {
            scheduleChatAreaUpdate({ skipRemoteRefresh: true });
        }
    } catch (_error) {
        // noop
    }
}

function updateCurrentUserPresenceHeartbeat() {
    if (!currentUserEmail) return;
    const users = getCachedUsersDirectory().slice();
    const userIndex = users.findIndex(user => normalizeEmail(user.email) === currentUserEmail);
    if (userIndex === -1) return;

    users[userIndex] = {
        ...users[userIndex],
        lastSeenAt: Date.now()
    };
    localStorage.setItem('socialNetworkUsers', JSON.stringify(users));
    invalidateUsersDirectoryCache();

    if (isSupabaseEnabled()) {
        updateCurrentUserPresenceOnline().catch(() => {
            // noop
        });
    }
}

async function subscribeToPresenceChanges() {
    const client = getSupabaseClient();
    if (!client || !currentUserEmail || !supabaseProfilesTableAvailable) return;

    if (userPresenceChannel) {
        try {
            await client.removeChannel(userPresenceChannel);
        } catch (_error) {
            // noop
        }
    }

    userPresenceChannel = client
        .channel('profiles-presence-' + currentUserEmail)
        .on(
            'postgres_changes',
            { event: 'UPDATE', schema: 'public', table: 'profiles' },
            (payload) => {
                const row = payload.new;
                const email = normalizeEmail(row?.email || '');
                if (!email) return;

                const users = getCachedUsersDirectory().slice();
                const userIndex = users.findIndex(user => normalizeEmail(user.email) === email);
                if (userIndex !== -1) {
                    users[userIndex] = {
                        ...users[userIndex],
                        lastSeenAt: row.last_seen_at ? new Date(row.last_seen_at).getTime() : 0
                    };
                    localStorage.setItem('socialNetworkUsers', JSON.stringify(users));
                    invalidateUsersDirectoryCache();
                }

                userPresenceMap[email] = Boolean(row.last_seen_at) && (Date.now() - new Date(row.last_seen_at).getTime() < 90000);
                scheduleChatAreaUpdate({ skipRemoteRefresh: true });
            }
        )
        .subscribe();
}

function startUserPresencePolling() {
    if (userPresencePollingStarted) return;
    userPresencePollingStarted = true;

    updateCurrentUserPresenceHeartbeat();
    refreshUserPresenceMap();
    subscribeToPresenceChanges().catch(() => {
        // noop
    });

    userPresenceHeartbeatTimer = setInterval(() => {
        if (document.hidden) return;
        if (!currentUserEmail) return;
        updateCurrentUserPresenceHeartbeat();
    }, 20000);

    userPresenceRefreshTimer = setInterval(() => {
        if (document.hidden) return;
        if (!currentUserEmail) return;
        refreshUserPresenceMap();
    }, 30000);

    document.addEventListener('visibilitychange', () => {
        if (!document.hidden && currentUserEmail) {
            updateCurrentUserPresenceHeartbeat();
            refreshUserPresenceMap();
        }
    });
}

function findUserRecordByEmail(email) {
    return getUserRecordByEmail(email);
}

function getUserProfileDataByEmail(email) {
    const userRecord = findUserRecordByEmail(email) || {};

    const usernameRaw =
        localStorage.getItem('userName_' + email) ||
        userRecord.username ||
        userRecord.userName ||
        '';

    const statusRaw =
        localStorage.getItem('userStatus_' + email) ||
        userRecord.status ||
        userRecord.about ||
        userRecord.description ||
        userRecord.bio ||
        '';

    const birthdayRaw =
        localStorage.getItem('userBirthday_' + email) ||
        userRecord.birthday ||
        userRecord.birthDate ||
        userRecord.dateOfBirth ||
        userRecord.dob ||
        '';

    const glowColorRaw =
        localStorage.getItem('glowColor_' + email) ||
        userRecord.glowColor ||
        'gradient';

    const normalizedUsername = normalizeUsername(usernameRaw);
    const fallbackUsername = normalizeUsername(email.split('@')[0] || '');

    const normalizedStatus = String(statusRaw || '').trim();

    return {
        displayName: getDisplayNameByEmail(email),
        username: normalizedUsername || fallbackUsername,
        status: normalizedStatus,
        birthday: String(birthdayRaw || '').trim(),
        glowColor: glowColorRaw || 'gradient',
        avatar: getAvatarByEmail(email)
    };
}

function getBlockedUsersForCurrentUser() {
    if (!currentUserEmail) return [];
    const stored = JSON.parse(localStorage.getItem('blockedUsers_' + currentUserEmail)) || [];
    return Array.isArray(stored) ? stored : [];
}

function setBlockedUsersForCurrentUser(emails) {
    if (!currentUserEmail) return;
    localStorage.setItem('blockedUsers_' + currentUserEmail, JSON.stringify(emails));
}

function isUserBlocked(email) {
    if (!email) return false;
    return getBlockedUsersForCurrentUser().includes(email);
}

function updateUserProfileBlockButton() {
    const blockAction = document.getElementById('user-profile-block-action');
    if (!blockAction || !currentViewedUserProfileEmail || !currentUserEmail) return;

    const blocked = isUserBlocked(currentViewedUserProfileEmail);
    const label = blockAction.querySelector('span');
    if (label) {
        label.textContent = blocked ? 'Разблокировать пользователя' : 'Заблокировать пользователя';
    }
    blockAction.classList.toggle('blocked', blocked);
    blockAction.classList.toggle('user-profile-dropdown-item', true);
}

function updateUserProfileContactAction() {
    const contactAction = document.getElementById('user-profile-add-contact-action');
    if (!contactAction || !currentViewedUserProfileEmail || !currentUserEmail) return;

    const added = isUserInContacts(currentViewedUserProfileEmail);
    const label = contactAction.querySelector('span');
    if (label) {
        label.textContent = added ? 'В контактах' : 'Добавить в контакты';
    }
    contactAction.classList.toggle('added', added);
}

function toggleBlockViewedUser() {
    if (!currentViewedUserProfileEmail || !currentUserEmail) return;
    if (currentViewedUserProfileEmail === currentUserEmail) return;

    const blockedUsers = getBlockedUsersForCurrentUser();
    const isBlockedNow = blockedUsers.includes(currentViewedUserProfileEmail);

    if (isBlockedNow) {
        setBlockedUsersForCurrentUser(blockedUsers.filter(email => email !== currentViewedUserProfileEmail));
    } else {
        blockedUsers.push(currentViewedUserProfileEmail);
        setBlockedUsersForCurrentUser([...new Set(blockedUsers)]);
    }

    updateUserProfileBlockButton();
    updateChatArea();
}

function getGlowBackgroundByColor(color) {
    return color === 'gradient'
        ? 'linear-gradient(135deg, #ff5e98, #8b41df, #30a1ff)'
        : color;
}

function formatBirthdayForDisplay(rawBirthday) {
    if (!rawBirthday) return 'Не указана';
    const parsedDate = new Date(rawBirthday);
    if (Number.isNaN(parsedDate.getTime())) return rawBirthday;
    return parsedDate.toLocaleDateString('ru-RU', {
        year: 'numeric',
        month: 'long',
        day: 'numeric'
    });
}

function openUserProfileScreenByEmail(email, sourceScreenId = 'screen-main') {
    if (!email) return;

    const profileData = getUserProfileDataByEmail(email);
    const safeName = profileData.displayName;
    const savedUsername = profileData.username;
    const savedBirthday = profileData.birthday;
    const savedStatus = profileData.status;
    const savedGlowColor = profileData.glowColor;
    const savedAvatar = profileData.avatar;

    const profileName = document.getElementById('user-profile-name');
    const profileUsername = document.getElementById('user-profile-username');
    const profileBirthday = document.getElementById('user-profile-birthday');
    const profileStatus = document.getElementById('user-profile-status');
    const profileAvatar = document.getElementById('user-profile-avatar-display');
    const profileGlow = document.getElementById('user-profile-avatar-glow');

    if (profileName) profileName.textContent = safeName || 'Пользователь';
    if (profileUsername) profileUsername.textContent = savedUsername ? '@' + savedUsername : 'Не указан';
    if (profileBirthday) profileBirthday.textContent = formatBirthdayForDisplay(savedBirthday);
    if (profileStatus) {
        const normalizedStatus = savedStatus.trim();
        profileStatus.textContent = normalizedStatus;
        const statusRow = profileStatus.closest('.detail-item-static');
        if (statusRow) {
            statusRow.style.display = normalizedStatus ? 'flex' : 'none';
        }
    }

    if (profileGlow) {
        profileGlow.style.background = getGlowBackgroundByColor(savedGlowColor);
    }

    if (profileAvatar) {
        if (savedAvatar) {
            profileAvatar.style.backgroundImage = `url(${savedAvatar})`;
            profileAvatar.style.backgroundSize = 'cover';
            profileAvatar.style.backgroundPosition = 'center';
            profileAvatar.style.backgroundColor = 'transparent';
            profileAvatar.textContent = '';
            profileAvatar.classList.remove('fallback');
        } else {
            const firstLetter = (safeName || 'П').charAt(0).toUpperCase();
            profileAvatar.style.backgroundImage = 'none';
            profileAvatar.style.backgroundColor = 'rgba(255, 255, 255, 0.08)';
            profileAvatar.textContent = firstLetter;
            profileAvatar.classList.add('fallback');
        }
    }

    currentViewedUserProfileEmail = email;
    initUserProfileMediaTabs();
    updateUserProfileContactAction();
    updateUserProfileBlockButton();

    lastScreenBeforeUserProfile = sourceScreenId;
    goToScreen('screen-user-profile');
}

function getAllUsersForSearch() {
    const users = JSON.parse(localStorage.getItem('socialNetworkUsers')) || [];
    const blockedUsers = new Set(getBlockedUsersForCurrentUser());

    return users.map(user => ({
        email: user.email,
        displayName: getDisplayNameByEmail(user.email),
        username: getUsernameByEmail(user.email),
        phone: getPhoneByEmail(user.email),
        avatar: getAvatarByEmail(user.email)
    })).filter(user => user.email && !blockedUsers.has(user.email));
}

function getConversationsStore() {
    return getStoredConversations();
}

function saveConversationsStore(store) {
    conversationsStoreCache = store;
    schedulePersistConversations();
}

function getConversationId(emailA, emailB) {
    return [emailA, emailB].sort().join('__');
}

function getConversationById(conversationId) {
    const store = getConversationsStore();
    return store[conversationId] || null;
}

function getOrCreateConversationWithUser(peerEmail) {
    const conversationId = getConversationId(currentUserEmail, peerEmail);
    const store = getConversationsStore();

    if (!store[conversationId]) {
        store[conversationId] = {
            id: conversationId,
            participants: [currentUserEmail, peerEmail],
            messages: [],
            updatedAt: Date.now()
        };
        saveConversationsStore(store);
    }

    return store[conversationId];
}

function getCurrentUserConversations() {
    const store = getConversationsStore();
    const blockedUsers = new Set(getBlockedUsersForCurrentUser());
    return Object.values(store)
        .filter(conversation => {
            if (!conversation.participants.includes(currentUserEmail)) return false;
            const peerEmail = conversation.participants.find(email => email !== currentUserEmail);
            return !blockedUsers.has(peerEmail);
        })
        .sort((a, b) => {
            const timeA = a.messages.length ? a.messages[a.messages.length - 1].timestamp : a.updatedAt;
            const timeB = b.messages.length ? b.messages[b.messages.length - 1].timestamp : b.updatedAt;
            return timeB - timeA;
        });
}

function formatChatTime(timestamp) {
    if (!timestamp) return '';
    const date = new Date(timestamp);
    return date.toLocaleTimeString('ru-RU', {
        hour: '2-digit',
        minute: '2-digit'
    });
}

function getOtherParticipantEmail(conversation) {
    return conversation.participants.find(email => email !== currentUserEmail) || null;
}

function createAvatarMarkup(user) {
    const safeName = user.displayName || 'Пользователь';
    const firstLetter = safeName.charAt(0).toUpperCase();
    const avatarStyle = user.avatar ? `style="background-image:url('${escapeHtml(user.avatar)}');"` : '';
    const fallbackClass = user.avatar ? 'chat-avatar user-profile-trigger' : 'chat-avatar fallback user-profile-trigger';
    return `<div class="${fallbackClass}" data-email="${escapeHtml(user.email)}" ${avatarStyle}>${user.avatar ? '' : escapeHtml(firstLetter)}</div>`;
}

async function renderUserSearchResults(query, chatArea) {
    const normalizedQuery = query.toLowerCase();
    const queryPhone = normalizePhone(query);
    const queryUsername = normalizeUsername(query);

    // Показываем индикатор загрузки
    if (isSupabaseEnabled()) {
        chatArea.innerHTML = '<div class="no-chats-message">Поиск в интернете...</div>';
        
        // Поиск в Supabase
        const onlineUsers = await searchUsersOnline(query);
        
        // Фильтруем результаты
        let users = onlineUsers
            .filter(user => user.email && user.email.toLowerCase() !== currentUserEmail.toLowerCase())
            .map(user => ({
                email: user.email,
                displayName: user.display_name || user.email.split('@')[0],
                username: user.username || '',
                phone: user.phone || '',
                avatar: user.avatar_url || null
            }))
            .slice(0, 5);
        
        if (!users.length) {
            chatArea.innerHTML = '<div class="no-chats-message">Пользователь не найден в сети</div>';
            return;
        }
        
        displaySearchResults(users, chatArea);
        return;
    }
    
    // Fallback: локальный поиск
    const users = getAllUsersForSearch()
        .filter(user => user.email !== currentUserEmail)
        .filter(user => {
            const nameMatch = user.displayName.toLowerCase().includes(normalizedQuery);
            const usernameMatch = queryUsername.length > 0 && user.username === queryUsername;
            const phoneMatch = queryPhone.length > 0 && normalizePhone(user.phone) === queryPhone;
            return nameMatch || usernameMatch || phoneMatch;
        })
        .slice(0, 5);

    if (!users.length) {
        chatArea.innerHTML = '<div class="no-chats-message">Пользователь не найден</div>';
        return;
    }

    displaySearchResults(users, chatArea);
}

function displaySearchResults(users, chatArea) {
    chatArea.innerHTML = '<div class="chat-list"></div>';
    const list = chatArea.querySelector('.chat-list');

    users.forEach(user => {
        const usernameText = user.username ? '@' + user.username : '@username не указан';

        const row = document.createElement('button');
        row.type = 'button';
        row.className = 'chat-list-item search-result-item';
        row.innerHTML = `
            ${createAvatarMarkup(user)}
            <div class="chat-list-content">
                <div class="chat-list-top">
                    <span class="chat-list-name">${escapeHtml(user.displayName)}</span>
                    <span class="chat-list-time">Найдено</span>
                </div>
                <div class="chat-list-bottom">${escapeHtml(usernameText)}</div>
            </div>
        `;

        row.addEventListener('click', (e) => {
            if (e.target.closest('.user-profile-trigger')) return;

            const conversation = getOrCreateConversationWithUser(user.email);
            activeConversationId = conversation.id;

            const searchInput = document.getElementById('chat-search');
            if (searchInput) {
                searchInput.value = '';
                searchInput.classList.remove('active');
            }

            updateChatArea();

            addSearchHistoryItem('users', user.email, user.displayName, user.username ? '@' + user.username : 'Пользователь');
        });

        const avatarTrigger = row.querySelector('.user-profile-trigger');
        if (avatarTrigger) {
            avatarTrigger.addEventListener('click', (e) => {
                e.preventDefault();
                e.stopPropagation();
                addSearchHistoryItem('users', user.email, user.displayName, user.username ? '@' + user.username : 'Пользователь');
                openUserProfileScreenByEmail(user.email, 'screen-main');
            });
        }

        list.appendChild(row);
    });
}

function renderConversationsList(chatArea) {
    const conversations = getCurrentUserConversations();
    const unreadMap = getUnreadConversationMap();

    if (!conversations.length) {
        chatArea.innerHTML = '<div class="no-chats-message">У вас пока нет чатов. Найдите пользователя через поиск сверху.</div>';
        return;
    }

    chatArea.innerHTML = '<div class="chat-list"></div>';
    const list = chatArea.querySelector('.chat-list');

    conversations.forEach(conversation => {
        const peerEmail = getOtherParticipantEmail(conversation);
        if (!peerEmail) return;

        const peer = {
            email: peerEmail,
            displayName: getDisplayNameByEmail(peerEmail),
            username: getUsernameByEmail(peerEmail),
            phone: getPhoneByEmail(peerEmail),
            avatar: getAvatarByEmail(peerEmail)
        };

        const lastMessage = conversation.messages[conversation.messages.length - 1];
        const lastText = lastMessage?.text || 'Начните диалог';
        const lastTime = formatChatTime(lastMessage?.timestamp || conversation.updatedAt);
        const hasUnread = Boolean(unreadMap[conversation.id]);

        const row = document.createElement('button');
        row.type = 'button';
        row.className = `chat-list-item${hasUnread ? ' has-unread' : ''}`;
        row.innerHTML = `
            ${createAvatarMarkup(peer)}
            <div class="chat-list-content">
                <div class="chat-list-top">
                    <span class="chat-list-name">${escapeHtml(peer.displayName)}</span>
                    <span class="chat-list-time">${escapeHtml(lastTime)}</span>
                </div>
                <div class="chat-list-bottom">${escapeHtml(lastText)}</div>
            </div>
            ${hasUnread ? '<span class="chat-unread-badge" aria-label="Непрочитанное сообщение"></span>' : ''}
        `;

        row.addEventListener('click', (e) => {
            if (e.target.closest('.user-profile-trigger')) return;

            activeConversationId = conversation.id;
            if (searchModeActive) {
                addSearchHistoryItem('chats', conversation.id, peer.displayName, '@' + (peer.username || 'username'));
            }
            markConversationAsRead(conversation.id);
            scheduleChatAreaUpdate({ skipRemoteRefresh: true });
        });

        const avatarTrigger = row.querySelector('.user-profile-trigger');
        if (avatarTrigger) {
            avatarTrigger.addEventListener('click', (e) => {
                e.preventDefault();
                e.stopPropagation();
                openUserProfileScreenByEmail(peer.email, 'screen-main');
            });
        }

        list.appendChild(row);
    });
}

function renderContactsList(chatArea) {
    const contactEmails = getCurrentUserContacts();
    const blockedUsers = new Set(getBlockedUsersForCurrentUser());
    const contacts = contactEmails
        .filter(email => email !== normalizeEmail(currentUserEmail))
        .filter(email => !blockedUsers.has(email))
        .map(email => ({
            email,
            displayName: getDisplayNameByEmail(email),
            username: getUsernameByEmail(email),
            avatar: getAvatarByEmail(email)
        }));

    if (!contacts.length) {
        chatArea.innerHTML = '<div class="no-chats-message">Контакты пусты. Добавьте пользователей через их профиль.</div>';
        return;
    }

    chatArea.innerHTML = '<div class="chat-list"></div>';
    const list = chatArea.querySelector('.chat-list');

    contacts.forEach(user => {
        const usernameText = user.username ? '@' + user.username : '@username не указан';

        const row = document.createElement('button');
        row.type = 'button';
        row.className = 'chat-list-item';
        row.innerHTML = `
            ${createAvatarMarkup(user)}
            <div class="chat-list-content">
                <div class="chat-list-top">
                    <span class="chat-list-name">${escapeHtml(user.displayName)}</span>
                    <span class="chat-list-time">Контакт</span>
                </div>
                <div class="chat-list-bottom">${escapeHtml(usernameText)}</div>
            </div>
        `;

        row.addEventListener('click', (e) => {
            if (e.target.closest('.user-profile-trigger')) return;

            const conversation = getOrCreateConversationWithUser(user.email);
            activeConversationId = conversation.id;
            scheduleChatAreaUpdate({ skipRemoteRefresh: true });
        });

        const avatarTrigger = row.querySelector('.user-profile-trigger');
        if (avatarTrigger) {
            avatarTrigger.addEventListener('click', (e) => {
                e.preventDefault();
                e.stopPropagation();
                openUserProfileScreenByEmail(user.email, 'screen-main');
            });
        }

        list.appendChild(row);
    });
}

function showMessageDeleteMenu(messageId, senderEmail, peerEmail) {
    // Удалить старое меню если оно есть
    const oldMenu = document.querySelector('.message-delete-menu');
    if (oldMenu) oldMenu.remove();
    
    // Remove old backdrop
    const oldBackdrop = document.querySelector('.delete-menu-backdrop');
    if (oldBackdrop) oldBackdrop.remove();

    const menu = document.createElement('div');
    menu.className = 'message-delete-menu';
    
    const backdrop = document.createElement('div');
    backdrop.className = 'delete-menu-backdrop';

    const closeMenu = () => {
        menu.remove();
        backdrop.remove();
        // Remove message selection
        document.querySelectorAll('.message-selected').forEach(msg => {
            msg.classList.remove('message-selected');
        });
    };

    const deleteForMeBtn = document.createElement('button');
    deleteForMeBtn.className = 'delete-menu-btn';
    deleteForMeBtn.textContent = 'Удалить для себя';
    deleteForMeBtn.addEventListener('click', async () => {
        if (supabaseMessagesTableAvailable && getSupabaseClient()) {
            const success = await deleteMessageForMe(messageId, currentUserEmail);
            if (success) {
                // Добавить сообщение в локальный deleted_for массив
                const conversation = getConversationById(activeConversationId);
                if (conversation) {
                    conversation.messages.forEach(msg => {
                        if (msg.id === messageId) {
                            if (!msg.deleted_for) msg.deleted_for = [];
                            if (!msg.deleted_for.includes(currentUserEmail)) {
                                msg.deleted_for.push(currentUserEmail);
                            }
                        }
                    });
                    saveConversationsStore(getConversationsStore());
                    scheduleChatAreaUpdate({ skipRemoteRefresh: true });
                }
            }
        }
        closeMenu();
    });

    const deleteForAllBtn = document.createElement('button');
    deleteForAllBtn.className = 'delete-menu-btn delete-for-all';
    deleteForAllBtn.textContent = 'Удалить для всех';
    deleteForAllBtn.addEventListener('click', async () => {
        if (supabaseMessagesTableAvailable && getSupabaseClient()) {
            const success = await deleteMessageForEveryone(messageId);
            if (success) {
                // Удалить из локального хранилища
                const conversation = getConversationById(activeConversationId);
                if (conversation) {
                    conversation.messages = conversation.messages.filter(msg => msg.id !== messageId);
                    saveConversationsStore(getConversationsStore());
                    scheduleChatAreaUpdate({ skipRemoteRefresh: true });
                }
            }
        }
        closeMenu();
    });

    const cancelBtn = document.createElement('button');
    cancelBtn.className = 'delete-menu-btn';
    cancelBtn.textContent = 'Отмена';
    cancelBtn.addEventListener('click', closeMenu);

    menu.appendChild(deleteForMeBtn);
    menu.appendChild(deleteForAllBtn);
    menu.appendChild(cancelBtn);

    // Prevent menu from closing when clicking on it
    menu.addEventListener('click', (e) => {
        e.stopPropagation();
    });

    document.body.appendChild(backdrop);
    document.body.appendChild(menu);

    // Закрыть меню при клике на backdrop (пустое место)
    backdrop.addEventListener('click', closeMenu);
}

function getMessageReadStatus(message, peerEmail) {
    if (!message || !peerEmail) return 'sent';
    if (message.sender !== currentUserEmail) return 'none';
    if (message.pending) return 'pending';
    if (message.failed) return 'failed';

    const readBy = Array.isArray(message.read_by) ? message.read_by : [];
    if (readBy.includes(peerEmail)) return 'read';
    return 'sent';
}

function getMessageStatusIconMarkup(status) {
    if (status === 'pending') {
        return `
            <span class="message-status-icon pending" aria-label="Отправляется" title="Отправляется">
                <svg viewBox="0 0 16 16" aria-hidden="true">
                    <circle cx="8" cy="8" r="5.25"></circle>
                    <path d="M8 4.7v3.5l2.2 1.3"></path>
                </svg>
            </span>
        `;
    }

    if (status === 'read') {
        return `
            <span class="message-status-icon read" aria-label="Прочитано" title="Прочитано">
                <svg viewBox="0 0 16 16" aria-hidden="true">
                    <path d="M2.2 8.4 5.1 11.2 8.1 7.9"></path>
                    <path d="M6.6 8.4 9.5 11.2 13 6.8"></path>
                </svg>
            </span>
        `;
    }

    if (status === 'failed') {
        return `
            <span class="message-status-icon failed" aria-label="Не отправлено" title="Не отправлено">
                <svg viewBox="0 0 16 16" aria-hidden="true">
                    <circle cx="8" cy="8" r="5.25"></circle>
                    <path d="M8 5.1v3.1"></path>
                    <circle cx="8" cy="11.3" r="0.65" fill="currentColor" stroke="none"></circle>
                </svg>
            </span>
        `;
    }

    return `
        <span class="message-status-icon sent" aria-label="Отправлено" title="Отправлено">
            <svg viewBox="0 0 16 16" aria-hidden="true">
                <path d="M3.1 8.3 6.2 11.1 12.7 4.8"></path>
            </svg>
        </span>
    `;
}

function getConversationRenderSignature(conversation, peerEmail) {
    if (!conversation) return '';
    const visibleMessages = conversation.messages.filter(message => {
        return !(message.deleted_for && message.deleted_for.includes(currentUserEmail));
    });

    const lastMessage = visibleMessages[visibleMessages.length - 1];
    const lastReadBy = Array.isArray(lastMessage?.read_by) ? lastMessage.read_by.join(',') : '';
    return [
        conversation.id,
        peerEmail,
        visibleMessages.length,
        lastMessage?.id || '',
        lastMessage?.timestamp || '',
        lastMessage?.text || '',
        lastMessage?.pending ? '1' : '0',
        lastMessage?.failed ? '1' : '0',
        lastReadBy,
        getUserPresenceText(peerEmail)
    ].join('|');
}

function shouldStickThreadToBottom(container) {
    if (!container) return true;
    return container.scrollHeight - container.scrollTop - container.clientHeight < 80;
}

async function syncConversationReadState(conversationId) {
    pendingReadSyncConversationId = conversationId;
    if (readSyncTimer) {
        clearTimeout(readSyncTimer);
    }

    readSyncTimer = setTimeout(async () => {
        readSyncTimer = null;

        if (messageReadSyncInFlight) return;
        const targetConversationId = pendingReadSyncConversationId;
        pendingReadSyncConversationId = null;

        const client = getSupabaseClient();
        if (!client || !targetConversationId || !currentUserEmail || !supabaseMessagesTableAvailable) return;

        const conversation = getConversationById(targetConversationId);
        if (!conversation) return;

        const readAt = getConversationReadAt(targetConversationId);
        if (!readAt) return;

        const unreadIncomingMessages = conversation.messages
            .filter(message => message.sender !== currentUserEmail)
            .filter(message => !message.deleted_for || !message.deleted_for.includes(currentUserEmail))
            .filter(message => Number(message.timestamp || 0) <= readAt)
            .filter(message => message.id && !String(message.id).startsWith('local-'))
            .filter(message => !(Array.isArray(message.read_by) ? message.read_by : []).includes(currentUserEmail));

        if (!unreadIncomingMessages.length) return;

        messageReadSyncInFlight = true;
        try {
            const updates = unreadIncomingMessages.map(async (message) => {
                const nextReadBy = Array.from(new Set([...(Array.isArray(message.read_by) ? message.read_by : []), currentUserEmail]));
                message.read_by = nextReadBy;

                return client
                    .from('messages_app')
                    .update({ read_by: nextReadBy })
                    .eq('id', message.id);
            });

            await Promise.all(updates);
            saveConversationsStore(getConversationsStore());
            scheduleChatAreaUpdate({ skipRemoteRefresh: true });
        } finally {
            messageReadSyncInFlight = false;
            if (pendingReadSyncConversationId) {
                syncConversationReadState(pendingReadSyncConversationId);
            }
        }
    }, 180);
}

function createMessageBubbleMarkup(message, peerEmail, isGrouped) {
    const isOutgoing = message.sender === currentUserEmail;
    const timestamp = new Date(message.timestamp || 0);
    const timeString = timestamp.toLocaleTimeString('ru-RU', {
        hour: '2-digit',
        minute: '2-digit',
        hour12: false
    });
    const dateString = timestamp.toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' });
    const fullTimeString = timeString; // show only time inside bubbles (date moved to separators)
    const messageStatus = isOutgoing ? getMessageReadStatus(message, peerEmail) : '';
    let fileMarkup = '';

    if (message.file) {
        const fileData = typeof message.file === 'string' ? JSON.parse(message.file) : message.file;
        const safeName = escapeHtml(fileData.name || 'Файл');
        const safeData = escapeHtml(fileData.data || '');
        const safeType = escapeHtml(fileData.type || '');

        if (String(fileData.type || '').startsWith('image/')) {
            fileMarkup = `
                <div class="message-file">
                    <img class="message-file-preview image" src="${safeData}" alt="${safeName}" data-file-preview="image" data-file-name="${safeName}" data-file-src="${safeData}">
                    <div class="message-file-name">${safeName}</div>
                    <a class="message-file-download" href="${safeData}" download="${safeName}">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg> Скачать
                    </a>
                </div>
            `;
        } else if (String(fileData.type || '').startsWith('video/')) {
            fileMarkup = `
                <div class="message-file">
                    <video class="message-file-preview" controls src="${safeData}"></video>
                    <div class="message-file-name">${safeName}</div>
                    <a class="message-file-download" href="${safeData}" download="${safeName}">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg> Скачать
                    </a>
                </div>
            `;
        } else if (String(fileData.type || '').startsWith('audio/')) {
            fileMarkup = `
                <div class="message-file">
                    <audio class="message-file-preview" controls src="${safeData}"></audio>
                    <div class="message-file-name">${safeName}</div>
                    <a class="message-file-download" href="${safeData}" download="${safeName}">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg> Скачать
                    </a>
                </div>
            `;
        } else {
            fileMarkup = `
                <div class="message-file">
                    <div class="message-file-name">${safeName}</div>
                    <a class="message-file-download" href="${safeData}" download="${safeName}">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg> Скачать
                    </a>
                </div>
            `;
        }
    }

    return `
        <div class="message ${isOutgoing ? 'outgoing' : 'incoming'}${isGrouped ? ' message-grouped' : ''}" data-message-id="${escapeHtml(message.id || '')}" data-sender="${escapeHtml(message.sender || '')}">
            <div class="message-content">
                <span class="message-text">${escapeHtml(message.text || '')}</span>
                ${fileMarkup}
                <div class="message-footer">
                    <span class="message-time">${escapeHtml(fullTimeString)}</span>
                    ${isOutgoing ? `<span class="message-status" data-state="${escapeHtml(messageStatus)}">${getMessageStatusIconMarkup(messageStatus)}</span>` : ''}
                </div>
            </div>
        </div>
    `;
}

function bindThreadInteractions(chatArea, peerEmail) {
    const backBtn = document.getElementById('thread-back-btn');
    const peerAvatarTrigger = chatArea.querySelector('.thread-peer-avatar.user-profile-trigger');
    const messagesContainer = document.getElementById('thread-messages');

    if (peerAvatarTrigger) {
        peerAvatarTrigger.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            openUserProfileScreenByEmail(peerEmail, 'screen-main');
        });
    }

    if (backBtn) {
        backBtn.addEventListener('click', () => {
            activeConversationId = null;
            lastRenderedConversationSignature = '';
            chatArea.dataset.threadConversationId = '';
            chatArea.dataset.threadMounted = '';
            activeThreadDom = null;
            updateChatArea();
        });
    }

    if (!messagesContainer) return;

    messagesContainer.addEventListener('click', (e) => {
        const imagePreview = e.target.closest('[data-file-preview="image"]');
        if (imagePreview) {
            const modal = document.getElementById('image-modal');
            const modalImg = document.getElementById('image-modal-img');
            const modalDownloadBtn = document.getElementById('image-modal-download');

            if (modal && modalImg) {
                modalImg.src = imagePreview.getAttribute('data-file-src') || '';
                modalImg.alt = imagePreview.getAttribute('data-file-name') || '';
                modal.classList.add('active');

                if (modalDownloadBtn) {
                    modalDownloadBtn.href = imagePreview.getAttribute('data-file-src') || '';
                    modalDownloadBtn.download = imagePreview.getAttribute('data-file-name') || '';
                }
            }
            return;
        }
    });

    let pressTimer = null;
    let pressedMessage = null;
    let isPressValid = false;

    const clearPressState = () => {
        if (pressTimer) {
            clearTimeout(pressTimer);
            pressTimer = null;
        }
        pressedMessage = null;
        isPressValid = false;
    };

    const startPress = (event) => {
        const bubble = event.target.closest('.message[data-message-id]');
        if (!bubble) return;

        pressedMessage = bubble;
        isPressValid = true;
        pressTimer = setTimeout(() => {
            if (!isPressValid || !pressedMessage) return;
            pressedMessage.classList.add('message-selected');
            showMessageDeleteMenu(
                pressedMessage.getAttribute('data-message-id'),
                pressedMessage.getAttribute('data-sender'),
                peerEmail
            );
        }, 600);
    };

    const cancelPress = () => {
        clearPressState();
    };

    const movePress = () => {
        isPressValid = false;
        if (pressTimer) {
            clearTimeout(pressTimer);
            pressTimer = null;
        }
    };

    messagesContainer.addEventListener('mousedown', startPress);
    messagesContainer.addEventListener('touchstart', startPress, { passive: true });
    messagesContainer.addEventListener('mouseup', cancelPress);
    messagesContainer.addEventListener('mouseleave', cancelPress);
    messagesContainer.addEventListener('touchend', cancelPress);
    messagesContainer.addEventListener('mousemove', movePress);
    messagesContainer.addEventListener('touchmove', movePress, { passive: true });

    // Floating date overlay on scroll
    let dateOverlayHideTimer = null;
    messagesContainer.addEventListener('scroll', () => {
        const overlay = document.getElementById('thread-date-overlay');
        if (!overlay) return;
        const separators = messagesContainer.querySelectorAll('.day-separator');
        if (!separators.length) {
            overlay.classList.remove('visible');
            return;
        }
        const containerRect = messagesContainer.getBoundingClientRect();
        let currentLabel = null;
        // Find the last separator that has scrolled above the viewport top
        for (let i = separators.length - 1; i >= 0; i--) {
            const sepRect = separators[i].getBoundingClientRect();
            if (sepRect.top <= containerRect.top + 10) {
                const pill = separators[i].querySelector('.day-pill');
                if (pill) currentLabel = pill.textContent;
                break;
            }
        }
        const pillEl = overlay.querySelector('.day-pill');
        if (currentLabel && currentLabel !== 'Сегодня' && pillEl) {
            pillEl.textContent = currentLabel;
            overlay.classList.add('visible');
            if (dateOverlayHideTimer) clearTimeout(dateOverlayHideTimer);
            dateOverlayHideTimer = setTimeout(() => {
                overlay.classList.remove('visible');
            }, 2000);
        } else {
            overlay.classList.remove('visible');
        }
    });
}

function renderConversationThread(chatArea, conversation) {
    const peerEmail = getOtherParticipantEmail(conversation);
    if (!peerEmail) {
        activeConversationId = null;
        activeThreadDom = null;
        lastRenderedConversationSignature = '';
        renderConversationsList(chatArea);
        return;
    }

    const peerName = getDisplayNameByEmail(peerEmail);
    const peerAvatar = getAvatarByEmail(peerEmail);
    const peerFirstLetter = peerName.charAt(0).toUpperCase();
    const avatarStyle = peerAvatar ? `style="background-image:url('${escapeHtml(peerAvatar)}');"` : '';
    const headerSubtitle = getUserPresenceText(peerEmail);
    const nextSignature = getConversationRenderSignature(conversation, peerEmail);

    const existingMessagesContainer = document.getElementById('thread-messages');
    const shouldAutoScroll = shouldStickThreadToBottom(existingMessagesContainer);

    // Проверяем что activeThreadDom элементы еще в DOM
    const isActiveThreadDomValid = activeThreadDom && 
        activeThreadDom.root && 
        activeThreadDom.subtitle &&
        document.contains(activeThreadDom.root);

    if (chatArea.dataset.threadConversationId === conversation.id && isActiveThreadDomValid && lastRenderedConversationSignature === nextSignature) {
        const subtitleNode = activeThreadDom.subtitle;
        if (subtitleNode && subtitleNode.textContent !== headerSubtitle) {
            subtitleNode.textContent = headerSubtitle;
        }
        const input = document.getElementById('chat-message-input');
        if (input) {
            input.placeholder = `Сообщение для ${peerName}...`;
        }
        return;
    }

    const visibleMessages = conversation.messages.filter(message => {
        return !(message.deleted_for && message.deleted_for.includes(currentUserEmail));
    });

    lastRenderedConversationSignature = nextSignature;
    chatArea.dataset.threadConversationId = conversation.id;

    if (!isActiveThreadDomValid || chatArea.dataset.threadMounted !== conversation.id) {
        chatArea.innerHTML = `
            <div class="thread-view">
                <div class="thread-header">
                    <button type="button" class="thread-back-btn" id="thread-back-btn" aria-label="Назад">
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
                            <path d="M15 18L9 12L15 6"/>
                        </svg>
                    </button>
                    <div class="thread-peer-avatar user-profile-trigger ${peerAvatar ? '' : 'fallback'}" data-email="${escapeHtml(peerEmail)}" ${avatarStyle}>${peerAvatar ? '' : escapeHtml(peerFirstLetter)}</div>
                    <div class="thread-peer-info">
                        <div class="thread-peer-name">${escapeHtml(peerName)}</div>
                        <div class="thread-peer-subtitle">${escapeHtml(headerSubtitle)}</div>
                    </div>
                </div>
                <div class="thread-messages-wrapper" style="position:relative;flex:1;min-height:0;display:flex;flex-direction:column;">
                    <div class="thread-date-overlay" id="thread-date-overlay"><span class="day-pill"></span></div>
                    <div class="thread-messages" id="thread-messages"></div>
                </div>
            </div>
        `;

        chatArea.dataset.threadMounted = conversation.id;
        activeThreadDom = {
            root: chatArea.querySelector('.thread-view'),
            subtitle: chatArea.querySelector('.thread-peer-subtitle'),
            messages: chatArea.querySelector('#thread-messages')
        };

        bindThreadInteractions(chatArea, peerEmail);
    } else {
        const avatarNode = chatArea.querySelector('.thread-peer-avatar');
        const nameNode = chatArea.querySelector('.thread-peer-name');
        const subtitleNode = chatArea.querySelector('.thread-peer-subtitle');

        if (avatarNode) {
            avatarNode.className = `thread-peer-avatar user-profile-trigger ${peerAvatar ? '' : 'fallback'}`.trim();
            avatarNode.setAttribute('data-email', peerEmail);
            avatarNode.style.backgroundImage = peerAvatar ? `url('${escapeHtml(peerAvatar)}')` : '';
            avatarNode.textContent = peerAvatar ? '' : peerFirstLetter;
        }

        if (nameNode) {
            nameNode.textContent = peerName;
        }

        if (subtitleNode) {
            subtitleNode.textContent = headerSubtitle;
        }
    }

    const messagesContainer = activeThreadDom?.messages || document.getElementById('thread-messages');
    if (!messagesContainer) return;

    const previousScrollTop = messagesContainer.scrollTop;
    const previousScrollHeight = messagesContainer.scrollHeight;

    if (!visibleMessages.length) {
        messagesContainer.innerHTML = '<div class="thread-empty">Напишите первое сообщение</div>';
    } else {
        let html = '';
        let lastDateKey = '';
        const today = new Date();
        const yesterday = new Date();
        yesterday.setDate(yesterday.getDate() - 1);

        let prevTimestamp = 0;
        let prevSender = '';
        visibleMessages.forEach(message => {
            const ts = new Date(message.timestamp || 0);
            const dateKey = ts.toDateString();
            if (dateKey !== lastDateKey) {
                lastDateKey = dateKey;
                let label;
                if (dateKey === today.toDateString()) label = 'Сегодня';
                else if (dateKey === yesterday.toDateString()) label = 'Вчера';
                else label = ts.toLocaleDateString('ru-RU', { day: 'numeric', month: 'short', year: 'numeric' });
                if (label) {
                    html += `\n                    <div class="day-separator">\n                        <span class="day-pill">${escapeHtml(label)}</span>\n                    </div>`;
                }
            }
            const msgTs = message.timestamp || 0;
            const isGrouped = (message.sender === prevSender) && (msgTs - prevTimestamp < 30000);
            html += createMessageBubbleMarkup(message, peerEmail, isGrouped);
            prevTimestamp = msgTs;
            prevSender = message.sender;
        });

        messagesContainer.innerHTML = html;
    }

    if (shouldAutoScroll) {
        messagesContainer.scrollTop = messagesContainer.scrollHeight;
    } else {
        const newScrollHeight = messagesContainer.scrollHeight;
        messagesContainer.scrollTop = Math.max(0, previousScrollTop + (newScrollHeight - previousScrollHeight));
    }

    const input = document.getElementById('chat-message-input');
    if (input) {
        input.placeholder = `Сообщение для ${peerName}...`;
    }

    markConversationAsRead(conversation.id);
}

async function sendMessageToActiveConversation(text, fileData) {
    if (!currentUserEmail || !activeConversationId) return false;
    
    const trimmedText = (text || '').trim();
    
    // Если нет текста и нет файла, то не отправляем
    if (!trimmedText && !fileData) return false;

    const store = getConversationsStore();
    const conversation = store[activeConversationId];
    if (!conversation) return false;

    let messageBody = trimmedText;
    let attachedFile = null;
    
    if (fileData) {
        attachedFile = fileData;
        messageBody = trimmedText || `📎 ${fileData.name}`;
    }

    const optimisticTimestamp = Date.now();
    const optimisticId = 'local-' + optimisticTimestamp + '-' + Math.random().toString(36).slice(2, 9);
    const optimisticMessage = {
        id: optimisticId,
        localId: optimisticId,
        sender: currentUserEmail,
        text: messageBody,
        timestamp: optimisticTimestamp,
        deleted_for: [],
        pending: true
    };

    if (attachedFile) {
        optimisticMessage.file = attachedFile;
    }

    conversation.messages.push(optimisticMessage);
    conversation.updatedAt = optimisticTimestamp;
    store[activeConversationId] = conversation;
    saveConversationsStore(store);
    scheduleChatAreaUpdate({ skipRemoteRefresh: true });
    
    // Проигрываем звук отправления
    playSendMessageSound();

    const client = getSupabaseClient();
    if (client && supabaseMessagesTableAvailable) {
        const messageRow = {
            conversation_id: activeConversationId,
            participants: conversation.participants,
            sender_email: currentUserEmail,
            body: messageBody,
            sent_at: optimisticTimestamp,
            read_by: [currentUserEmail],
            file: attachedFile ? JSON.stringify(attachedFile) : null
        };

        const { data, error } = await client
            .from('messages_app')
            .insert(messageRow)
            .select('id, conversation_id, participants, sender_email, body, sent_at, deleted_for, read_by, file')
            .single();

        const freshStore = getConversationsStore();
        const freshConversation = freshStore[activeConversationId];

        if (error) {
            if (freshConversation) {
                freshConversation.messages = freshConversation.messages.map(message => {
                    if (message.id === optimisticId) {
                        return {
                            ...message,
                            pending: false,
                            failed: !isSupabaseMessagesTableMissing(error)
                        };
                    }
                    return message;
                });
                freshStore[activeConversationId] = freshConversation;
                saveConversationsStore(freshStore);
            }

            if (isSupabaseMessagesTableMissing(error)) {
                supabaseMessagesTableAvailable = false;
                if (!supabaseMessagesMissingWarningShown) {
                    alert('Таблица сообщений в Supabase не найдена. Временно используется локальный чат. Запусти SQL из supabase-schema.sql.');
                    supabaseMessagesMissingWarningShown = true;
                }
                updateChatArea({ skipRemoteRefresh: true });
                return true;
            }

            updateChatArea({ skipRemoteRefresh: true });
            alert('Не удалось отправить сообщение: ' + error.message);
            return false;
        }

        if (freshConversation) {
            freshConversation.messages = freshConversation.messages.filter(message => message.id !== optimisticId);
            freshStore[activeConversationId] = freshConversation;
            saveConversationsStore(freshStore);
        }

        if (data) {
            mergeSupabaseMessageRowIntoStore(data);
            scheduleChatAreaUpdate({ skipRemoteRefresh: true });
        }
        return true;
    }

    const localStore = getConversationsStore();
    const localConversation = localStore[activeConversationId];
    if (localConversation) {
        localConversation.messages = localConversation.messages.map(message => {
            if (message.id === optimisticId) {
                return {
                    ...message,
                    pending: false
                };
            }
            return message;
        });
        localStore[activeConversationId] = localConversation;
        saveConversationsStore(localStore);
    }

    scheduleChatAreaUpdate({ skipRemoteRefresh: true });
    return true;
}

function initMessaging() {
    if (messagingInitialized) {
        scheduleChatAreaUpdate({ skipRemoteRefresh: true });
        return;
    }

    // Подготовим разблокировку аудио на мобильных — слушаем первое взаимодействие
    tryUnlockAudioOnFirstInteraction();

    const chatForm = document.getElementById('chat-form');
    const messageInput = document.getElementById('chat-message-input');
    const searchInput = document.getElementById('chat-search');

    if (chatForm && messageInput) {
        chatForm.addEventListener('submit', async function(e) {
            e.preventDefault();
            if (!activeConversationId || pendingMessageSend) return;

            const textToSend = messageInput.value;
            if (!textToSend.trim()) return;

            pendingMessageSend = true;
            messageInput.value = '';

            const sent = await sendMessageToActiveConversation(textToSend);
            if (!sent) {
                messageInput.value = textToSend;
            }

            pendingMessageSend = false;
        });
        
        // Обработчик для кнопки загрузки файла
        const fileUploadBtn = document.getElementById('file-upload-btn');
        const fileInput = document.getElementById('file-input');
        
        if (fileUploadBtn && fileInput) {
            fileUploadBtn.addEventListener('click', (e) => {
                e.preventDefault();
                e.stopPropagation();
                fileInput.click();
            });
            
            fileInput.addEventListener('change', async (e) => {
                const file = e.target.files[0];
                if (file) {
                    const reader = new FileReader();
                    reader.onload = async (event) => {
                        const base64Data = event.target.result;
                        const fileData = {
                            name: file.name,
                            type: file.type,
                            size: file.size,
                            data: base64Data
                        };
                        
                        // Отправить файл с меткой что это файл
                        if (!pendingMessageSend) {
                            pendingMessageSend = true;
                            await sendMessageToActiveConversation('', fileData);
                            pendingMessageSend = false;
                        }
                        fileInput.value = ''; // Очистить input
                    };
                    reader.readAsDataURL(file);
                }
            });
        }
    }

    if (searchInput) {
        searchInput.addEventListener('input', () => {
            if (chatSearchDebounceTimer) {
                clearTimeout(chatSearchDebounceTimer);
            }

            chatSearchDebounceTimer = setTimeout(() => {
                const query = (searchInput.value || '').trim();
                if (query && isSupabaseEnabled()) {
                    syncSupabaseProfilesToLocalDirectory().then(() => {
                        scheduleChatAreaUpdate({ skipRemoteRefresh: true });
                    });
                    return;
                }

                scheduleChatAreaUpdate({ skipRemoteRefresh: true });
            }, 300);
        });
    }

    messagingInitialized = true;
    scheduleChatAreaUpdate({ skipRemoteRefresh: true });
}

function initUserProfileHeaderMenu() {
    const menuBtn = document.getElementById('user-profile-menu-btn');
    const dropdown = document.getElementById('user-profile-dropdown-menu');
    const contactAction = document.getElementById('user-profile-add-contact-action');
    const blockAction = document.getElementById('user-profile-block-action');
    if (!menuBtn || !dropdown || !contactAction || !blockAction) return;
    if (menuBtn.dataset.hasListener === '1') return;

    menuBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        dropdown.classList.toggle('show');
    });

    contactAction.addEventListener('click', (e) => {
        e.stopPropagation();
        if (!currentViewedUserProfileEmail) return;
        const changed = addUserToContacts(currentViewedUserProfileEmail);
        updateUserProfileContactAction();
        if (changed && activeMainSubmenuTab === 'contacts') {
            scheduleChatAreaUpdate({ skipRemoteRefresh: true });
        }
        dropdown.classList.remove('show');
    });

    blockAction.addEventListener('click', (e) => {
        e.stopPropagation();
        toggleBlockViewedUser();
        dropdown.classList.remove('show');
    });

    document.addEventListener('click', (e) => {
        if (!menuBtn.contains(e.target) && !dropdown.contains(e.target)) {
            dropdown.classList.remove('show');
        }
    });

    menuBtn.dataset.hasListener = '1';
}

document.addEventListener('DOMContentLoaded', initUserProfileHeaderMenu);

// НОВЫЕ ФУНКЦИИ ДЛЯ ПРОФИЛЯ

// Функция для создания текстового отображения имени пользователя
function createUsernameDisplay() {
    const profileScreen = document.getElementById('screen-profile');
    if (!profileScreen) return;

    const avatarSection = profileScreen.querySelector('.avatar-section-glass');
    if (!avatarSection) return;
    
    // Удаляем существующий контейнер с именем, если есть
    const existingDisplay = profileScreen.querySelector('.profile-username-display');
    if (existingDisplay) existingDisplay.remove();
    
    // Создаем новый элемент для отображения имени
    const usernameDisplay = document.createElement('div');
    usernameDisplay.className = 'profile-username-display';
    
    // Получаем сохраненное имя пользователя (display name)
    const savedDisplayName = localStorage.getItem('userDisplayName_' + currentUserEmail);
    usernameDisplay.textContent = savedDisplayName || 'Пользователь';
    
    // Вставляем после аватарки
    const avatarWrapper = profileScreen.querySelector('.avatar-wrapper-glass');
    if (avatarWrapper) {
        avatarWrapper.insertAdjacentElement('afterend', usernameDisplay);
    }
}

// Функция для создания секции подробностей об аккаунте
function createAccountDetailsSection() {
    const profileScreen = document.getElementById('screen-profile');
    if (!profileScreen) return;

    const profileContent = profileScreen.querySelector('.profile-content-glass');
    if (!profileContent) return;
    
    // Скрываем старую сетку информации
    const oldInfoGrid = profileContent.querySelector('.info-grid-glass');
    if (oldInfoGrid) {
        oldInfoGrid.style.display = 'none';
    }
    
    // Удаляем существующую секцию, если есть
    const existingSection = profileContent.querySelector('.account-details-section');
    if (existingSection) existingSection.remove();
    
    // Создаем новую секцию
    const detailsSection = document.createElement('div');
    detailsSection.className = 'account-details-section';
    detailsSection.style.position = 'relative';
    
    // Заголовок
    const title = document.createElement('div');
    title.className = 'details-title';
    title.textContent = 'Подробности об аккаунте';
    detailsSection.appendChild(title);

    // Кнопка-иконка редактирования в правом верхнем углу
    const editIconBtn = document.createElement('button');
    editIconBtn.className = 'edit-profile-icon-btn';
    editIconBtn.innerHTML = `
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M12 20h9M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4 12.5-12.5z"/>
        </svg>
    `;
    editIconBtn.addEventListener('click', function() {
        loadEditData();
        goToScreen('screen-edit-profile');
    });
    detailsSection.appendChild(editIconBtn);
    
    // Получаем данные пользователя
    const savedUsername = localStorage.getItem('userName_' + currentUserEmail) || '';
    const displayUsername = savedUsername ? '@' + savedUsername : 'Не указано';
    const savedPhone = localStorage.getItem('userPhone_' + currentUserEmail) || 'Не указан';
    const savedStatus = (localStorage.getItem('userStatus_' + currentUserEmail) || '').trim();

    // Элемент Описание показываем первым и только если пользователь его заполнил
    if (savedStatus) {
        const statusItem = createDetailItem('username', 'Описание', savedStatus, 'status');
        detailsSection.appendChild(statusItem);
    }
    
    // Элемент Username (логин) с @
    const usernameItem = createDetailItem('username', 'Username', displayUsername, 'username');
    detailsSection.appendChild(usernameItem);
    
    // Элемент Email
    const emailItem = createDetailItem('email', 'Email', currentUserEmail, 'email');
    detailsSection.appendChild(emailItem);
    
    // Элемент Телефон
    const phoneItem = createDetailItem('phone', 'Телефон', savedPhone, 'phone');
    detailsSection.appendChild(phoneItem);

    const mediaSwitcher = document.createElement('div');
    mediaSwitcher.className = 'profile-media-switcher';
    mediaSwitcher.innerHTML = `
        <div class="chat-submenu-inner profile-media-tabs-inner">
            <button class="submenu-btn" data-tab="stories" type="button">Истории</button>
            <button class="submenu-btn" data-tab="collection" type="button">Коллекция</button>
        </div>
    `;

    const mediaPanels = document.createElement('div');
    mediaPanels.className = 'profile-media-panels';

    const storiesPanel = document.createElement('div');
    storiesPanel.className = 'profile-media-panel';
    storiesPanel.setAttribute('data-panel', 'stories');

    const collectionPanel = document.createElement('div');
    collectionPanel.className = 'profile-media-panel';
    collectionPanel.setAttribute('data-panel', 'collection');
    collectionPanel.innerHTML = `
        <div class="profile-collection-section">
            <div class="collection-title">Коллекция</div>
            <div class="collection-list" id="profile-collection-list">
                <div class="collection-empty">Коллекция пуста</div>
            </div>
        </div>
    `;

    mediaPanels.appendChild(storiesPanel);
    mediaPanels.appendChild(collectionPanel);

    detailsSection.appendChild(mediaSwitcher);
    detailsSection.appendChild(mediaPanels);

    // Вставляем секцию историй в панель "Истории"
    const storiesSection = profileContent.querySelector('.profile-stories-section');
    if (storiesSection) {
        storiesPanel.appendChild(storiesSection);
    } else {
        storiesPanel.innerHTML = `
            <div class="profile-stories-section">
                <div class="stories-title">Истории</div>
                <div class="stories-list">
                    <div class="stories-empty">Нет историй</div>
                </div>
            </div>
        `;
    }

    const tabInner = mediaSwitcher.querySelector('.profile-media-tabs-inner');
    const panels = Array.from(mediaPanels.querySelectorAll('.profile-media-panel'));
    initSlidingSubmenu(tabInner, 'stories', (tab) => {
        panels.forEach(panel => {
            panel.classList.toggle('active', panel.getAttribute('data-panel') === tab);
        });
    });

    profileContent.appendChild(detailsSection);
}

function getLucideIconMarkup(iconType) {
    const icons = {
        username: `
            <svg class="icon-lucide" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                <path d="M20 21a8 8 0 0 0-16 0"/>
                <circle cx="12" cy="8" r="5"/>
            </svg>
        `,
        email: `
            <svg class="icon-lucide" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                <rect x="3" y="5" width="18" height="14" rx="2"/>
                <path d="m3 7 9 6 9-6"/>
            </svg>
        `,
        phone: `
            <svg class="icon-lucide" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                <rect x="7" y="2" width="10" height="20" rx="2"/>
                <path d="M12 18h.01"/>
            </svg>
        `
    };

    return icons[iconType] || icons.username;
}

// Функция создания элемента детали
function createDetailItem(iconType, label, value, type) {
    const item = document.createElement('div');
    item.className = 'detail-item';
    item.setAttribute('data-copy-type', type);
    
    const iconDiv = document.createElement('div');
    iconDiv.className = `detail-icon detail-icon-${iconType}`;
    iconDiv.innerHTML = getLucideIconMarkup(iconType);
    
    const contentDiv = document.createElement('div');
    contentDiv.className = 'detail-content';
    
    const labelSpan = document.createElement('span');
    labelSpan.className = 'detail-label';
    labelSpan.textContent = label;
    
    const valueSpan = document.createElement('span');
    valueSpan.className = 'detail-value';
    valueSpan.textContent = value;
    
    contentDiv.appendChild(labelSpan);
    contentDiv.appendChild(valueSpan);
    
    item.appendChild(iconDiv);
    item.appendChild(contentDiv);
    
    // Добавляем обработчик копирования
    item.addEventListener('click', function(e) {
        e.stopPropagation();
        let textToCopy = value;
        
        if (value !== 'Не указано' && value !== 'Не указана' && value !== 'Не указан') {
            if (type === 'email') {
                textToCopy = currentUserEmail;
            } else if (type === 'username') {
                const username = localStorage.getItem('userName_' + currentUserEmail) || '';
                textToCopy = username ? '@' + username : '';
            } else if (type === 'phone') {
                textToCopy = localStorage.getItem('userPhone_' + currentUserEmail) || value;
            }
            
            if (textToCopy) {
                copyToClipboard(textToCopy);
            }
            
            item.classList.add('copied');
            setTimeout(() => {
                item.classList.remove('copied');
            }, 2000);
        }
    });
    
    return item;
}

// Добавляем стили для уведомления о копировании
const style = document.createElement('style');
style.textContent = `
    .copy-notification {
        position: fixed;
        bottom: 20px;
        left: 50%;
        transform: translateX(-50%);
        background: rgba(48, 161, 255, 0.9);
        backdrop-filter: blur(10px);
        color: white;
        padding: 12px 24px;
        border-radius: 30px;
        font-size: 14px;
        font-weight: 500;
        z-index: 10000;
        animation: slideUp 0.3s ease;
        box-shadow: 0 10px 30px rgba(0,0,0,0.3);
        border: 1px solid rgba(255,255,255,0.1);
    }
    
    @keyframes slideUp {
        from {
            opacity: 0;
            transform: translate(-50%, 20px);
        }
        to {
            opacity: 1;
            transform: translate(-50%, 0);
        }
    }
`;
document.head.appendChild(style);

// ===== НАВИГАЦИЯ =====

// Функция инициализации навигации
function initNavigation() {
    if (navigationInitialized) return;
    navigationInitialized = true;

    const navItems = document.querySelectorAll('.nav-item');
    
    if (navItems.length === 0) return;
    
    // Функция обновления активного пункта меню с анимацией
    window.updateActiveNavItem = function(screenId) {
        const effectiveScreenId = screenId === 'screen-user-profile' ? 'screen-main' : screenId;

        navItems.forEach(item => {
            if (item.getAttribute('data-screen') === effectiveScreenId) {
                item.classList.add('active');
                // Добавляем анимацию пульсации (без свечения)
                item.style.animation = 'navPulse 0.5s ease';
                setTimeout(() => {
                    item.style.animation = '';
                }, 500);
            } else {
                item.classList.remove('active');
            }
        });
    };
    
    // Добавляем обработчики для навигации
    navItems.forEach(item => {
        item.addEventListener('click', function() {
            const screenId = this.getAttribute('data-screen');
            
            if (screenId === 'screen-main') {
                goToScreen('screen-main');
            } else if (screenId === 'screen-profile') {
                // При переходе в профиль обновляем данные
                loadUserAvatar();
                createUsernameDisplay();
                createAccountDetailsSection();
                updateDisplayData();
                
                // Инициализируем меню профиля
                setTimeout(() => {
                    initProfileMenu();
                }, 100);
                
                goToScreen('screen-profile');
            } else if (screenId === 'screen-settings') {
                goToSettingsScreen(); // Теперь переход на экран настроек
            }
        });
    });
    
    // Активируем начальный пункт
    setTimeout(() => {
        if (document.getElementById('screen-main').classList.contains('active')) {
            updateActiveNavItem('screen-main');
        } else if (document.getElementById('screen-profile').classList.contains('active')) {
            updateActiveNavItem('screen-profile');
        }
    }, 200);
}

const backFromUserProfileBtn = document.getElementById('back-from-user-profile');
if (backFromUserProfileBtn) {
    backFromUserProfileBtn.addEventListener('click', () => {
        const targetScreen = lastScreenBeforeUserProfile || 'screen-main';
        goToScreen(targetScreen);
        if (targetScreen === 'screen-main') {
            requestAnimationFrame(refreshMainSubmenuIndicator);
            setTimeout(refreshMainSubmenuIndicator, 120);
        }
    });
}

// ===== ВЫПАДАЮЩЕЕ МЕНЮ ПРОФИЛЯ =====

// Функция инициализации меню профиля
function initProfileMenu() {
    if (profileMenuInitialized) return;
    profileMenuInitialized = true;

    // Находим шапку профиля
    const profileHeader = document.querySelector('.profile-header-glass');
    if (!profileHeader) return;
    
    // Проверяем, есть ли уже меню
    if (document.querySelector('.profile-menu-container')) return;
    
    // Удаляем старый placeholder если есть
    const oldPlaceholder = profileHeader.querySelector('.placeholder-glass');
    if (oldPlaceholder) {
        oldPlaceholder.remove();
    }
    
    // Создаем контейнер для меню
    const menuContainer = document.createElement('div');
    menuContainer.className = 'profile-menu-container';
    
    // Кнопка с тремя точками
    const menuButton = document.createElement('button');
    menuButton.className = 'profile-menu-btn';
    menuButton.id = 'profile-menu-btn';
    menuButton.innerHTML = `
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <circle cx="12" cy="12" r="1"/>
            <circle cx="12" cy="5" r="1"/>
            <circle cx="12" cy="19" r="1"/>
        </svg>
    `;
    
    // Выпадающее меню
    const dropdownMenu = document.createElement('div');
    dropdownMenu.className = 'profile-dropdown-menu';
    dropdownMenu.id = 'profile-dropdown-menu';
    dropdownMenu.innerHTML = `
        <div class="profile-dropdown-item logout-item" id="logout-from-menu">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9"/>
            </svg>
            <span>Выйти из аккаунта</span>
        </div>
    `;
    
    menuContainer.appendChild(menuButton);
    menuContainer.appendChild(dropdownMenu);
    
    // Добавляем в шапку справа
    profileHeader.appendChild(menuContainer);
    
    // Обработчик для кнопки меню
    menuButton.addEventListener('click', (e) => {
        e.stopPropagation();
        dropdownMenu.classList.toggle('show');
    });
    
    // Обработчик для пункта "Выйти"
    const logoutItem = dropdownMenu.querySelector('.logout-item');
    logoutItem.addEventListener('click', (e) => {
        e.stopPropagation();
        logout();
        dropdownMenu.classList.remove('show');
    });
    
    // Закрытие меню при клике вне его
    document.addEventListener('click', (e) => {
        if (!menuContainer.contains(e.target)) {
            dropdownMenu.classList.remove('show');
        }
    });
}

// ===== РЕДАКТИРОВАНИЕ ПРОФИЛЯ =====

// Fallback: attach listeners to static profile menu elements if they exist
function attachStaticProfileMenuListeners() {
    const menuBtn = document.getElementById('profile-menu-btn');
    const dropdown = document.getElementById('profile-dropdown-menu');
    const logoutItem = document.getElementById('logout-from-menu');

    if (menuBtn && dropdown) {
        if (!menuBtn.dataset.hasListener) {
            menuBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                dropdown.classList.toggle('show');
            });
            menuBtn.dataset.hasListener = '1';
        }

        // Close dropdown when clicking outside
        if (!document.body.dataset.profileDropdownOutsideListener) {
            document.addEventListener('click', (e) => {
                if (!menuBtn.contains(e.target) && !dropdown.contains(e.target)) {
                    dropdown.classList.remove('show');
                }
            });
            document.body.dataset.profileDropdownOutsideListener = '1';
        }
    }

    if (logoutItem && !logoutItem.dataset.hasListener) {
        logoutItem.addEventListener('click', (e) => {
            e.stopPropagation();
            try { logout(); } catch (err) { console.error('Logout failed', err); }
            if (dropdown) dropdown.classList.remove('show');
        });
        logoutItem.dataset.hasListener = '1';
    }
}

document.addEventListener('DOMContentLoaded', attachStaticProfileMenuListeners);
// Also try immediately in case DOM is already loaded
attachStaticProfileMenuListeners();

// Выбор цвета свечения
const glowColorOptions = document.querySelectorAll('.glow-color-option');
const avatarGlow = document.getElementById('avatar-glow');

// Загружаем цвет свечения при открытии профиля
function loadGlowColor() {
    if (!currentUserEmail || !avatarGlow) return;
    const savedGlowColor = localStorage.getItem('glowColor_' + currentUserEmail) || 'gradient';
    setGlowColor(savedGlowColor);
}

// Установка цвета свечения
function setGlowColor(color) {
    if (!avatarGlow) return;
    
    glowColorOptions.forEach(opt => opt.classList.remove('selected'));
    
    const selectedOption = document.querySelector(`.glow-color-option[data-color="${color}"]`);
    if (selectedOption) {
        selectedOption.classList.add('selected');
    }
    
    if (color === 'gradient') {
        avatarGlow.style.background = 'conic-gradient(from 0deg at 50% 50%, #ff5e98 0deg, #8b41df 120deg, #30a1ff 240deg, #ff5e98 360deg)';
    } else {
        avatarGlow.style.background = color;
    }
    // Also update user-profile-avatar-glow
    const profileGlow = document.getElementById('user-profile-avatar-glow');
    if (profileGlow) {
        profileGlow.style.background = avatarGlow.style.background;
    }
}

// Animation selection
const glowAnimMap = {
    'pulse': 'nebulaPulse 12s ease-in-out infinite',
    'spin': 'glowSpin 8s linear infinite',
    'breathe': 'glowBreathe 6s ease-in-out infinite',
    'wave': 'glowWave 8s ease-in-out infinite',
    'flicker': 'glowFlicker 4s ease-in-out infinite',
    'none': 'none'
};

function loadGlowAnimation() {
    if (!currentUserEmail || !avatarGlow) return;
    const saved = localStorage.getItem('glowAnimation_' + currentUserEmail) || 'pulse';
    setGlowAnimation(saved);
}

function setGlowAnimation(animType) {
    if (!avatarGlow) return;
    document.querySelectorAll('.glow-anim-option').forEach(o => o.classList.remove('selected'));
    const sel = document.querySelector(`.glow-anim-option[data-animation="${animType}"]`);
    if (sel) sel.classList.add('selected');

    const animValue = glowAnimMap[animType] || glowAnimMap['pulse'];
    avatarGlow.style.animation = animValue;
    const profileGlow = document.getElementById('user-profile-avatar-glow');
    if (profileGlow) profileGlow.style.animation = animValue;
}

document.querySelectorAll('.glow-anim-option').forEach(option => {
    option.addEventListener('click', function() {
        const anim = this.getAttribute('data-animation');
        setGlowAnimation(anim);
        if (currentUserEmail) {
            localStorage.setItem('glowAnimation_' + currentUserEmail, anim);
        }
    });
});

// Обработчики для выбора цвета
if (glowColorOptions.length > 0) {
    glowColorOptions.forEach(option => {
        option.addEventListener('click', function() {
            const color = this.getAttribute('data-color');
            setGlowColor(color);
            if (currentUserEmail) {
                localStorage.setItem('glowColor_' + currentUserEmail, color);
            }
        });
    });
}

// Обработчик для смены аватарки в редакторе
if (editChangeAvatarBtn && avatarUpload) {
    editChangeAvatarBtn.addEventListener('click', () => {
        avatarUpload.click();
    });
}

// Обработчик для выбора страны в редакторе
if (editCountryPicker) {
    editCountryPicker.addEventListener('click', () => {
        alert('Выбор страны будет доступен в следующем обновлении');
    });
}

// Загружаем цвет свечения при открытии профиля
if (avatarBtn) {
    avatarBtn.addEventListener('click', () => {
        setTimeout(loadGlowColor, 200);
        setTimeout(loadGlowAnimation, 200);
    });
}

// Загружаем цвет свечения при загрузке страницы
document.addEventListener('DOMContentLoaded', loadGlowColor);
document.addEventListener('DOMContentLoaded', loadGlowAnimation);

// Убедимся, что навигация инициализируется после загрузки
if (document.readyState !== 'loading') {
    initNavigation();
}

// ===== ДОБАВЛЕНО: Функция для автоподстановки кода страны =====
function autoFillCountryCode() {
    const phoneInput = document.getElementById('phone-field');
    const currentCodeElement = document.getElementById('current-code');
    if (!phoneInput || !currentCodeElement) return;
    
    phoneInput.addEventListener('input', function(e) {
        let value = this.value.replace(/\D/g, '');
        const countryCode = currentCodeElement.textContent;
        const codeDigits = countryCode.replace(/\D/g, '');
        
        // Если пользователь начал вводить цифры, которые совпадают с кодом страны
        if (value.length > 0 && codeDigits.startsWith(value)) {
            // Ничего не делаем
        }
    });
}

// ===== ОНЛАЙН СИСТЕМА - ФУНКЦИИ =====

async function searchUsersOnline(query) {
    const client = getSupabaseClient();
    if (!client) return [];
    const { data } = await client.from('profiles')
        .select('id, email, display_name, username, avatar_url')
        .or(`email.ilike.%${query}%,username.ilike.%${query}%,display_name.ilike.%${query}%`)
        .limit(20);
    return data || [];
}

async function getOrCreateChatOnline(userId1, userId2) {
    const client = getSupabaseClient();
    const { data: convs } = await client.from('conversation_participants')
        .select('conversation_id').eq('user_id', userId1);
    
    for (const row of convs || []) {
        const { data: parts } = await client.from('conversation_participants')
            .select('user_id').eq('conversation_id', row.conversation_id);
        if (parts?.some(p => p.user_id === userId2)) return row.conversation_id;
    }
    
    const { data: newConv } = await client.from('conversations').insert([{}]).select().single();
    await client.from('conversation_participants').insert([
        { conversation_id: newConv.id, user_id: userId1 },
        { conversation_id: newConv.id, user_id: userId2 }
    ]);
    return newConv.id;
}

async function sendMessageOnline(convId, userId, text) {
    const client = getSupabaseClient();
    return await client.from('messages').insert([{
        conversation_id: convId, sender_id: userId, body: text
    }]).select().single();
}

async function getMessagesOnline(convId) {
    const client = getSupabaseClient();
    const { data } = await client.from('messages')
        .select('*, profiles:sender_id(display_name, avatar_url)')
        .eq('conversation_id', convId).order('created_at');
    return data || [];
}

// ===== ДОБАВЛЕНО: Модифицированный обработчик формы телефона =====
const phoneForm = document.getElementById('phone-form');
if (phoneForm) {
    // Удаляем старый обработчик, если он был
    phoneForm.onsubmit = null;
    
    // Добавляем новый обработчик
    phoneForm.addEventListener('submit', function(e) {
        e.preventDefault();
        
        const phoneInput = document.getElementById('phone-field');
        const currentCodeElement = document.getElementById('current-code');
        let phoneNumber = phoneInput.value;
        const countryCode = currentCodeElement.textContent;
        
        // Убираем все не-цифры из номера
        let phoneDigits = phoneNumber.replace(/\D/g, '');
        
        // Убираем не-цифры из кода страны
        const codeDigits = countryCode.replace(/\D/g, '');
        
        // Проверяем, начинается ли номер с кода страны
        if (!phoneDigits.startsWith(codeDigits) && codeDigits.length > 0 && phoneDigits.length > 0) {
            // Если нет, добавляем код страны в начало
            phoneNumber = countryCode + ' ' + phoneNumber;
        }
        
        if (currentUserEmail) {
            localStorage.setItem('userPhone_' + currentUserEmail, phoneNumber);

            const users = JSON.parse(localStorage.getItem('socialNetworkUsers')) || [];
            const userIndex = users.findIndex(user => user.email === currentUserEmail);
            if (userIndex !== -1) {
                users[userIndex] = {
                    ...users[userIndex],
                    phone: phoneNumber
                };
                localStorage.setItem('socialNetworkUsers', JSON.stringify(users));
                invalidateUsersDirectoryCache();
            }
        }
        
        localStorage.setItem('currentUserEmail', currentUserEmail);
        document.documentElement.classList.add('logged-in');

        if (isSupabaseEnabled()) {
            syncCurrentUserProfileToSupabase().catch(() => {
                // do not block login flow if profile sync fails
            });
        }

        goToMainScreen();
    });
}

// ===== ДОБАВЛЕНО: Обработчик для кнопки с тремя точками =====
document.addEventListener('DOMContentLoaded', function() {
    autoFillCountryCode();
});

// =========================================
// НОВЫЕ ФУНКЦИИ ДЛЯ АККАУНТОВ И НАСТРОЕК
// =========================================

// Получить список сохранённых аккаунтов
function getLoggedInAccounts() {
    return JSON.parse(localStorage.getItem('loggedInAccounts')) || [];
}

// Сохранить список аккаунтов
function saveLoggedInAccounts(accounts) {
    localStorage.setItem('loggedInAccounts', JSON.stringify(accounts));
}

// Добавить аккаунт в список (при входе/регистрации)
function addAccountToLoggedList(email) {
    email = normalizeEmail(email);
    if (!email) return;

    let accounts = getLoggedInAccounts();
    if (!accounts.some(acc => normalizeEmail(acc.email) === email)) {
        const displayName = localStorage.getItem('userDisplayName_' + email) || email.split('@')[0];
        accounts.push({ email, displayName });
        saveLoggedInAccounts(accounts);
    }
    // Если открыт экран настроек, обновить список
    if (document.getElementById('screen-settings').classList.contains('active')) {
        renderAccountsList();
    }
}

// Удалить аккаунт из списка (без автоматического выхода)
function removeAccount(email) {
    const normalizedEmail = normalizeEmail(email);
    let accounts = getLoggedInAccounts().filter(acc => normalizeEmail(acc.email) !== normalizedEmail);
    saveLoggedInAccounts(accounts);
    // Если открыт экран настроек, обновить список
    if (document.getElementById('screen-settings').classList.contains('active')) {
        renderAccountsList();
    }
}

// Переключиться на другой аккаунт
function switchToAccount(email) {
    email = normalizeEmail(email);
    if (email === currentUserEmail) return;
    let users = JSON.parse(localStorage.getItem('socialNetworkUsers')) || [];
    let user = users.find(u => normalizeEmail(u.email) === email);
    if (user) {
        activeConversationId = null;
        activeThreadDom = null;
        lastRenderedConversationSignature = '';
        currentUserEmail = null;
        localStorage.removeItem('currentUserEmail');
        currentUserEmail = normalizeEmail(user.email);
        localStorage.setItem('currentUserEmail', currentUserEmail);
        document.documentElement.classList.add('logged-in');
        loadUserAvatar();
        updateDisplayData();
        goToMainScreen();
        renderAccountsList();
    }
}

// Обновлённая функция выхода (удаляет текущий аккаунт и переключается на другой, если есть)
function logout() {
    const accounts = getLoggedInAccounts();
    const otherAccounts = accounts.filter(acc => normalizeEmail(acc.email) !== normalizeEmail(currentUserEmail));
    
    // Удаляем текущий аккаунт из списка
    removeAccount(currentUserEmail);

    if (otherAccounts.length > 0) {
        // Переключаемся на первый другой аккаунт
        switchToAccount(otherAccounts[0].email);
    } else {
        // Если других нет, выходим полностью
        performFullLogout();
    }
}

// Отрисовать список аккаунтов в настройках
function renderAccountsList() {
    const container = document.getElementById('accounts-list');
    if (!container) return;
    
    const accounts = getLoggedInAccounts();
    container.innerHTML = '';

    // Отрисовка каждого аккаунта (не более 3)
    accounts.slice(0, 3).forEach(acc => {
        const email = acc.email;
        const displayName = acc.displayName || email.split('@')[0];
        const firstLetter = displayName.charAt(0).toUpperCase();

        const item = document.createElement('div');
        item.className = 'account-item';
        item.setAttribute('data-email', email);

        // Аватар
        const avatarDiv = document.createElement('div');
        avatarDiv.className = 'account-avatar';

        const savedAvatar = localStorage.getItem('userAvatar_' + email);
        if (savedAvatar) {
            avatarDiv.style.backgroundImage = `url(${savedAvatar})`;
        } else {
            // Генерируем цвет на основе email
            const hash = email.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
            const colors = ['#ff5e98', '#8b41df', '#30a1ff', '#00e676', '#ff9800', '#f44336', '#00bcd4'];
            const color = colors[hash % colors.length];
            avatarDiv.style.backgroundColor = color;
            avatarDiv.textContent = firstLetter;
        }

        // Имя
        const nameSpan = document.createElement('span');
        nameSpan.className = 'account-name';
        nameSpan.textContent = displayName;

        item.appendChild(avatarDiv);
        item.appendChild(nameSpan);
        item.addEventListener('click', () => switchToAccount(email));
        container.appendChild(item);
    });

    // Кнопка "Добавить аккаунт", если аккаунтов меньше 3
    if (accounts.length < 3) {
        const addItem = document.createElement('div');
        addItem.className = 'account-item add-account';
        addItem.id = 'add-account-btn';

        const addAvatar = document.createElement('div');
        addAvatar.className = 'account-avatar add-icon';
        addAvatar.textContent = '+';

        const addName = document.createElement('span');
        addName.className = 'account-name';
        addName.textContent = 'Добавить аккаунт';

        addItem.appendChild(addAvatar);
        addItem.appendChild(addName);
        addItem.addEventListener('click', () => {
            performFullLogout(); // выходим полностью и переходим на экран входа
        });

        container.appendChild(addItem);
    }
}

// Переход к сервисам
function goToServicesScreen() {
    goToScreen('screen-services');
}

// Переход к настройкам
function goToSettingsScreen() {
    renderAccountsList();
    goToScreen('screen-settings');
}

function initThemeToggle() {
    if (themeToggleInitialized) return;
    themeToggleInitialized = true;

    const themeBtnHeader = document.getElementById('action-theme');
    const themeBtnSettings = document.getElementById('action-theme-settings');
    const themeLabel = document.getElementById('theme-label');
    const toggleHandler = () => {
        const currentTheme = localStorage.getItem('appTheme') || 'light';
        const newTheme = currentTheme === 'dark' ? 'light' : 'dark';
        applyTheme(newTheme);
    };

    if (themeBtnHeader) themeBtnHeader.addEventListener('click', toggleHandler);
    if (themeBtnSettings) themeBtnSettings.addEventListener('click', toggleHandler);
    if (!themeLabel) return;
}

function loadSavedTheme() {
    // Загружаем сохраненную тему или используем белую тему по умолчанию
    const savedTheme = localStorage.getItem('appTheme') || 'light';
    applyTheme(savedTheme);
}

function initImageModal() {
    if (imageModalInitialized) return;
    imageModalInitialized = true;

    const modal = document.getElementById('image-modal');
    const closeBtn = document.getElementById('image-modal-close');
    const downloadBtn = document.getElementById('image-modal-download');
    
    if (!modal) return;
    
    // Закрыть при клике на крестик
    if (closeBtn) {
        closeBtn.addEventListener('click', () => {
            modal.classList.remove('active');
        });
    }
    
    // Закрыть при клике на backdrop (вне контента)
    modal.addEventListener('click', (e) => {
        if (e.target === modal) {
            modal.classList.remove('active');
        }
    });
    
    // Закрыть при нажатии Escape
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && modal.classList.contains('active')) {
            modal.classList.remove('active');
        }
    });
    
    // Обработчик для кнопки скачивания в модали
    if (downloadBtn) {
        downloadBtn.addEventListener('click', () => {
            const link = document.createElement('a');
            link.href = downloadBtn.href;
            link.download = downloadBtn.download;
            link.click();
        });
    }
}

function applyTheme(theme) {
    if (theme === 'light') {
        document.body.classList.add('light-theme');
        localStorage.setItem('appTheme', 'light');
        const themeLabel = document.getElementById('theme-label');
        if (themeLabel) {
            themeLabel.textContent = 'Темная тема';
        }
    } else {
        document.body.classList.remove('light-theme');
        localStorage.setItem('appTheme', 'dark');
        const themeLabel = document.getElementById('theme-label');
        if (themeLabel) {
            themeLabel.textContent = 'Светлая тема';
        }
    }
}

// Обработчики кнопок действий в настройках (заглушки)
document.querySelectorAll('#action-notifications, #action-devices, #action-language, #action-wallet, #premium-card, #business-card').forEach(btn => {
    if (btn) {
        btn.addEventListener('click', () => {
            alert('Функция в разработке');
        });
    }
});

// Обработчик кликов по карточкам сервисов
document.querySelectorAll('.service-card').forEach(card => {
    card.addEventListener('click', () => {
        const serviceUrl = (card.getAttribute('data-url') || '').trim();
        if (!serviceUrl) {
            alert('Ссылка для этого сервиса пока не указана');
            return;
        }

        try {
            const resolvedUrl = new URL(serviceUrl, window.location.href);
            window.location.href = resolvedUrl.href;
        } catch (error) {
            alert('Некорректная ссылка у сервиса');
        }
    });
});

// Функция для удаления всех локальных аккаунтов (вызывается из консоли браузера)
function clearAllLocalAccounts() {
    localStorage.removeItem('socialNetworkUsers');
    localStorage.removeItem('loggedInAccounts');
    
    // Удаляем все ключи, связанные с пользователями
    const keysToRemove = [];
    for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key && (key.includes('userDisplayName_') || key.includes('userName_') || 
                    key.includes('userPhone_') || key.includes('userStatus_') || 
                    key.includes('userBirthday_') || key.includes('glowColor_') || 
                    key.includes('userAvatar_') || key.includes('supabaseSignupCooldownUntil_'))) {
            keysToRemove.push(key);
        }
    }
    
    keysToRemove.forEach(key => localStorage.removeItem(key));
    
    console.log('✓ Все локальные аккаунты удалены');
    console.log('✓ Все данные пользователей удалены');
    
    // Обновляем UI
    if (document.getElementById('screen-settings').classList.contains('active')) {
        renderAccountsList();
    }
}

// Фикс навигации после смены экрана
function fixNavigationPosition() {
    const nav = document.querySelector('.bottom-nav-glass');
    if (nav) {
        nav.style.position = 'fixed';
        nav.style.bottom = '20px';
        nav.style.left = '50%';
        nav.style.transform = 'translateX(-50%)';
        nav.style.zIndex = '10000';
    }
}

// Вызываем при загрузке и после каждого переключения экрана
window.addEventListener('load', fixNavigationPosition);
window.addEventListener('resize', fixNavigationPosition);

// Перехватываем оригинальную функцию goToScreen
const originalGoToScreen = goToScreen;
goToScreen = function(screenId) {
    originalGoToScreen(screenId);
    requestAnimationFrame(() => {
        fixNavigationPosition();
        updateBottomNavigationVisibility();
    });
};

// ===== ВЫДВИЖНОЙ ПОИСК В ЧАТАХ =====
function initSearchToggle() {
    if (searchToggleInitialized) return;
    searchToggleInitialized = true;

    const searchToggle = document.getElementById('search-toggle');
    const searchInput = document.getElementById('chat-search');
    const searchWrapper = document.querySelector('.search-wrapper');
    const screenMain = document.getElementById('screen-main');
    const chatArea = document.getElementById('chat-area');

    if (!searchToggle || !searchInput || !searchWrapper || !screenMain || !chatArea) return;

    let searchSubmenu = document.getElementById('search-submenu');
    if (!searchSubmenu) {
        searchSubmenu = document.createElement('div');
        searchSubmenu.className = 'chat-submenu search-submenu';
        searchSubmenu.id = 'search-submenu';
        searchSubmenu.innerHTML = `
            <div class="chat-submenu-inner" id="search-submenu-inner">
                <button class="submenu-btn" data-tab="users" type="button">Пользователи</button>
                <button class="submenu-btn" data-tab="chats" type="button">Чаты</button>
                <button class="submenu-btn" data-tab="communities" type="button">Сообщества</button>
                <button class="submenu-btn" data-tab="downloads" type="button">Загрузки</button>
                <button class="submenu-btn" data-tab="music" type="button">Музыка</button>
                <button class="submenu-btn" data-tab="files" type="button">Файлы</button>
            </div>
        `;
        const mainSubmenu = screenMain.querySelector('.chat-submenu');
        if (mainSubmenu) {
            mainSubmenu.insertAdjacentElement('afterend', searchSubmenu);
        }
    }

    let searchCloseBtn = document.getElementById('search-close-btn');
    if (!searchCloseBtn) {
        searchCloseBtn = document.createElement('button');
        searchCloseBtn.id = 'search-close-btn';
        searchCloseBtn.className = 'search-close-btn';
        searchCloseBtn.type = 'button';
        searchCloseBtn.setAttribute('aria-label', 'Закрыть поиск');
        searchCloseBtn.innerHTML = `
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <line x1="18" y1="6" x2="6" y2="18"/>
                <line x1="6" y1="6" x2="18" y2="18"/>
            </svg>
        `;
        searchWrapper.appendChild(searchCloseBtn);
    }

    function openSearchMode() {
        searchModeActive = true;
        activeSearchSubmenuTab = 'users';
        screenMain.classList.add('search-mode');
        searchInput.classList.add('active');
        searchInput.focus();

        const inner = document.getElementById('search-submenu-inner');
        if (inner) {
            initSlidingSubmenu(inner, 'users', (tab) => {
                activeSearchSubmenuTab = tab || 'users';
                if (activeSearchSubmenuTab === 'communities') {
                    addSearchHistoryItem('communities', 'communities-home', 'Сообщества', 'Открыт раздел сообществ');
                }
                scheduleChatAreaUpdate({ skipRemoteRefresh: true });
            });
            if (typeof inner.__refreshSubmenuIndicator === 'function') {
                inner.__refreshSubmenuIndicator();
                setTimeout(() => inner.__refreshSubmenuIndicator(), 120);
                setTimeout(() => inner.__refreshSubmenuIndicator(), 260);
            }
        }

        scheduleChatAreaUpdate({ skipRemoteRefresh: true });
    }

    const closeSearchMode = function() {
        if (!searchModeActive) return;
        searchModeActive = false;
        screenMain.classList.remove('search-mode');
        searchInput.classList.remove('active');
        searchInput.value = '';
        scheduleChatAreaUpdate({ skipRemoteRefresh: true });
    };
    window.closeSearchMode = closeSearchMode;

    // Показать поиск при клике на кнопку
    searchToggle.addEventListener('click', (e) => {
        e.stopPropagation();
        if (!searchModeActive) {
            openSearchMode();
        } else {
            searchInput.focus();
        }
    });

    searchCloseBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        closeSearchMode();
    });

    // Скрыть поиск при двойном клике вне поиска
    document.addEventListener('dblclick', (e) => {
        if (!searchModeActive) return;
        if (!searchWrapper.contains(e.target) && !searchSubmenu.contains(e.target)) {
            closeSearchMode();
        }
    });

    chatArea.addEventListener('dblclick', (e) => {
        if (!searchModeActive) return;
        if (e.target === chatArea || e.target.classList.contains('no-chats-message')) {
            closeSearchMode();
        }
    });

    // Скрыть по нажатию Escape
    searchInput.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
            closeSearchMode();
        }
    });
}
