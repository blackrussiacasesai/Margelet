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

const SIGNUP_COOLDOWN_MS = 2 * 60 * 1000;

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

function appendLocalMessageToActiveConversation(messageText) {
    const store = getConversationsStore();
    const conversation = store[activeConversationId];
    if (!conversation) return;

    conversation.messages.push({
        sender: currentUserEmail,
        text: messageText,
        timestamp: Date.now()
    });

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

function upsertUserInLocalDirectory(email, name = '') {
    const normalizedEmail = normalizeEmail(email);
    if (!normalizedEmail) return;

    const users = JSON.parse(localStorage.getItem('socialNetworkUsers')) || [];
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

    localStorage.setItem('socialNetworkUsers', JSON.stringify(users));
}

async function syncCurrentUserProfileToSupabase() {
    const client = getSupabaseClient();
    if (!client || !currentUserEmail || !supabaseProfilesTableAvailable) return;

    const { data: authData, error: authError } = await client.auth.getUser();
    if (authError || !authData?.user?.id) return;

    const displayName = (localStorage.getItem('userDisplayName_' + currentUserEmail) || '').trim();
    const username = normalizeUsername(localStorage.getItem('userName_' + currentUserEmail) || '');
    const phone = String(localStorage.getItem('userPhone_' + currentUserEmail) || '').trim();
    const about = String(localStorage.getItem('userStatus_' + currentUserEmail) || '').trim();
    const birthdayRaw = String(localStorage.getItem('userBirthday_' + currentUserEmail) || '').trim();
    const glowColor = String(localStorage.getItem('glowColor_' + currentUserEmail) || 'gradient').trim();
    const avatarUrl = localStorage.getItem('userAvatar_' + currentUserEmail) || null;

    const payload = {
        id: authData.user.id,
        email: currentUserEmail,
        display_name: displayName || currentUserEmail.split('@')[0] || 'Пользователь',
        username: username || null,
        phone: phone || null,
        about: about || null,
        birthday: birthdayRaw || null,
        glow_color: glowColor || 'gradient',
        avatar_url: avatarUrl
    };

    const { error } = await client
        .from('profiles')
        .upsert(payload, { onConflict: 'id' });

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
            .select('email, display_name, username, phone, avatar_url, about, birthday, glow_color')
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
                glowColor: profile.glow_color || existing.glowColor || 'gradient'
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

function getStoredConversations() {
    return JSON.parse(localStorage.getItem(CHAT_STORAGE_KEY)) || {};
}

function persistConversations(store) {
    localStorage.setItem(CHAT_STORAGE_KEY, JSON.stringify(store));
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
            remoteId: row.id,
            sender: row.sender_email,
            text: row.body,
            timestamp: Number(row.sent_at || Date.now())
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
        conversation.messages.sort((a, b) => a.timestamp - b.timestamp);
    }
    conversation.updatedAt = Math.max(conversation.updatedAt || 0, normalized.message.timestamp);

    store[normalized.conversationId] = conversation;
    persistConversations(store);
}

async function loadSupabaseMessagesToLocalStore() {
    const client = getSupabaseClient();
    if (!client || !currentUserEmail || !supabaseMessagesTableAvailable) return;

    const { data, error } = await client
        .from('messages_app')
        .select('id, conversation_id, participants, sender_email, body, sent_at')
        .contains('participants', [currentUserEmail])
        .order('sent_at', { ascending: true });

    if (error) {
        if (isSupabaseMessagesTableMissing(error)) {
            supabaseMessagesTableAvailable = false;
            if (!supabaseMessagesMissingWarningShown) {
                console.warn('Supabase table public.messages_app is missing. Chat works in local mode until table is created.');
                supabaseMessagesMissingWarningShown = true;
            }
        }
        return;
    }
    if (!Array.isArray(data)) return;

    const baseStore = getStoredConversations();
    Object.keys(baseStore).forEach(conversationId => {
        const conv = baseStore[conversationId];
        if (conv?.participants?.includes(currentUserEmail)) {
            baseStore[conversationId] = {
                ...conv,
                messages: []
            };
        }
    });

    persistConversations(baseStore);
    data.forEach(row => mergeSupabaseMessageRowIntoStore(row));
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
                    updateChatArea();
                }
            }
        )
        .subscribe();

    supabaseChatInitializedForEmail = currentUserEmail;
}

// При загрузке страницы проверяем, не был ли пользователь уже авторизован
window.addEventListener('DOMContentLoaded', async () => {
    const restoredFromSupabase = await restoreSupabaseSessionIfPossible();
    if (!restoredFromSupabase) {
        const stored = localStorage.getItem('currentUserEmail');
        if (stored) {
            currentUserEmail = stored;
            goToMainScreen();
        }
    }
    
    // Скрываем поле ввода имени под аватаркой
    const usernameContainer = document.querySelector('.username-container');
    if (usernameContainer) {
        usernameContainer.style.display = 'none';
    }
    
    // Инициализируем навигацию
    initNavigation();
    
    // Инициализируем выпадающее меню профиля
    setTimeout(() => {
        initProfileMenu();
    }, 500);

    // Инициализируем поиск
    initSearchToggle();
});

// Функция переключения экранов
function goToScreen(screenId) {
    document.querySelectorAll('.screen').forEach(screen => {
        screen.classList.remove('active');
    });
    document.getElementById(screenId).classList.add('active');

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
        updateChatArea();

        if (isSupabaseEnabled()) {
            syncCurrentUserProfileToSupabase().then(() => {
                return syncSupabaseProfilesToLocalDirectory(true);
            }).then(() => {
                updateChatArea();
            });

            initSupabaseRealtimeChats().then(() => {
                updateChatArea();
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
    const users = JSON.parse(localStorage.getItem('socialNetworkUsers')) || [];
    const user = users.find(u => normalizeEmail(u.email) === normalizedEmail && u.password === password);
    if (!user) return false;

    completeSuccessfulLogin(normalizeEmail(user.email), user.name || '');
    return true;
}

function getLegacyLocalUserByEmail(email) {
    const normalizedEmail = normalizeEmail(email);
    const users = JSON.parse(localStorage.getItem('socialNetworkUsers')) || [];
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
            }
        }
    });

    if (!error) return;

    const reason = String(error.message || '').toLowerCase();
    if (error.status === 429 || reason.includes('too many requests') || reason.includes('over_email_send_rate_limit')) {
        setSignupCooldownUntil(normalizedEmail, Date.now() + SIGNUP_COOLDOWN_MS);
        return;
    }

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
    
    const client = getSupabaseClient();
    if (client) {
        const { data, error } = await client.auth.signInWithPassword({ email, password });
        if (!error && data?.user?.email) {
            completeSuccessfulLogin(data.user.email, data.user.user_metadata?.display_name || '');
            return;
        }

        // Для старых аккаунтов, созданных до Supabase, оставляем совместимость через localStorage.
        if (tryLegacyLocalLogin(email, password)) {
            alert('Вход выполнен через локальные данные аккаунта.');
            return;
        }

        const reason = String(error?.message || '').toLowerCase();
        if (reason.includes('email not confirmed')) {
            alert('Подтвердите почту через письмо от Supabase и попробуйте снова.');
            return;
        }

        if (reason.includes('invalid login credentials')) {
            alert('Аккаунт не найден или пароль неверный. Зарегистрируйтесь, если аккаунт еще не создан в Supabase.');
            return;
        }

        alert('Ошибка входа: ' + (error?.message || 'неизвестная ошибка'));
        return;
    }

    if (!tryLegacyLocalLogin(email, password)) {
        alert('Ошибка: Неверная почта или пароль');
        return;
    }
});

async function registerCurrentPendingUser() {
    if (registrationRequestInFlight) return;
    if (!currentRegistrationEmail || !currentRegistrationPassword || !currentRegistrationName) return;

    const now = Date.now();
    const cooldownUntil = getSignupCooldownUntil(currentRegistrationEmail);
    if (now < cooldownUntil) {
        const waitSeconds = Math.ceil((cooldownUntil - now) / 1000);
        alert('Подожди ' + waitSeconds + ' сек. перед новой попыткой регистрации.');
        return;
    }

    registrationRequestInFlight = true;
    try {
        const client = getSupabaseClient();
        if (client) {
            const emailRedirectTo = window.location.origin + window.location.pathname;
            const { data, error } = await client.auth.signUp({
                email: currentRegistrationEmail,
                password: currentRegistrationPassword,
                options: {
                    emailRedirectTo,
                    data: {
                        display_name: currentRegistrationName
                    }
                }
            });

            if (error) {
                const reason = String(error.message || '').toLowerCase();
                if (reason.includes('too many requests') || reason.includes('over_email_send_rate_limit')) {
                    setSignupCooldownUntil(currentRegistrationEmail, Date.now() + SIGNUP_COOLDOWN_MS);
                    alert('Слишком много попыток регистрации. Подождите 1-2 минуты и попробуйте снова.');
                } else {
                    alert('Ошибка регистрации: ' + error.message);
                }
                return;
            }

            localStorage.setItem('userDisplayName_' + currentRegistrationEmail, currentRegistrationName);
            upsertUserInLocalDirectory(currentRegistrationEmail, currentRegistrationName);

            const signedInEmail = data?.session?.user?.email || data?.user?.email || currentRegistrationEmail;
            
            currentUserEmail = signedInEmail;
            localStorage.setItem('currentUserEmail', currentUserEmail);
            document.documentElement.classList.add('logged-in');
            addAccountToLoggedList(currentUserEmail);

            setTimeout(() => {
                loadUserAvatar();
            }, 100);

            goToMainScreen();
        } else {
            const users = JSON.parse(localStorage.getItem('socialNetworkUsers')) || [];
            users.push({ 
                email: currentRegistrationEmail, 
                password: currentRegistrationPassword,
                name: currentRegistrationName
            });
            localStorage.setItem('socialNetworkUsers', JSON.stringify(users));

            currentUserEmail = currentRegistrationEmail;
            localStorage.setItem('currentUserEmail', currentUserEmail);
            localStorage.setItem('userDisplayName_' + currentUserEmail, currentRegistrationName);
            addAccountToLoggedList(currentUserEmail);

            setTimeout(() => {
                loadUserAvatar();
            }, 100);

            goToMainScreen();
        }

        currentRegistrationEmail = null;
        currentRegistrationPassword = null;
        currentRegistrationName = null;
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
function updateChatArea() {
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

    if (query) {
        renderUserSearchResults(query, chatArea);
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
    }

    renderConversationsList(chatArea);
    chatForm.classList.add('hidden');
    updateBottomNavigationVisibility();
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

// Вызываем при загрузке
document.addEventListener('DOMContentLoaded', function() {
    initMessaging();
});

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

function getUserRecordByEmail(email) {
    const normalizedEmail = normalizeEmail(email);
    if (!normalizedEmail) return null;
    const users = JSON.parse(localStorage.getItem('socialNetworkUsers')) || [];
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
    const blockButton = document.getElementById('user-profile-block-btn');
    if (!blockButton || !currentViewedUserProfileEmail || !currentUserEmail) return;

    const blocked = isUserBlocked(currentViewedUserProfileEmail);
    blockButton.textContent = blocked ? 'Разблокировать пользователя' : 'Заблокировать пользователя';
    blockButton.classList.toggle('blocked', blocked);
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
    if (profileStatus) profileStatus.textContent = savedStatus.trim() || 'Не указан';

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
    persistConversations(store);
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

function renderUserSearchResults(query, chatArea) {
    const normalizedQuery = query.toLowerCase();
    const queryPhone = normalizePhone(query);
    const queryUsername = normalizeUsername(query);

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

function renderConversationsList(chatArea) {
    const conversations = getCurrentUserConversations();

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

        const row = document.createElement('button');
        row.type = 'button';
        row.className = 'chat-list-item';
        row.innerHTML = `
            ${createAvatarMarkup(peer)}
            <div class="chat-list-content">
                <div class="chat-list-top">
                    <span class="chat-list-name">${escapeHtml(peer.displayName)}</span>
                    <span class="chat-list-time">${escapeHtml(lastTime)}</span>
                </div>
                <div class="chat-list-bottom">${escapeHtml(lastText)}</div>
            </div>
        `;

        row.addEventListener('click', (e) => {
            if (e.target.closest('.user-profile-trigger')) return;

            activeConversationId = conversation.id;
            updateChatArea();
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

function renderConversationThread(chatArea, conversation) {
    const peerEmail = getOtherParticipantEmail(conversation);
    if (!peerEmail) {
        activeConversationId = null;
        renderConversationsList(chatArea);
        return;
    }

    const peerName = getDisplayNameByEmail(peerEmail);
    const peerUsername = getUsernameByEmail(peerEmail);
    const peerAvatar = getAvatarByEmail(peerEmail);
    const peerFirstLetter = peerName.charAt(0).toUpperCase();
    const avatarStyle = peerAvatar ? `style="background-image:url('${escapeHtml(peerAvatar)}');"` : '';

    const headerSubtitle = peerUsername ? '@' + peerUsername : 'Пользователь Marglet';

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
            <div class="thread-messages" id="thread-messages"></div>
        </div>
    `;

    const messagesContainer = document.getElementById('thread-messages');
    if (!messagesContainer) return;

    if (!conversation.messages.length) {
        messagesContainer.innerHTML = '<div class="thread-empty">Напишите первое сообщение</div>';
    } else {
        conversation.messages.forEach(message => {
            const isOutgoing = message.sender === currentUserEmail;
            const bubble = document.createElement('div');
            bubble.className = `message ${isOutgoing ? 'outgoing' : 'incoming'}`;
            bubble.textContent = message.text;
            messagesContainer.appendChild(bubble);
        });
    }

    messagesContainer.scrollTop = messagesContainer.scrollHeight;

    const input = document.getElementById('chat-message-input');
    if (input) {
        input.placeholder = `Сообщение для ${peerName}...`;
    }

    const backBtn = document.getElementById('thread-back-btn');
    const peerAvatarTrigger = chatArea.querySelector('.thread-peer-avatar.user-profile-trigger');

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
            updateChatArea();
        });
    }
}

async function sendMessageToActiveConversation(text) {
    if (!currentUserEmail || !activeConversationId || !text.trim()) return;

    const store = getConversationsStore();
    const conversation = store[activeConversationId];
    if (!conversation) return;

    const messageText = text.trim();

    const client = getSupabaseClient();
    if (client && supabaseMessagesTableAvailable) {
        const messageRow = {
            conversation_id: activeConversationId,
            participants: conversation.participants,
            sender_email: currentUserEmail,
            body: messageText,
            sent_at: Date.now()
        };

        const { data, error } = await client
            .from('messages_app')
            .insert(messageRow)
            .select('id, conversation_id, participants, sender_email, body, sent_at')
            .single();

        if (error) {
            if (isSupabaseMessagesTableMissing(error)) {
                supabaseMessagesTableAvailable = false;
                if (!supabaseMessagesMissingWarningShown) {
                    alert('Таблица сообщений в Supabase не найдена. Временно используется локальный чат. Запусти SQL из supabase-schema.sql.');
                    supabaseMessagesMissingWarningShown = true;
                }
                appendLocalMessageToActiveConversation(messageText);
                return;
            }
            alert('Не удалось отправить сообщение: ' + error.message);
            return;
        }

        if (data) {
            mergeSupabaseMessageRowIntoStore(data);
            updateChatArea();
        }
        return;
    }

    appendLocalMessageToActiveConversation(messageText);
}

function initMessaging() {
    if (messagingInitialized) {
        updateChatArea();
        return;
    }

    const chatForm = document.getElementById('chat-form');
    const messageInput = document.getElementById('chat-message-input');
    const searchInput = document.getElementById('chat-search');

    if (chatForm && messageInput) {
        chatForm.addEventListener('submit', async function(e) {
            e.preventDefault();
            if (!activeConversationId) return;
            await sendMessageToActiveConversation(messageInput.value);
            messageInput.value = '';
            messageInput.focus();
        });
    }

    if (searchInput) {
        searchInput.addEventListener('input', () => {
            const query = (searchInput.value || '').trim();
            if (query && isSupabaseEnabled()) {
                syncSupabaseProfilesToLocalDirectory().then(() => {
                    updateChatArea();
                });
                return;
            }

            updateChatArea();
        });
    }

    messagingInitialized = true;
    updateChatArea();
}

const userProfileBlockBtn = document.getElementById('user-profile-block-btn');
if (userProfileBlockBtn) {
    userProfileBlockBtn.addEventListener('click', toggleBlockViewedUser);
}

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
    
    // Заголовок
    const title = document.createElement('div');
    title.className = 'details-title';
    title.textContent = 'Подробности об аккаунте';
    detailsSection.appendChild(title);
    
    // Получаем данные пользователя
    const savedUsername = localStorage.getItem('userName_' + currentUserEmail) || '';
    const displayUsername = savedUsername ? '@' + savedUsername : 'Не указано';
    const savedPhone = localStorage.getItem('userPhone_' + currentUserEmail) || 'Не указан';
    
    // Элемент Username (логин) с @
    const usernameItem = createDetailItem('username', 'Username', displayUsername, 'username');
    detailsSection.appendChild(usernameItem);
    
    // Элемент Email
    const emailItem = createDetailItem('email', 'Email', currentUserEmail, 'email');
    detailsSection.appendChild(emailItem);
    
    // Элемент Телефон
    const phoneItem = createDetailItem('phone', 'Телефон', savedPhone, 'phone');
    detailsSection.appendChild(phoneItem);
    
    // Кнопка редактирования внутри секции
    const editButton = document.createElement('button');
    editButton.className = 'edit-profile-inside-btn';
    editButton.innerHTML = `
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M12 20h9M16.5 3.5L20 7l-9 9H7v-4l9-9z"/>
        </svg>
        Редактировать профиль
    `;
    
    editButton.addEventListener('click', function() {
        loadEditData();
        goToScreen('screen-edit-profile');
    });
    
    detailsSection.appendChild(editButton);
    
    // Вставляем секцию перед кнопкой сервисы
    const servicesSection = profileContent.querySelector('.services-section');
    if (servicesSection) {
        profileContent.insertBefore(detailsSection, servicesSection);
    } else {
        profileContent.appendChild(detailsSection);
    }
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
    });
}

// ===== ВЫПАДАЮЩЕЕ МЕНЮ ПРОФИЛЯ =====

// Функция инициализации меню профиля
function initProfileMenu() {
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
        avatarGlow.style.background = 'linear-gradient(135deg, #ff5e98, #8b41df, #30a1ff)';
    } else {
        avatarGlow.style.background = color;
    }
}

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
    });
}

// Загружаем цвет свечения при загрузке страницы
document.addEventListener('DOMContentLoaded', loadGlowColor);

// Убедимся, что навигация инициализируется после загрузки
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initNavigation);
} else {
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
        }
    });
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
    const menuBtn = document.getElementById('profile-menu-btn');
    const dropdownMenu = document.getElementById('profile-dropdown-menu');
    const logoutItem = document.getElementById('logout-from-menu');
    
    if (menuBtn && dropdownMenu) {
        menuBtn.addEventListener('click', function(e) {
            e.stopPropagation();
            dropdownMenu.classList.toggle('show');
        });
        
        document.addEventListener('click', function(e) {
            if (!menuBtn.contains(e.target) && !dropdownMenu.contains(e.target)) {
                dropdownMenu.classList.remove('show');
            }
        });
    }
    
    if (logoutItem) {
        logoutItem.addEventListener('click', function(e) {
            e.preventDefault();
            e.stopPropagation();
            
            // Используем существующую функцию logout
            if (typeof logout === 'function') {
                logout();
            }
            
            if (dropdownMenu) {
                dropdownMenu.classList.remove('show');
            }
        });
    }
    
    // Вызываем функцию авто-подстановки
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
    setTimeout(() => {
        fixNavigationPosition();
        updateBottomNavigationVisibility();
    }, 50); // Небольшая задержка
};

// ===== ВЫДВИЖНОЙ ПОИСК В ЧАТАХ =====
function initSearchToggle() {
    const searchToggle = document.getElementById('search-toggle');
    const searchInput = document.getElementById('chat-search');
    const searchWrapper = document.querySelector('.search-wrapper');

    if (!searchToggle || !searchInput || !searchWrapper) return;

    // Показать поиск при клике на кнопку
    searchToggle.addEventListener('click', (e) => {
        e.stopPropagation();
        searchInput.classList.add('active');
        searchInput.focus();
    });

    // Скрыть поиск при клике вне поля
    document.addEventListener('click', (e) => {
        if (searchInput.classList.contains('active') && !searchWrapper.contains(e.target)) {
            searchInput.classList.remove('active');
            if (searchInput.value) {
                searchInput.value = '';
                updateChatArea();
            }
        }
    });

    // Скрыть по нажатию Escape
    searchInput.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
            searchInput.classList.remove('active');
            searchInput.value = '';
            updateChatArea();
        }
    });
}