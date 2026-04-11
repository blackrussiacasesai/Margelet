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
let supabaseCollectionSyncInFlight = false;
let supabaseCollectionLastSyncAt = 0;
let supabaseCollectionTableAvailable = true;
let supabaseCollectionMissingWarningShown = false;
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
let outgoingMessageQueue = [];
let isOutgoingQueueProcessing = false;
let pendingAttachmentDraft = null;
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
let storyViewerInitialized = false;
let storyViewerItems = [];
let storyViewerIndex = 0;
let storyViewerAutoTimer = null;
let storyViewerProgressTimer = null;
let storyViewerProgressStartedAt = 0;
const STORY_VIEWER_DURATION_MS = 4500;
let mobilePullRefreshInitialized = false;
let searchModeActive = false;
let avatarParticlesInitialized = false;
let avatarParticleStates = [];
let avatarParticlesRafId = null;
const AVATAR_PARTICLE_DRAW_SIZE = 224;
const AVATAR_PARTICLE_ANIMATION_DEFAULT = 'orbit';
const AVATAR_PARTICLE_ANIMATION_SET = new Set(['orbit', 'nebula', 'shaderflow']);
const AVATAR_SHADERFLOW_VERTEX_SOURCE = `
attribute vec2 a_position;
void main() {
  gl_Position = vec4(a_position, 0.0, 1.0);
}
`;
const AVATAR_SHADERFLOW_FRAGMENT_SOURCE = `
#ifdef GL_ES
precision highp float;
#endif

uniform vec2 u_resolution;
uniform vec2 u_mouse;
uniform float u_time;

vec3 palette3(float t, float factor) {
    vec3 a = vec3(0.5) + 0.3 * sin(vec3(0.1, 0.3, 0.5) * factor);
    vec3 b = vec3(0.5) + 0.3 * cos(vec3(0.2, 0.4, 0.6) * factor);
    vec3 c = vec3(1.0) + 0.5 * sin(vec3(0.3, 0.7, 0.9) * factor);
    vec3 d = vec3(0.25, 0.4, 0.55) + 0.2 * cos(vec3(0.5, 0.6, 0.7) * factor);
    return a + b * cos(6.28318 * (c * t + d));
}

void main() {
    vec2 st = (gl_FragCoord.xy / u_resolution.xy) * 2.0 - 1.0;
    st.x *= u_resolution.x/u_resolution.y;
    vec3 color = vec3(0.0);

    for (float i = 1.0; i < 6.0; i++) {
        vec2 st0 = st;
        float sgn = 1.0 - 2.0 * mod(i, 2.0);
        float t = u_time * 0.02 - float(i);
        st0 *= mat2(cos(t), sin(t), -sin(t), cos(t));

        float R = length(st0);
        float d = R * i;
        float angle = atan(st0.y, st0.x) * 3.0;

        vec3 pal = palette3(-exp((length(d) * -0.9)), abs(d) * 0.4);

        float radial = exp(-R);
        radial *= smoothstep(1.2, 0.5, R);
        pal *= radial;

        float phase = -(d + sgn * angle) + u_time * 0.3;
        float v = sin(phase);
        v = max(abs(v), 0.02);
        float w = pow(0.02 / v, 0.8);

        color += pal * w;
    }

    float alpha = clamp(max(max(color.r, color.g), color.b), 0.0, 1.0);
    gl_FragColor = vec4(color, alpha);
}
`;
let activeSearchSubmenuTab = 'users';
let cachedUsersDirectory = null;
let cachedUsersDirectoryRaw = null;
let userPresenceChannel = null;
let userPresenceHeartbeatTimer = null;
let userPresenceRefreshTimer = null;
let activeThreadDom = null;
let activeMainSubmenuTab = 'chats';
let selectedWalletSendContact = '';
let walletContactSelectionMode = false;
let walletMainCurrency = 'RUB';
let walletSendCurrency = 'RUB';
let walletBalanceMasked = false;
let walletRecipientLookupToken = 0;
let currentViewedCommunity = null;
let goldBadgeActionMenuEl = null;
let groupCreateSelectedEmails = new Set();
let currentConversationInfoId = null;
let conversationInviteSelectedEmails = new Set();
let conversationAdminDraftSet = new Set();
let groupCreateAvatarDataUrl = '';
let conversationEditAvatarDataUrl = '';
let chatAreaScrollState = {
    top: 0,
    height: 0
};

let notificationPermissionRequested = localStorage.getItem('notificationPermissionRequested') === 'true';
let notificationPermissionAutoPromptBound = false;
let notificationServiceWorkerReadyPromise = null;
let notificationWorkerMessageBound = false;
let pendingNotificationConversationId = null;
let webPushSubscriptionTableAvailable = true;
let webPushSubscriptionMissingWarningShown = false;
let webPushServerIssueWarningShown = false;
let webPushSubscriptionErrorWarningShown = false;
// Shared audio context used to enable audio on mobile after first user interaction
let __sharedAudioContext = null;
let __audioUnlocked = false;

function showWebPushServerIssue(reason = '') {
    if (webPushServerIssueWarningShown) return;
    webPushServerIssueWarningShown = true;

    const extra = reason ? `\n\nТехническая причина: ${reason}` : '';
    alert('Push для закрытого браузера сейчас не работает: серверная функция send-web-push не отвечает или не настроена.\n\nПроверь деплой функции и VAPID secrets в Supabase.' + extra);
}

function getNotificationOnboardingKey() {
    return 'notificationPromptShown_' + normalizeEmail(currentUserEmail || 'guest');
}

function isNotificationSupportedInCurrentContext() {
    if (typeof window === 'undefined' || typeof window.Notification === 'undefined') {
        return { supported: false, reason: 'unsupported' };
    }

    const isLocalhost = location.hostname === 'localhost' || location.hostname === '127.0.0.1';
    if (!window.isSecureContext && !isLocalhost) {
        return { supported: false, reason: 'insecure-context' };
    }

    return { supported: true, reason: 'ok' };
}

function getNotificationUnsupportedMessage(reason) {
    if (reason === 'insecure-context') {
        return 'Уведомления в мобильном браузере работают только на HTTPS-сайте. Откройте сайт по https:// и повторите.';
    }
    return 'Этот браузер не поддерживает системные уведомления для сайта.';
}

function setupNotificationPermissionAutoPrompt() {
    if (notificationPermissionAutoPromptBound) return;
    if (!currentUserEmail) return;

    const settings = getNotificationSettings();
    if (!settings.pushEnabled) return;

    const support = isNotificationSupportedInCurrentContext();
    if (!support.supported) {
        const unsupportedKey = 'notificationUnsupportedShown_' + support.reason;
        if (!localStorage.getItem(unsupportedKey)) {
            localStorage.setItem(unsupportedKey, 'true');
            alert(getNotificationUnsupportedMessage(support.reason));
        }
        return;
    }

    if (Notification.permission !== 'default') return;
    if (localStorage.getItem(getNotificationOnboardingKey()) === 'true') return;

    notificationPermissionAutoPromptBound = true;

    const requestOnGesture = async () => {
        document.removeEventListener('pointerdown', requestOnGesture);
        document.removeEventListener('touchstart', requestOnGesture);
        document.removeEventListener('click', requestOnGesture);
        notificationPermissionAutoPromptBound = false;

        localStorage.setItem(getNotificationOnboardingKey(), 'true');

        const permission = await requestNotificationPermissionIfNeeded(true);
        if (permission !== 'granted') {
            alert('Чтобы получать push-уведомления о новых сообщениях, разрешите уведомления в настройках браузера для этого сайта.');
        }
    };

    document.addEventListener('pointerdown', requestOnGesture, { passive: true, once: true });
    document.addEventListener('touchstart', requestOnGesture, { passive: true, once: true });
    document.addEventListener('click', requestOnGesture, { passive: true, once: true });
}

function getNotificationSettingsKey() {
    return 'margeletNotificationSettings_' + normalizeEmail(currentUserEmail || 'guest');
}

function getNotificationSettings() {
    const defaults = {
        sendSound: true,
        incomingSound: true,
        pushEnabled: true,
        vibrationEnabled: false
    };
    try {
        const raw = JSON.parse(localStorage.getItem(getNotificationSettingsKey()) || '{}');
        return { ...defaults, ...(raw || {}) };
    } catch (_e) {
        return defaults;
    }
}

function saveNotificationSettings(next) {
    localStorage.setItem(getNotificationSettingsKey(), JSON.stringify(next || {}));
}

async function requestNotificationPermissionIfNeeded(force = false) {
    const support = isNotificationSupportedInCurrentContext();
    if (!support.supported) return support.reason;

    const current = Notification.permission;
    if (!force && current !== 'default') return current;

    try {
        const permission = await Notification.requestPermission();
        notificationPermissionRequested = true;
        localStorage.setItem('notificationPermissionRequested', 'true');
        return permission;
    } catch (_error) {
        return Notification.permission || 'default';
    }
}

function consumeNotificationConversationFromUrl() {
    try {
        const url = new URL(window.location.href);
        const conversationId = String(url.searchParams.get('openConversation') || '').trim();
        if (!conversationId) return;

        pendingNotificationConversationId = conversationId;
        url.searchParams.delete('openConversation');
        window.history.replaceState({}, '', url.toString());
    } catch (_error) {
        // ignore URL parsing issues
    }
}

function tryOpenPendingNotificationConversation() {
    const conversationId = String(pendingNotificationConversationId || '').trim();
    if (!conversationId) return;
    if (!currentUserEmail) return;

    const conversation = getConversationById(conversationId);
    if (!conversation) return;

    pendingNotificationConversationId = null;
    activeConversationId = conversationId;
    goToScreen('screen-main');
    scheduleChatAreaUpdate({ skipRemoteRefresh: true });
}

function bindNotificationWorkerMessages() {
    if (notificationWorkerMessageBound) return;
    if (typeof navigator === 'undefined' || !('serviceWorker' in navigator)) return;

    navigator.serviceWorker.addEventListener('message', (event) => {
        const data = event?.data || {};
        if (data?.type !== 'OPEN_CONVERSATION') return;
        const conversationId = String(data?.conversationId || '').trim();
        if (!conversationId) return;
        pendingNotificationConversationId = conversationId;
        tryOpenPendingNotificationConversation();
    });

    notificationWorkerMessageBound = true;
}

async function ensureNotificationServiceWorkerReady() {
    if (typeof navigator === 'undefined' || !('serviceWorker' in navigator)) {
        return null;
    }

    const support = isNotificationSupportedInCurrentContext();
    if (!support.supported) return null;

    if (!notificationServiceWorkerReadyPromise) {
        notificationServiceWorkerReadyPromise = navigator.serviceWorker
            .register('service-worker.js', { scope: './' })
            .then(() => navigator.serviceWorker.ready)
            .catch(() => null);
    }

    bindNotificationWorkerMessages();
    return notificationServiceWorkerReadyPromise;
}

async function showIncomingSystemNotification(title, body, conversationId) {
    const baseOptions = {
        body,
        icon: 'icons/ymusic.png',
        badge: 'icons/ymusic.png',
        tag: 'chat-' + String(conversationId || ''),
        renotify: true,
        data: {
            conversationId: String(conversationId || ''),
            url: String(window.location.origin + window.location.pathname)
        }
    };

    const settings = getNotificationSettings();
    if (settings.vibrationEnabled) {
        baseOptions.vibrate = [120, 50, 120];
    }

    try {
        const registration = await ensureNotificationServiceWorkerReady();
        if (registration && typeof registration.showNotification === 'function') {
            await registration.showNotification(title, baseOptions);
            return;
        }
    } catch (_error) {
        // fallback below
    }

    const notification = new Notification(title, baseOptions);
    notification.onclick = () => {
        try { window.focus(); } catch (_error) {}
        if (conversationId) {
            activeConversationId = conversationId;
        }
        goToScreen('screen-main');
        scheduleChatAreaUpdate({ skipRemoteRefresh: true });
        try { notification.close(); } catch (_error) {}
    };
}

function maybeShowIncomingMessageNotification(conversationId, message) {
    try {
        const notificationSettings = getNotificationSettings();
        if (!notificationSettings.pushEnabled) return;
        if (typeof window === 'undefined' || typeof window.Notification === 'undefined') return;
        if (Notification.permission !== 'granted') return;

        // Если пользователь уже в открытом чате и вкладка активна, уведомление не нужно.
        const isMainActive = Boolean(document.getElementById('screen-main')?.classList.contains('active'));
        const isSameConversation = conversationId && activeConversationId === conversationId;
        if (document.visibilityState === 'visible' && isMainActive && isSameConversation) return;

        const senderName = getDisplayNameByEmail(message?.sender || '') || 'Новое сообщение';
        const bodyText = String(message?.text || '').trim() || 'Новое сообщение';
        void showIncomingSystemNotification(senderName, bodyText, conversationId);
    } catch (_error) {
        // ignore notification errors
    }
}

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
        const notificationSettings = getNotificationSettings();
        if (!notificationSettings.sendSound) return;

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

function isSupabaseCollectionTableMissing(error) {
    if (!error) return false;
    if (error.status === 404) return true;
    const code = String(error.code || '').toUpperCase();
    const message = String(error.message || '').toLowerCase();
    return code === 'PGRST205' || message.includes('collection_items') && message.includes('not found');
}

function isSupabaseWebPushTableMissing(error) {
    if (!error) return false;
    if (error.status === 404) return true;
    const code = String(error.code || '').toUpperCase();
    const message = String(error.message || '').toLowerCase();
    return code === 'PGRST205' || message.includes('web_push_subscriptions') && message.includes('not found');
}

function base64UrlToUint8Array(base64Url) {
    const normalized = String(base64Url || '').trim();
    if (!normalized) return null;

    const padding = '='.repeat((4 - normalized.length % 4) % 4);
    const base64 = (normalized + padding).replace(/-/g, '+').replace(/_/g, '/');
    const raw = atob(base64);
    const output = new Uint8Array(raw.length);
    for (let i = 0; i < raw.length; i++) {
        output[i] = raw.charCodeAt(i);
    }
    return output;
}

async function upsertWebPushSubscription(subscription) {
    if (!subscription || !currentUserEmail) return;
    if (!webPushSubscriptionTableAvailable) return;

    const client = getSupabaseClient();
    if (!client) return;

    try {
        const json = subscription.toJSON ? subscription.toJSON() : {};
        const keys = json.keys || {};
        const endpoint = String(json.endpoint || subscription.endpoint || '');
        if (!endpoint) return;

        const row = {
            owner_email: normalizeEmail(currentUserEmail),
            endpoint,
            p256dh: String(keys.p256dh || ''),
            auth: String(keys.auth || ''),
            user_agent: typeof navigator !== 'undefined' ? String(navigator.userAgent || '').slice(0, 1024) : null,
            updated_at: new Date().toISOString()
        };

        if (!row.p256dh || !row.auth) return;

        const { error } = await client
            .from('web_push_subscriptions')
            .upsert(row, { onConflict: 'endpoint' });

        if (error && isSupabaseWebPushTableMissing(error)) {
            webPushSubscriptionTableAvailable = false;
            if (!webPushSubscriptionMissingWarningShown) {
                alert('Для web push не найдена таблица web_push_subscriptions. Запусти обновленный supabase-schema.sql.');
                webPushSubscriptionMissingWarningShown = true;
            }
        }
    } catch (_error) {
        // ignore sync errors
    }
}

async function removeWebPushSubscriptionByEndpoint(endpoint) {
    if (!endpoint || !currentUserEmail || !webPushSubscriptionTableAvailable) return;

    const client = getSupabaseClient();
    if (!client) return;

    try {
        const { error } = await client
            .from('web_push_subscriptions')
            .delete()
            .eq('owner_email', normalizeEmail(currentUserEmail))
            .eq('endpoint', String(endpoint));

        if (error && isSupabaseWebPushTableMissing(error)) {
            webPushSubscriptionTableAvailable = false;
        }
    } catch (_error) {
        // ignore cleanup errors
    }
}

async function disableWebPushSubscription() {
    try {
        const registration = await ensureNotificationServiceWorkerReady();
        if (!registration || !registration.pushManager) return;

        const existing = await registration.pushManager.getSubscription();
        if (!existing) return;

        const endpoint = existing.endpoint;
        await existing.unsubscribe();
        await removeWebPushSubscriptionByEndpoint(endpoint);
    } catch (_error) {
        // ignore unsubscribe errors
    }
}

async function syncWebPushSubscriptionWithSupabase() {
    if (!currentUserEmail) return;

    const settings = getNotificationSettings();
    if (!settings.pushEnabled) {
        await disableWebPushSubscription();
        return;
    }

    if (typeof window === 'undefined' || typeof window.Notification === 'undefined') return;
    if (Notification.permission !== 'granted') return;

    const vapidPublicKey = typeof window !== 'undefined' ? String(window.WEB_PUSH_PUBLIC_KEY || '').trim() : '';
    if (!vapidPublicKey) return;

    try {
        const registration = await ensureNotificationServiceWorkerReady();
        if (!registration || !registration.pushManager) return;

        let subscription = await registration.pushManager.getSubscription();
        if (!subscription) {
            const applicationServerKey = base64UrlToUint8Array(vapidPublicKey);
            if (!applicationServerKey) return;

            subscription = await registration.pushManager.subscribe({
                userVisibleOnly: true,
                applicationServerKey
            });
        }

        await upsertWebPushSubscription(subscription);
    } catch (error) {
        console.warn('Web Push subscription sync failed:', error);
        if (!webPushSubscriptionErrorWarningShown) {
            webPushSubscriptionErrorWarningShown = true;
            alert('Не удалось активировать web push-подписку. Уведомления могут приходить только при открытом браузере. Проверь HTTPS, разрешение на уведомления и актуальность VAPID ключа.');
        }
    }
}

async function sendWebPushForMessage(conversation, messageRow) {
    if (!conversation || !messageRow || !currentUserEmail) return;
    const client = getSupabaseClient();
    if (!client) return;

    try {
        const { data, error } = await client.functions.invoke('send-web-push', {
            body: {
                messageId: String(messageRow.id || ''),
                conversationId: String(messageRow.conversation_id || ''),
                participants: Array.isArray(conversation.participants) ? conversation.participants : [],
                senderEmail: normalizeEmail(currentUserEmail),
                body: String(messageRow.body || '').slice(0, 600)
            }
        });

        if (error) {
            console.warn('send-web-push invoke error:', error);
            showWebPushServerIssue(String(error.message || error.name || 'invoke-error'));
            return;
        }

        if (data && data.error) {
            console.warn('send-web-push response error:', data.error);
            showWebPushServerIssue(String(data.error));
            return;
        }
    } catch (error) {
        console.warn('send-web-push transport exception:', error);
        showWebPushServerIssue(String(error?.message || error));
    }
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
        glowColor: String(user?.glowColor || ''),
        nicknameGradientEnabled: user?.nicknameGradientEnabled === true,
        nicknameGradientPalette: normalizeNicknameGradientPalette(user?.nicknameGradientPalette || ''),
        avatarParticleAnimation: normalizeAvatarParticleAnimation(user?.avatarParticleAnimation || user?.avatarAnimation || ''),
        avatarAnimationEnabled: user?.avatarAnimationEnabled === true,
        avatarGlowEnabled: user?.avatarGlowEnabled === true,
        glowAnimation: normalizeGlowAnimation(user?.glowAnimation || '')
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

function isSupabaseUsernameUniqueViolation(error) {
    if (!error) return false;
    const code = String(error.code || '');
    const details = String(error.details || '').toLowerCase();
    const message = String(error.message || '').toLowerCase();
    return code === '23505' && (
        details.includes('profiles_username_key') ||
        message.includes('profiles_username_key') ||
        message.includes('username')
    );
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
    const emailVisibility = getEmailVisibilityForUser(currentUserEmail);
    const phoneVisibility = getPrivacyVisibilityForUser('phone', currentUserEmail);
    const avatarVisibility = 'all';
    const statusVisibility = getPrivacyVisibilityForUser('status', currentUserEmail);
    const birthdayVisibility = getPrivacyVisibilityForUser('birthday', currentUserEmail);
    const loginPin = getLoginPinForUser(currentUserEmail);
    const membership = getMembershipState();
    const hasBoost = Boolean(membership.gold);
    const goldBadgeVisible = isGoldBadgeVisible();
    const goldBadgeStyle = getGoldBadgeStyle();
    const avatarParticleAnimation = normalizeAvatarParticleAnimation(localStorage.getItem('avatarParticleAnimation_' + currentUserEmail));
    const avatarAnimationEnabled = getAvatarAnimationEnabled(currentUserEmail);
    const avatarGlowEnabled = getAvatarGlowEnabled(currentUserEmail);
    const glowAnimation = normalizeGlowAnimation(localStorage.getItem('glowAnimation_' + currentUserEmail));
    const nicknameGradientEnabled = getNicknameGradientEnabled(currentUserEmail);
    const nicknameGradientPalette = getNicknameGradientPalette(currentUserEmail);

    const basePayload = {
        email: currentUserEmail,
        display_name: displayName || currentUserEmail.split('@')[0] || 'Пользователь',
        username: username || null,
        phone: phone || null,
        about: about || null,
         birthday: birthdayRaw || null,
        glow_color: glowColor || 'gradient',
        avatar_url: avatarUrl,
        email_visibility: emailVisibility
    };

    let payload = {
        ...basePayload,
        premium_gold: hasBoost,
        gold_badge_visible: Boolean(goldBadgeVisible),
        gold_badge_style: goldBadgeStyle,
        avatar_particle_animation: avatarParticleAnimation,
        avatar_animation_enabled: hasBoost && Boolean(avatarAnimationEnabled),
        avatar_glow_enabled: hasBoost && Boolean(avatarGlowEnabled),
        glow_animation: glowAnimation,
        nickname_gradient_enabled: hasBoost && Boolean(nicknameGradientEnabled),
        nickname_gradient_palette: nicknameGradientPalette,
        phone_visibility: phoneVisibility,
        avatar_visibility: avatarVisibility,
        status_visibility: statusVisibility,
        birthday_visibility: birthdayVisibility,
        login_pin: loginPin || null
    };

    // Используем upsert с правильным синтаксисом
    let { error } = await client
        .from('profiles')
        .upsert([payload], { onConflict: 'email', ignoreDuplicates: false });

    if (error) {
        const details = String(error?.details || '').toLowerCase();
        const message = String(error?.message || '').toLowerCase();
        const missingExtraColumns = details.includes('premium_gold') || details.includes('gold_badge') || details.includes('visibility') || details.includes('login_pin') || details.includes('avatar_particle_animation') || details.includes('avatar_animation_enabled') || details.includes('avatar_glow_enabled') || details.includes('glow_animation') || details.includes('nickname_gradient_enabled') || details.includes('nickname_gradient_palette') || message.includes('premium_gold') || message.includes('gold_badge') || message.includes('visibility') || message.includes('login_pin') || message.includes('avatar_particle_animation') || message.includes('avatar_animation_enabled') || message.includes('avatar_glow_enabled') || message.includes('glow_animation') || message.includes('nickname_gradient_enabled') || message.includes('nickname_gradient_palette');
        if (missingExtraColumns) {
            payload = basePayload;
            const retry = await client
                .from('profiles')
                .upsert([payload], { onConflict: 'email', ignoreDuplicates: false });
            error = retry.error || null;
        }
    }

    if (error && isSupabaseUsernameUniqueViolation(error) && payload.username) {
        const retryPayload = { ...payload, username: null };
        const retryResult = await client
            .from('profiles')
            .upsert([retryPayload], { onConflict: 'email', ignoreDuplicates: false });

        if (!retryResult.error) {
            localStorage.removeItem('userName_' + currentUserEmail);
            const users = getLocalUsersSafe();
            const idx = users.findIndex((user) => normalizeEmail(user.email) === normalizeEmail(currentUserEmail));
            if (idx !== -1 && users[idx]?.username) {
                users[idx] = { ...users[idx], username: '' };
                saveLocalUsersSafe(users);
            }
            error = null;
        } else {
            error = retryResult.error;
        }
    }

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
        let { data, error } = await client
            .from('profiles')
            .select('email, display_name, username, phone, avatar_url, about, birthday, glow_color, avatar_particle_animation, avatar_animation_enabled, avatar_glow_enabled, glow_animation, nickname_gradient_enabled, nickname_gradient_palette, email_visibility, phone_visibility, avatar_visibility, status_visibility, birthday_visibility, login_pin, last_seen_at, premium_gold, gold_badge_visible, gold_badge_style')
            .order('created_at', { ascending: false })
            .limit(1000);

        if (error) {
            const details = String(error?.details || '').toLowerCase();
            const message = String(error?.message || '').toLowerCase();
            const missingExtraColumns = details.includes('premium_gold') || details.includes('gold_badge') || details.includes('visibility') || details.includes('login_pin') || details.includes('avatar_particle_animation') || details.includes('avatar_animation_enabled') || details.includes('avatar_glow_enabled') || details.includes('glow_animation') || details.includes('nickname_gradient_enabled') || details.includes('nickname_gradient_palette') || message.includes('premium_gold') || message.includes('gold_badge') || message.includes('visibility') || message.includes('login_pin') || message.includes('avatar_particle_animation') || message.includes('avatar_animation_enabled') || message.includes('avatar_glow_enabled') || message.includes('glow_animation') || message.includes('nickname_gradient_enabled') || message.includes('nickname_gradient_palette');
            if (missingExtraColumns) {
                const retry = await client
                    .from('profiles')
                    .select('email, display_name, username, phone, avatar_url, about, birthday, glow_color, email_visibility, last_seen_at')
                    .order('created_at', { ascending: false })
                    .limit(1000);
                data = retry.data;
                error = retry.error;
            }
        }

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
                nicknameGradientEnabled: profile.nickname_gradient_enabled === true || Boolean(profile.nickname_gradient_enabled ?? existing.nicknameGradientEnabled ?? false),
                nicknameGradientPalette: normalizeNicknameGradientPalette(profile.nickname_gradient_palette || existing.nicknameGradientPalette || ''),
                avatarParticleAnimation: normalizeAvatarParticleAnimation(profile.avatar_particle_animation || existing.avatarParticleAnimation || existing.avatarAnimation || ''),
                avatarAnimationEnabled: profile.avatar_animation_enabled === false ? false : Boolean(profile.avatar_animation_enabled ?? existing.avatarAnimationEnabled ?? true),
                avatarGlowEnabled: profile.avatar_glow_enabled === false ? false : Boolean(profile.avatar_glow_enabled ?? existing.avatarGlowEnabled ?? true),
                glowAnimation: normalizeGlowAnimation(profile.glow_animation || existing.glowAnimation || ''),
                emailVisibility: (profile.email_visibility || existing.emailVisibility || 'contacts'),
                phoneVisibility: normalizePrivacyVisibilityValue(profile.phone_visibility || existing.phoneVisibility, 'all'),
                avatarVisibility: normalizePrivacyVisibilityValue(profile.avatar_visibility || existing.avatarVisibility, 'all'),
                statusVisibility: normalizePrivacyVisibilityValue(profile.status_visibility || existing.statusVisibility, 'all'),
                birthdayVisibility: normalizePrivacyVisibilityValue(profile.birthday_visibility || existing.birthdayVisibility, 'all'),
                loginPin: String(profile.login_pin || existing.loginPin || ''),
                hasGold: Boolean(profile.premium_gold ?? existing.hasGold),
                goldBadgeVisible: profile.gold_badge_visible === false ? false : Boolean(profile.gold_badge_visible ?? existing.goldBadgeVisible ?? true),
                goldBadgeStyle: String(profile.gold_badge_style || existing.goldBadgeStyle || 'aurora'),
                lastSeenAt: profile.last_seen_at ? new Date(profile.last_seen_at).getTime() : (existing.lastSeenAt || 0)
            });

            if (email === currentUserEmail) {
                if (profile.display_name) localStorage.setItem('userDisplayName_' + email, profile.display_name);
                if (profile.username) localStorage.setItem('userName_' + email, normalizeUsername(profile.username));
                if (profile.phone) localStorage.setItem('userPhone_' + email, profile.phone);
                if (profile.about) localStorage.setItem('userStatus_' + email, profile.about);
                if (profile.birthday) localStorage.setItem('userBirthday_' + email, profile.birthday);
                if (profile.glow_color) localStorage.setItem('glowColor_' + email, profile.glow_color);
                if (typeof profile.nickname_gradient_enabled !== 'undefined') localStorage.setItem(getNicknameGradientKey(email), profile.nickname_gradient_enabled ? '1' : '0');
                if (profile.nickname_gradient_palette) localStorage.setItem(getNicknameGradientPaletteKey(email), normalizeNicknameGradientPalette(profile.nickname_gradient_palette));
                if (profile.avatar_url) localStorage.setItem('userAvatar_' + email, profile.avatar_url);
                if (profile.email_visibility) localStorage.setItem(getEmailVisibilityKey(email), String(profile.email_visibility));
                if (profile.phone_visibility) localStorage.setItem(getPrivacyVisibilityKey('phone', email), normalizePrivacyVisibilityValue(profile.phone_visibility, 'all'));
                if (profile.avatar_visibility) localStorage.setItem(getPrivacyVisibilityKey('avatar', email), normalizePrivacyVisibilityValue(profile.avatar_visibility, 'all'));
                if (profile.status_visibility) localStorage.setItem(getPrivacyVisibilityKey('status', email), normalizePrivacyVisibilityValue(profile.status_visibility, 'all'));
                if (profile.birthday_visibility) localStorage.setItem(getPrivacyVisibilityKey('birthday', email), normalizePrivacyVisibilityValue(profile.birthday_visibility, 'all'));
                if (profile.login_pin) localStorage.setItem(getLoginPinKey(email), String(profile.login_pin));
                if (typeof profile.premium_gold !== 'undefined') {
                    const nextMembership = getMembershipState();
                    nextMembership.gold = Boolean(profile.premium_gold);
                    saveMembershipState(nextMembership);
                }
                if (typeof profile.gold_badge_visible !== 'undefined') {
                    setGoldBadgeVisible(Boolean(profile.gold_badge_visible));
                }
                if (profile.gold_badge_style) {
                    setGoldBadgeStyle(String(profile.gold_badge_style));
                }
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
    updateUnreadUiIndicators();
}

function updateUnreadUiIndicators() {
    const unreadMap = getUnreadConversationMap();
    const unreadCount = Object.keys(unreadMap).length;
    const chatsNav = document.querySelector('.bottom-nav-glass .nav-item[data-screen="screen-main"]');
    if (!chatsNav) return;

    let badge = chatsNav.querySelector('.nav-unread-badge');
    if (unreadCount <= 0) {
        if (badge) badge.remove();
        return;
    }

    if (!badge) {
        badge = document.createElement('span');
        badge.className = 'nav-unread-badge';
        chatsNav.appendChild(badge);
    }

    badge.textContent = '';
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

function syncMainSubmenuVisualState() {
    const mainInner = document.querySelector('#screen-main .chat-submenu-inner');
    if (!mainInner) return;

    const targetTab = activeMainSubmenuTab || 'chats';
    const buttons = Array.from(mainInner.querySelectorAll('.submenu-btn[data-tab]'));
    const targetBtn = mainInner.querySelector('.submenu-btn[data-tab="' + targetTab + '"]') || buttons[0];
    if (!targetBtn) return;

    buttons.forEach(btn => btn.classList.toggle('active', btn === targetBtn));

    const refresh = mainInner.__refreshSubmenuIndicator;
    if (typeof refresh === 'function') {
        refresh();
        setTimeout(refresh, 90);
        setTimeout(refresh, 220);
        setTimeout(refresh, 420);
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

function removeUserFromContacts(email) {
    const normalized = normalizeEmail(email);
    if (!normalized || !currentUserEmail) return false;
    const contacts = getCurrentUserContacts();
    if (!contacts.includes(normalized)) return false;
    setCurrentUserContacts(contacts.filter((item) => item !== normalized));
    return true;
}

function normalizePrivacyVisibilityValue(value, fallback = 'contacts') {
    const normalized = String(value || '').trim().toLowerCase();
    if (normalized === 'all' || normalized === 'contacts' || normalized === 'nobody') return normalized;
    return fallback;
}

function getPrivacyVisibilityKey(field = 'email', email = currentUserEmail) {
    return `privacyVisibility_${String(field || 'email').toLowerCase()}_${normalizeEmail(email || 'guest')}`;
}

function getPrivacyVisibilityForUser(field = 'email', email = currentUserEmail) {
    const normalizedField = String(field || 'email').toLowerCase();
    const normalizedEmail = normalizeEmail(email || '');
    if (!normalizedEmail) return normalizedField === 'email' ? 'contacts' : 'all';

    const fallback = normalizedField === 'email' ? 'contacts' : 'all';
    const localValue = normalizePrivacyVisibilityValue(localStorage.getItem(getPrivacyVisibilityKey(normalizedField, normalizedEmail)), '');
    if (localValue) return localValue;

    const user = getUserRecordByEmail(normalizedEmail);
    const legacyEmailValue = normalizePrivacyVisibilityValue(user?.emailVisibility, '');
    const mapFromRecord = {
        email: user?.emailVisibility,
        phone: user?.phoneVisibility,
        avatar: user?.avatarVisibility,
        status: user?.statusVisibility,
        birthday: user?.birthdayVisibility
    };
    const recordValue = normalizePrivacyVisibilityValue(mapFromRecord[normalizedField], '');
    if (recordValue) return recordValue;
    if (normalizedField === 'email' && legacyEmailValue) return legacyEmailValue;

    return fallback;
}

function getEmailVisibilityKey(email = currentUserEmail) {
    return getPrivacyVisibilityKey('email', email);
}

function getEmailVisibilityForUser(email) {
    return getPrivacyVisibilityForUser('email', email);
}

function canCurrentUserSeeProfileField(targetEmail, field = 'email') {
    const normalizedTarget = normalizeEmail(targetEmail);
    const normalizedCurrent = normalizeEmail(currentUserEmail || '');
    if (!normalizedTarget || !normalizedCurrent) return false;
    if (normalizedTarget === normalizedCurrent) return true;

    // Avatars and avatar glow are always visible to everyone.
    if (String(field || '').toLowerCase() === 'avatar') return true;

    const visibilityMode = getPrivacyVisibilityForUser(field, normalizedTarget);
    if (visibilityMode === 'all') return true;
    if (visibilityMode === 'nobody') return false;

    // Контакты: если пользователь есть в контактах с любой стороны.
    if (isUserInContacts(normalizedTarget)) return true;

    const targetContactsRaw = JSON.parse(localStorage.getItem('margeletContacts_' + normalizedTarget) || '[]');
    if (!Array.isArray(targetContactsRaw)) return false;
    const targetContacts = targetContactsRaw.map((item) => normalizeEmail(item)).filter(Boolean);
    return targetContacts.includes(normalizedCurrent);
}

function canCurrentUserSeeEmailOf(targetEmail) {
    return canCurrentUserSeeProfileField(targetEmail, 'email');
}

function getStoriesStorageKey() {
    return 'margeletStories_v1';
}

function getCollectionStorageKey(email = currentUserEmail) {
    return 'margeletCollection_v1_' + normalizeEmail(email || 'guest');
}

function sanitizeCollectionItems(items) {
    const allowed = new Set(Object.keys(getCollectionTypeConfig()));
    const list = Array.isArray(items) ? items : [];
    return list.filter((item) => {
        const type = String(item && item.type ? item.type : '').trim();
        return allowed.has(type);
    });
}

function getCollectionItemsByEmail(email) {
    try {
        const raw = JSON.parse(localStorage.getItem(getCollectionStorageKey(email)) || '[]');
        return sanitizeCollectionItems(raw);
    } catch (_error) {
        return [];
    }
}

function writeCollectionItemsLocal(email, items) {
    localStorage.setItem(getCollectionStorageKey(email), JSON.stringify(sanitizeCollectionItems(items)));
}

function saveCollectionItemsByEmail(email, items) {
    writeCollectionItemsLocal(email, items);
    void pushCollectionItemsToSupabase(email, items);
}

function mapCollectionItemToSupabaseRow(ownerEmail, item) {
    const safeItem = item && typeof item === 'object' ? item : {};
    return {
        id: String(safeItem.id || `collect_${Date.now()}_${Math.floor(Math.random() * 9999)}`),
        owner_email: normalizeEmail(ownerEmail),
        type: String(safeItem.type || 'starry-cube'),
        type_label: String(safeItem.typeLabel || ''),
        name: String(safeItem.name || ''),
        rarity: String(safeItem.rarity || 'common'),
        rarity_label: String(safeItem.rarityLabel || ''),
        value_rub: Number(safeItem.value || 3449),
        series: String(safeItem.series || ''),
        serial: String(safeItem.serial || ''),
        created_at: safeItem.createdAt || new Date().toISOString()
    };
}

function mapSupabaseRowToCollectionItem(row) {
    const safeRow = row && typeof row === 'object' ? row : {};
    return {
        id: String(safeRow.id || `collect_${Date.now()}_${Math.floor(Math.random() * 9999)}`),
        type: String(safeRow.type || 'starry-cube'),
        typeLabel: String(safeRow.type_label || ''),
        name: String(safeRow.name || ''),
        rarity: String(safeRow.rarity || 'common'),
        rarityLabel: String(safeRow.rarity_label || ''),
        value: Number(safeRow.value_rub || 3449),
        series: String(safeRow.series || ''),
        serial: String(safeRow.serial || ''),
        createdAt: safeRow.created_at || new Date().toISOString()
    };
}

async function pushCollectionItemsToSupabase(email, items) {
    if (!supabaseCollectionTableAvailable) return false;
    const client = getSupabaseClient();
    const owner = normalizeEmail(email || '');
    if (!client || !owner) return false;

    const rows = sanitizeCollectionItems(items).map((item) => mapCollectionItemToSupabaseRow(owner, item));

    const deleteResult = await client
        .from('collection_items')
        .delete()
        .eq('owner_email', owner);

    if (deleteResult.error) {
        if (isSupabaseCollectionTableMissing(deleteResult.error)) {
            supabaseCollectionTableAvailable = false;
            if (!supabaseCollectionMissingWarningShown) {
                supabaseCollectionMissingWarningShown = true;
                console.warn('Supabase table public.collection_items not found. Run supabase schema migration.');
            }
            return false;
        }
        return false;
    }

    if (!rows.length) return true;

    const insertResult = await client
        .from('collection_items')
        .insert(rows);

    if (insertResult.error) {
        if (isSupabaseCollectionTableMissing(insertResult.error)) {
            supabaseCollectionTableAvailable = false;
            if (!supabaseCollectionMissingWarningShown) {
                supabaseCollectionMissingWarningShown = true;
                console.warn('Supabase table public.collection_items not found. Run supabase schema migration.');
            }
        }
        return false;
    }

    return true;
}

async function pullCollectionItemsFromSupabase(email) {
    if (!supabaseCollectionTableAvailable) return null;
    const client = getSupabaseClient();
    const owner = normalizeEmail(email || '');
    if (!client || !owner) return null;

    const { data, error } = await client
        .from('collection_items')
        .select('id, owner_email, type, type_label, name, rarity, rarity_label, value_rub, series, serial, created_at')
        .eq('owner_email', owner)
        .order('created_at', { ascending: false })
        .limit(120);

    if (error) {
        if (isSupabaseCollectionTableMissing(error)) {
            supabaseCollectionTableAvailable = false;
            if (!supabaseCollectionMissingWarningShown) {
                supabaseCollectionMissingWarningShown = true;
                console.warn('Supabase table public.collection_items not found. Run supabase schema migration.');
            }
        }
        return null;
    }

    const mapped = Array.isArray(data) ? data.map(mapSupabaseRowToCollectionItem) : [];
    return sanitizeCollectionItems(mapped);
}

function scheduleCollectionPullSync(email, listId, canMint) {
    if (!isSupabaseEnabled() || !supabaseCollectionTableAvailable) return;
    const now = Date.now();
    if (supabaseCollectionSyncInFlight) return;
    if (now - supabaseCollectionLastSyncAt < 4000) return;

    supabaseCollectionSyncInFlight = true;
    supabaseCollectionLastSyncAt = now;

    void (async () => {
        try {
            const remoteItems = await pullCollectionItemsFromSupabase(email);
            if (!remoteItems) return;
            const localItems = getCollectionItemsByEmail(email);
            const localSig = JSON.stringify(localItems);
            const remoteSig = JSON.stringify(remoteItems);
            if (localSig !== remoteSig) {
                writeCollectionItemsLocal(email, remoteItems);
                renderCollectionListForUser(email, listId, canMint);
            }
        } finally {
            supabaseCollectionSyncInFlight = false;
        }
    })();
}

function getCollectionRarityConfig() {
    return [
        { key: 'common', label: getCurrentLanguage() === 'en' ? 'Common' : 'Обычный', chance: 55, min: 30, max: 120 },
        { key: 'rare', label: getCurrentLanguage() === 'en' ? 'Rare' : 'Редкий', chance: 27, min: 130, max: 450 },
        { key: 'epic', label: getCurrentLanguage() === 'en' ? 'Epic' : 'Эпический', chance: 12, min: 500, max: 1700 },
        { key: 'legendary', label: getCurrentLanguage() === 'en' ? 'Legendary' : 'Легендарный', chance: 5, min: 1800, max: 5500 },
        { key: 'mythic', label: getCurrentLanguage() === 'en' ? 'Mythic' : 'Мифический', chance: 1, min: 7000, max: 25000 }
    ];
}

function rollCollectionRarity() {
    const config = getCollectionRarityConfig();
    const roll = Math.random() * 100;
    let sum = 0;
    for (let i = 0; i < config.length; i++) {
        sum += config[i].chance;
        if (roll <= sum) return config[i];
    }
    return config[0];
}

function getCollectionTypeConfig() {
    const isEn = getCurrentLanguage() === 'en';
    return {
        'starry-cube': {
            label: isEn ? 'Astral Cube' : 'Астральный куб',
            value: 3449,
            names: isEn
                ? ['Astral Cube']
                : ['Астральный куб']
        }
    };
}

function mintCollectionShard(email = currentUserEmail) {
    return mintCollectionItem('starry-cube', email);
}

function mintCollectionItem(itemType = 'shard-3d', email = currentUserEmail) {
    const owner = normalizeEmail(email || '');
    if (!owner) return null;

    const rarity = rollCollectionRarity();
    const itemId = `collect_${Date.now()}_${Math.floor(Math.random() * 9999)}`;
    const config = getCollectionTypeConfig();
    const selectedType = resolveMintType(itemType);
    const typeConfig = config[selectedType] || config['starry-cube'];
    const names = Array.isArray(typeConfig.names) && typeConfig.names.length ? typeConfig.names : [typeConfig.label];

    return {
        id: itemId,
        type: selectedType,
        typeLabel: typeConfig.label,
        name: names[Math.floor(Math.random() * names.length)],
        rarity: rarity.key,
        rarityLabel: rarity.label,
        value: Number(typeConfig.value || 3449),
        series: `MX-${new Date().getFullYear()}-${Math.floor(Math.random() * 90) + 10}`,
        serial: `${Math.floor(Math.random() * 9000) + 1000}`,
        createdAt: new Date().toISOString()
    };
}

function ensureCollectionDetailModal() {
    if (document.getElementById('collection-item-modal')) return;
    const modal = document.createElement('div');
    modal.id = 'collection-item-modal';
    modal.className = 'collection-item-modal';
    modal.innerHTML = `
        <div class="collection-item-modal-card" role="dialog" aria-modal="true" aria-label="Collection item details">
            <button type="button" class="collection-item-modal-close" id="collection-item-modal-close" aria-label="Закрыть">×</button>
            <div class="collection-item-modal-shard-wrap">
                <div class="collection-item-3d large type-shard-3d" id="collection-item-modal-3d" aria-hidden="true"></div>
            </div>
            <div class="collection-item-modal-title" id="collection-item-modal-title"></div>
            <div class="collection-item-modal-grid">
                <div class="collection-item-modal-row"><span>Тип</span><strong id="collection-item-modal-type"></strong></div>
                <div class="collection-item-modal-row"><span>Редкость</span><strong id="collection-item-modal-rarity"></strong></div>
                <div class="collection-item-modal-row"><span>Стоимость</span><strong id="collection-item-modal-value"></strong></div>
            </div>
        </div>
    `;
    document.body.appendChild(modal);

    const close = document.getElementById('collection-item-modal-close');
    if (close) {
        close.addEventListener('click', () => modal.classList.remove('active'));
    }
    modal.addEventListener('click', (event) => {
        if (event.target === modal) modal.classList.remove('active');
    });

    bindCollection3dInteractions(modal);
}

function deleteCollectionItemById(ownerEmail, itemId) {
    const normalizedEmail = normalizeEmail(ownerEmail || '');
    if (!normalizedEmail || !itemId) return false;

    const items = getCollectionItemsByEmail(normalizedEmail);
    const nextItems = items.filter((entry) => String(entry && entry.id ? entry.id : '') !== String(itemId));
    if (nextItems.length === items.length) return false;
    saveCollectionItemsByEmail(normalizedEmail, nextItems);
    return true;
}

function buildCollectionShardObjectMarkup(isDetailed = false) {
    let pentagons = '';
    const triangleCount = isDetailed ? 5 : 3;
    const pentagonCount = 12;
    const triangles = '<div class="collection-star-triangle"></div>'.repeat(triangleCount);
    for (let i = 0; i < pentagonCount; i++) {
        const typeClass = i < 10 ? 'side' : 'lid';
        pentagons += `<div class="collection-star-pentagon ${typeClass}">${triangles}</div>`;
    }

    return `
        <div class="collection-star-object ${isDetailed ? 'is-detailed' : 'is-lite'}">
            <div class="collection-star-scene">
                <div class="collection-star-pivot">
                    <div class="collection-starhedron">${pentagons}</div>
                </div>
            </div>
        </div>
    `;
}

function buildCollectionStarryCubeMarkup() {
    return `
        <div class="collection-cube-object" aria-hidden="true">
            <svg class="collection-cube-svg" viewBox="0 0 512 512" fill="none" overflow="hidden" xmlns="http://www.w3.org/2000/svg">
                <use href="#cube" x="128" y="128" stroke-width="2">
                    <animate attributeName="stroke" dur="6s" repeatCount="indefinite"
                        values="#FF9AA2;#FFB7B2;#FFDAC1;#E2F0CB;#B5EAD7;#C7CEEA;#FF9AA2"/>
                </use>

                <defs>
                    <g id="cube">
                        <use href="#cube_outline" stroke-linejoin="round" stroke-width="16" fill="url(#stars)"/>
                        <use href="#cube_base" stroke-width=".5"/>
                        <use href="#cube_outline" stroke-linejoin="round" stroke-width="6" stroke="#141417"/>
                    </g>

                    <g id="cube_outline">
                        <path>
                            <animate attributeName="d" dur="1.5s" repeatCount="indefinite" calcMode="spline"
                                keyTimes="0;0.5;0.5;1"
                                keySplines="0.8 0.2 0.6 0.9;0.8 0.2 0.6 0.9;0.8 0.2 0.6 0.9"
                                values="M10 64 L128 0 L246 64 L246 192 L128 256 L10 192Z;M40 20 L216 20 L216 108 L216 236 L40 236 L40 172Z;M216 20 L40 20 L40 108 L40 236 L216 236 L216 172Z;M246 64 L128 0 L10 64 L10 192 L128 256 L246 192Z"/>
                        </path>
                    </g>

                    <g id="cube_base">
                        <path fill="#fff1">
                            <animate attributeName="d" dur="1.5s" repeatCount="indefinite" calcMode="spline"
                                keyTimes="0;0.5;1"
                                keySplines="0.8 0.2 0.6 0.9;0.8 0.2 0.6 0.9"
                                values="M10 64 L128 0 L246 64 L128 128Z;M40 20 L216 20 L216 108 L40 108Z;M128 0 L246 64 L128 128 L10 64Z"/>
                        </path>

                        <path>
                            <animate attributeName="d" dur="1.5s" repeatCount="indefinite" calcMode="spline"
                                keyTimes="0;0.5;0.5;1"
                                keySplines="0.8 0.2 0.6 0.9;0.8 0.2 0.6 0.9;0.8 0.2 0.6 0.9"
                                values="M10 64 L128 128 L128 256 L10 192Z;M40 20 L40 108 L40 236 L40 172Z;M216 20 L216 108 L216 236 L216 172Z;M246 64 L128 128 L128 256 L246 192Z"/>
                            <animate attributeName="fill" dur="1.5s" repeatCount="indefinite" keyTimes="0;0.5;0.5;1"
                                values="#fff0;#fff0;#fff2;#fff2"/>
                        </path>

                        <path fill="#407080">
                            <animate attributeName="d" dur="1.5s" repeatCount="indefinite" calcMode="spline"
                                keyTimes="0;0.5;1"
                                keySplines="0.8 0.2 0.6 0.9;0.8 0.2 0.6 0.9"
                                values="M246 64 L128 128 L128 256 L246 192Z;M216 108 L40 108 L40 236 L216 236Z;M128 128 L10 64 L10 192 L128 256Z"/>
                            <animate attributeName="fill" dur="1.5s" repeatCount="indefinite" keyTimes="0;0.5;1"
                                values="#fff2;#fff1;#fff0"/>
                        </path>
                    </g>

                    <linearGradient id="sky" gradientTransform="rotate(90)">
                        <stop offset="0.5" stop-color="#141417"/>
                        <stop offset="1" stop-color="#40354a"/>
                    </linearGradient>

                    <pattern id="stars" x="0" y="0" width="50%" height="50%" patternUnits="userSpaceOnUse" patternContentUnits="userSpaceOnUse">
                        <rect width="256" height="256" fill="url(#sky)"/>
                        <use href="#star01" x="24" y="32" fill="white"/>
                        <use href="#star01" x="64" y="96" fill="#ad9dcb" transform="rotate(90 80 112)"/>
                        <use href="#star01" x="224" y="102" fill="#ad9dcb"/>
                        <use href="#star01" x="192" y="112" fill="#E0E8EA" transform="rotate(90 80 112)"/>
                        <use href="#star02" x="16" y="64" fill="#ad9dcb"/>
                        <use href="#star03" x="96" y="16" fill="#E0E8EA"/>
                        <use href="#star04" x="64" y="64" fill="white"/>
                        <use href="#star04" x="8" y="16" fill="#ad9dcb"/>
                        <use href="#star04" x="110" y="96" fill="#E0E8EA"/>
                        <use href="#star02" x="160" y="24" fill="#ad9dcb"/>
                        <use href="#star03" x="196" y="60" fill="#E0E8EA"/>
                        <use href="#star04" x="64" y="212" fill="white"/>
                        <use href="#star04" x="218" y="216" fill="#ad9dcb"/>
                        <use href="#star03" x="228" y="220" fill="#E0E8EA"/>
                        <use href="#star02" x="140" y="128" fill="#ad9dcb"/>
                        <use href="#star03" x="24" y="140" fill="#E0E8EA"/>
                        <use href="#star04" x="95" y="160" fill="white"/>
                        <use href="#star04" x="180" y="128" fill="#ad9dcb"/>
                        <use href="#star03" x="200" y="136" fill="#E0E8EA"/>
                        <use href="#star10" x="120" y="120" stroke="#E0E8EA"/>
                        <use href="#star11" x="48" y="64" stroke="#ad9dcb"/>
                    </pattern>

                    <path id="star01" transform="scale(0.5)">
                        <animate attributeName="d" dur="3s" repeatCount="indefinite" calcMode="spline"
                            keyTimes="0;0.5;1" keySplines="0.8 0.2 0.6 0.9;0.8 0.2 0.6 0.9"
                            values="M16 0 Q16 16 24 16 Q16 16 16 32 Q16 16 8 16 Q16 16 16 0Z;M16 8 Q16 16 32 16 Q16 16 16 24 Q16 16 0 16 Q16 16 16 8Z;M16 0 Q16 16 24 16 Q16 16 16 32 Q16 16 8 16 Q16 16 16 0Z"/>
                    </path>

                    <circle id="star02">
                        <animate attributeName="r" dur="3s" repeatCount="indefinite" calcMode="spline"
                            keyTimes="0;0.5;1" keySplines="0.8 0.2 0.6 0.9;0.8 0.2 0.6 0.9"
                            values="0;2;0"/>
                    </circle>

                    <circle id="star03">
                        <animate attributeName="r" dur="6s" repeatCount="indefinite" calcMode="spline"
                            keyTimes="0;0.5;1" keySplines="0.8 0.2 0.6 0.9;0.8 0.2 0.6 0.9"
                            values="3;1;3"/>
                    </circle>

                    <circle id="star04" r="1"/>

                    <path id="star10" stroke-width="2">
                        <animate attributeName="d" dur="5s" repeatCount="indefinite"
                            keyTimes="0;0.90;0.97;1"
                            keySplines="0 0.4 1 0.2;0 0.4 1 0.2;0 0.4 1 0.2"
                            values="M64 0 L64 0Z;M64 0 L64 0Z;M48 12 L0 48Z;M0 48 L0 48Z"/>
                        <animate attributeName="opacity" dur="5s" repeatCount="indefinite"
                            keyTimes="0;0.90;0.97;1"
                            values="1;1;0.6;0"/>
                    </path>

                    <path id="star11" stroke-width="3">
                        <animate attributeName="d" dur="6s" repeatCount="indefinite" delay="3s"
                            keyTimes="0;0.90;0.95;1"
                            keySplines="0 0.4 1 0.2;0 0.4 1 0.2;0 0.4 1 0.2"
                            values="M64 0 L64 0Z;M64 0 L64 0Z;M48 12 L0 48Z;M0 48 L0 48Z"/>
                        <animate attributeName="opacity" dur="6s" repeatCount="indefinite" delay="3s"
                            keyTimes="0;0.90;0.95;1"
                            values="1;1;0.6;0"/>
                    </path>
                </defs>
            </svg>
        </div>
    `;
}

function getCollectionObjectMarkup(item, isDetailed = false) {
    const itemType = String((item && item.type) || 'shard-3d');
    if (itemType === 'starry-cube') return buildCollectionStarryCubeMarkup();
    return buildCollectionShardObjectMarkup(isDetailed);
}

function resolveMintType(requestedType) {
    const normalized = String(requestedType || '').trim();
    const config = getCollectionTypeConfig();
    return config[normalized] ? normalized : 'starry-cube';
}

function getCollectionPriceLabel(rubValue, isEn) {
    const valueRub = Number(rubValue || 0);
    if (isEn) {
        const usdRate = 92.4;
        const usdValue = valueRub / usdRate;
        return `$${usdValue.toFixed(2)}`;
    }
    return `${valueRub.toLocaleString('ru-RU')} руб`;
}

function getShardVisualProfile(item) {
    const source = String((item && item.id) || (item && item.serial) || (item && item.name) || 'shard');
    let hash = 0;
    for (let i = 0; i < source.length; i++) {
        hash = (hash * 31 + source.charCodeAt(i)) >>> 0;
    }

    const shapes = [
        {
            path: 'polygon(48% 0%, 63% 6%, 79% 18%, 92% 34%, 98% 52%, 90% 71%, 76% 90%, 57% 100%, 34% 94%, 17% 82%, 6% 63%, 2% 41%, 10% 21%, 28% 8%)',
            inner: 'polygon(49% 4%, 61% 10%, 74% 21%, 85% 35%, 90% 51%, 84% 68%, 72% 85%, 56% 93%, 37% 88%, 23% 78%, 14% 61%, 11% 42%, 17% 25%, 31% 13%)'
        },
        {
            path: 'polygon(52% 0%, 69% 5%, 86% 20%, 97% 39%, 95% 60%, 82% 83%, 63% 98%, 39% 100%, 20% 88%, 8% 68%, 4% 45%, 12% 25%, 30% 10%)',
            inner: 'polygon(52% 4%, 66% 10%, 80% 23%, 89% 40%, 87% 58%, 76% 78%, 61% 91%, 41% 93%, 25% 83%, 15% 66%, 12% 46%, 18% 29%, 33% 15%)'
        },
        {
            path: 'polygon(45% 0%, 61% 7%, 77% 19%, 91% 37%, 100% 56%, 93% 74%, 79% 90%, 58% 100%, 36% 96%, 18% 84%, 6% 64%, 0% 40%, 9% 18%, 27% 6%)',
            inner: 'polygon(46% 4%, 59% 11%, 72% 22%, 84% 38%, 91% 55%, 85% 71%, 74% 85%, 57% 92%, 39% 89%, 24% 79%, 14% 62%, 10% 42%, 17% 24%, 31% 13%)'
        },
        {
            path: 'polygon(50% 0%, 66% 6%, 82% 17%, 95% 33%, 99% 54%, 89% 75%, 73% 92%, 54% 100%, 30% 97%, 14% 86%, 3% 66%, 1% 43%, 11% 22%, 31% 8%)',
            inner: 'polygon(50% 4%, 63% 10%, 76% 20%, 87% 34%, 91% 53%, 83% 71%, 70% 85%, 54% 92%, 34% 90%, 21% 81%, 12% 64%, 10% 45%, 18% 27%, 33% 14%)'
        }
    ];

    const shape = shapes[hash % shapes.length];
    const hue = (hash % 34) - 17;
    const rot = ((hash >>> 5) % 20) - 10;
    const grain = 8 + ((hash >>> 9) % 7);

    return {
        path: shape.path,
        inner: shape.inner,
        hue,
        rot,
        grain
    };
}

function bindCollection3dInteractions(root) {
    if (!root) return;

    const cards = root.querySelectorAll('.collection-item-card');
    cards.forEach((card) => {
        if (card.dataset.rotBound === '1') return;
        card.dataset.rotBound = '1';

        const object = card.querySelector('.collection-item-3d');
        if (!object) return;

        const updateTilt = (clientX, clientY) => {
            const rect = object.getBoundingClientRect();
            const px = (clientX - rect.left) / rect.width;
            const py = (clientY - rect.top) / rect.height;
            const ry = (px - 0.5) * 24;
            const rx = (0.5 - py) * 20;
            object.style.setProperty('--rx', `${rx.toFixed(2)}deg`);
            object.style.setProperty('--ry', `${ry.toFixed(2)}deg`);
        };

        const resetTilt = () => {
            object.style.setProperty('--rx', '0deg');
            object.style.setProperty('--ry', '0deg');
        };

        card.addEventListener('mousemove', (event) => updateTilt(event.clientX, event.clientY));
        card.addEventListener('mouseleave', resetTilt);
    });
}

function openCollectionItemDetails(item, options = {}) {
    ensureCollectionDetailModal();
    const modal = document.getElementById('collection-item-modal');
    if (!modal || !item) return;

    const isEn = getCurrentLanguage() === 'en';
    const price = getCollectionPriceLabel(item.value || 3449, isEn);
    const config = getCollectionTypeConfig();
    const normalizedType = resolveMintType(item.type || 'starry-cube');
    const itemLabel = (config[normalizedType] && config[normalizedType].label) || (isEn ? 'Astral Cube' : 'Астральный куб');

    const setText = (id, value) => {
        const node = document.getElementById(id);
        if (node) node.textContent = String(value || '');
    };

    setText('collection-item-modal-title', itemLabel);
    setText('collection-item-modal-type', itemLabel);
    setText('collection-item-modal-rarity', item.rarityLabel || item.rarity || '');
    setText('collection-item-modal-value', price);

    const modal3d = document.getElementById('collection-item-modal-3d');
    if (modal3d) {
        modal3d.className = `collection-item-3d large type-${normalizedType}`;
        modal3d.innerHTML = getCollectionObjectMarkup({ ...item, type: normalizedType }, true);
        const profile = getShardVisualProfile(item);
        modal3d.style.setProperty('--shard-path', profile.path);
        modal3d.style.setProperty('--shard-inner-path', profile.inner);
        modal3d.style.setProperty('--shard-hue', `${profile.hue}deg`);
        modal3d.style.setProperty('--shard-rot-z', `${profile.rot}deg`);
        modal3d.style.setProperty('--shard-grain', `${profile.grain}px`);
    }

    modal.classList.add('active');
}

function renderCollectionListForUser(email, listId, canMint = false) {
    const list = document.getElementById(listId);
    if (!list) return;

    const normalizedEmail = normalizeEmail(email || '');
    if (!normalizedEmail) return;
    scheduleCollectionPullSync(normalizedEmail, listId, canMint);

    let items = [];
    try {
        items = getCollectionItemsByEmail(normalizedEmail)
            .sort((a, b) => Number(new Date((b && b.createdAt) || 0)) - Number(new Date((a && a.createdAt) || 0)));

        const cleaned = sanitizeCollectionItems(items);
        if (cleaned.length !== items.length) {
            items = cleaned;
            saveCollectionItemsByEmail(normalizedEmail, cleaned.slice(0, 120));
        }
    } catch (_error) {
        items = [];
    }

    if (!items.length) {
        list.innerHTML = `<div class="collection-empty">${getCurrentLanguage() === 'en' ? 'Collection is empty' : 'Коллекция пуста'}</div>`;
    } else {
        list.innerHTML = items.map((item) => {
            const safeItem = item && typeof item === 'object' ? item : {};
            const effectiveType = resolveMintType(safeItem.type || 'starry-cube');
            const typeConfig = getCollectionTypeConfig();
            const defaultTypeLabel = (typeConfig[effectiveType] && typeConfig[effectiveType].label)
                || (getCurrentLanguage() === 'en' ? 'Astral Cube' : 'Астральный куб');
            const profile = getShardVisualProfile(safeItem);
            const visualVars = `--shard-path:${profile.path};--shard-inner-path:${profile.inner};--shard-hue:${profile.hue}deg;--shard-rot-z:${profile.rot}deg;--shard-grain:${profile.grain}px;`;
            return `
                <article class="collection-item-card rarity-${escapeHtml(safeItem.rarity || 'common')}" data-collection-id="${escapeHtml(safeItem.id || '')}">
                    <div class="collection-item-3d type-${escapeHtml(effectiveType)}" style="${escapeHtml(visualVars)}" aria-hidden="true">
                        ${getCollectionObjectMarkup({ ...safeItem, type: effectiveType }, false)}
                    </div>
                    <div class="collection-item-meta">
                        <div class="collection-item-name">${escapeHtml(defaultTypeLabel)}</div>
                    </div>
                </article>
            `;
        }).join('');

        list.querySelectorAll('.collection-item-card').forEach((card) => {
            card.addEventListener('click', () => {
                const itemId = card.getAttribute('data-collection-id') || '';
                const found = items.find((entry) => String(entry.id || '') === String(itemId));
                if (found) {
                    openCollectionItemDetails(found, {
                        canDelete: canMint,
                        ownerEmail: normalizedEmail,
                        listId
                    });
                }
            });
        });

        bindCollection3dInteractions(list);
    }

    if (canMint) {
        const mintButtons = document.querySelectorAll('.collection-mint-btn[data-type]');
        mintButtons.forEach((mintBtn) => {
            if (mintBtn.dataset.bound === '1') return;
            mintBtn.addEventListener('click', () => {
                const requestedType = String(mintBtn.getAttribute('data-type') || 'shard-3d');
                const mintType = resolveMintType(requestedType);
                const minted = mintCollectionItem(mintType, normalizedEmail);
                if (!minted) return;
                const nextItems = getCollectionItemsByEmail(normalizedEmail);
                nextItems.unshift(minted);
                saveCollectionItemsByEmail(normalizedEmail, nextItems.slice(0, 120));
                renderCollectionListForUser(normalizedEmail, listId, true);
            });
            mintBtn.dataset.bound = '1';
        });
    }
}

function renderMarketCollectionItems() {
    if (!marketCollectionListEl) return;
    const isEn = getCurrentLanguage() === 'en';
    const typeConfig = getCollectionTypeConfig();
    const types = Object.keys(typeConfig);

    marketCollectionListEl.innerHTML = types.map((type) => {
        const cfg = typeConfig[type] || {};
        const mockItem = { type, id: 'market_preview_' + type, serial: type };
        return `
            <article class="market-item-card" data-market-type="${escapeHtml(type)}">
                <div class="market-item-top">
                    <div class="collection-item-3d type-${escapeHtml(type)}" aria-hidden="true">
                        ${getCollectionObjectMarkup(mockItem, false)}
                    </div>
                </div>
                <div class="market-item-name">${escapeHtml(cfg.label || type)}</div>
                <div class="market-item-price">${escapeHtml(getCollectionPriceLabel(Number(cfg.value || 3449), isEn))}</div>
                <button type="button" class="market-item-buy-btn" data-buy-type="${escapeHtml(type)}">${isEn ? 'Buy' : 'Купить'}</button>
            </article>
        `;
    }).join('');

    marketCollectionListEl.querySelectorAll('.market-item-buy-btn').forEach((btn) => {
        if (btn.dataset.bound === '1') return;
        btn.addEventListener('click', () => {
            const type = resolveMintType(btn.getAttribute('data-buy-type') || 'starry-cube');
            const minted = mintCollectionItem(type, currentUserEmail);
            if (!minted) return;
            const nextItems = getCollectionItemsByEmail(currentUserEmail);
            nextItems.unshift(minted);
            saveCollectionItemsByEmail(currentUserEmail, nextItems.slice(0, 120));
            renderCollectionListForUser(currentUserEmail, 'profile-collection-list', true);
            alert(isEn ? 'Item added to your collection.' : 'Предмет добавлен в вашу коллекцию.');
        });
        btn.dataset.bound = '1';
    });
}

function getLocalStories() {
    const raw = JSON.parse(localStorage.getItem(getStoriesStorageKey()) || '[]');
    if (!Array.isArray(raw)) return [];
    const now = Date.now();
    return raw.filter((item) => Number(item?.expiresAt || 0) > now);
}

function saveLocalStories(stories) {
    localStorage.setItem(getStoriesStorageKey(), JSON.stringify(Array.isArray(stories) ? stories : []));
}

async function publishStory(mediaDataUrl) {
    const ownerEmail = normalizeEmail(currentUserEmail || '');
    if (!ownerEmail || !mediaDataUrl) return false;

    if (isSupabaseEnabled()) {
        try {
            const client = getSupabaseClient();
            const { error } = await client
                .from('stories')
                .insert([{ owner_email: ownerEmail, media_url: mediaDataUrl }]);
            if (!error) {
                return true;
            }
        } catch (_error) {
            // fallback to local below
        }
    }

    const now = Date.now();
    const expiresAt = now + 24 * 60 * 60 * 1000;
    try {
        const localStories = getLocalStories();
        localStories.unshift({
            id: `local_${now}`,
            owner_email: ownerEmail,
            media_url: mediaDataUrl,
            created_at: new Date(now).toISOString(),
            expiresAt
        });
        saveLocalStories(localStories.slice(0, 200));
    } catch (_error) {
        window.alert(getCurrentLanguage() === 'en' ? 'Unable to save story locally.' : 'Не удалось сохранить историю локально.');
        return false;
    }

    return true;
}

async function fetchStoriesByEmail(targetEmail) {
    const normalizedEmail = normalizeEmail(targetEmail || '');
    if (!normalizedEmail) return [];

    const nowIso = new Date().toISOString();

    let supabaseStories = [];
    if (isSupabaseEnabled()) {
        try {
            const client = getSupabaseClient();
            const { data, error } = await client
                .from('stories')
                .select('id, owner_email, media_url, created_at, expires_at')
                .eq('owner_email', normalizedEmail)
                .gt('expires_at', nowIso)
                .order('created_at', { ascending: false })
                .limit(50);

            if (!error && Array.isArray(data)) {
                supabaseStories = data;
            }
        } catch (_error) {
            // local fallback below
        }
    }

    const localStories = getLocalStories()
        .filter((item) => normalizeEmail(item.owner_email || '') === normalizedEmail)
        .sort((a, b) => Number(new Date(b.created_at || 0)) - Number(new Date(a.created_at || 0)));

    const mapById = new Map();
    const mapByFingerprint = new Map();
    [...supabaseStories, ...localStories].forEach((story) => {
        const key = String(story.id || `${story.owner_email}_${story.media_url}_${story.created_at}`);
        mapById.set(key, story);

        const createdMs = new Date(story.created_at || 0).getTime() || 0;
        const roundedMinute = Math.floor(createdMs / 60000);
        const fingerprint = `${normalizeEmail(story.owner_email || '')}|${String(story.media_url || '').slice(0, 300)}|${roundedMinute}`;
        if (!mapByFingerprint.has(fingerprint)) {
            mapByFingerprint.set(fingerprint, story);
        }
    });

    return Array.from(mapById.values())
        .filter((story) => {
            const createdMs = new Date(story.created_at || 0).getTime() || 0;
            const roundedMinute = Math.floor(createdMs / 60000);
            const fingerprint = `${normalizeEmail(story.owner_email || '')}|${String(story.media_url || '').slice(0, 300)}|${roundedMinute}`;
            return mapByFingerprint.get(fingerprint) === story;
        })
        .filter((story) => {
            const expires = story.expires_at || story.expiresAt;
            if (!expires) return true;
            return new Date(expires).getTime() > Date.now();
        })
        .sort((a, b) => Number(new Date(b.created_at || 0)) - Number(new Date(a.created_at || 0)));
}

function formatStoryViewerDate(createdAt) {
    const lang = getCurrentLanguage() === 'en' ? 'en-US' : 'ru-RU';
    return new Date(createdAt || Date.now()).toLocaleString(lang, {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
    });
}

function renderStoryViewerFrame() {
    const modal = document.getElementById('story-viewer-modal');
    const img = document.getElementById('story-viewer-img');
    const date = document.getElementById('story-viewer-date');
    if (!modal || !img || !date || !storyViewerItems.length) return;

    const safeIndex = Math.max(0, Math.min(storyViewerIndex, storyViewerItems.length - 1));
    storyViewerIndex = safeIndex;
    const active = storyViewerItems[safeIndex];
    img.src = String(active?.media_url || '');
    img.alt = 'story';
    date.textContent = formatStoryViewerDate(active?.created_at);
    updateStoryViewerOwnerActions();
}

function closeStoryViewerMenu() {
    const menu = document.getElementById('story-viewer-menu');
    if (menu) menu.classList.remove('show');
}
function updateStoryViewerOwnerActions() {
    const menuBtn = document.getElementById('story-viewer-menu-btn');
    const menu = document.getElementById('story-viewer-menu');
    const active = storyViewerItems[storyViewerIndex];
    const isOwner = normalizeEmail(active?.owner_email || '') === normalizeEmail(currentUserEmail || '');
    if (menuBtn) menuBtn.hidden = !isOwner;
    if (!isOwner && menu) menu.classList.remove('show');
}

function renderStoryViewerProgress(progressRatio = 0) {
    const container = document.getElementById('story-viewer-progress');
    if (!container || !storyViewerItems.length) return;

    const safeProgress = Math.max(0, Math.min(progressRatio, 1));
    container.innerHTML = storyViewerItems.map((_, idx) => {
        const fill = idx < storyViewerIndex
            ? 1
            : (idx === storyViewerIndex ? safeProgress : 0);
        return `
            <span class="story-progress-segment">
                <span class="story-progress-fill" style="transform: scaleX(${fill});"></span>
            </span>
        `;
    }).join('');
}

function stopStoryViewerAutoplay() {
    if (storyViewerAutoTimer) {
        clearTimeout(storyViewerAutoTimer);
        storyViewerAutoTimer = null;
    }
    if (storyViewerProgressTimer) {
        clearInterval(storyViewerProgressTimer);
        storyViewerProgressTimer = null;
    }
}

function startStoryViewerAutoplay() {
    stopStoryViewerAutoplay();
    storyViewerProgressStartedAt = Date.now();
    renderStoryViewerProgress(0);

    storyViewerProgressTimer = setInterval(() => {
        const elapsed = Date.now() - storyViewerProgressStartedAt;
        renderStoryViewerProgress(elapsed / STORY_VIEWER_DURATION_MS);
    }, 50);

    storyViewerAutoTimer = setTimeout(() => {
        showNextStory();
    }, STORY_VIEWER_DURATION_MS);
}

function closeStoryViewer() {
    const modal = document.getElementById('story-viewer-modal');
    if (!modal) return;
    stopStoryViewerAutoplay();
    closeStoryViewerMenu();
    modal.classList.remove('active');
    modal.setAttribute('aria-hidden', 'true');
}

function openStoryViewer(stories, startIndex = 0) {
    const modal = document.getElementById('story-viewer-modal');
    if (!modal || !Array.isArray(stories) || !stories.length) return;

    storyViewerItems = stories;
    storyViewerIndex = Math.max(0, Math.min(Number(startIndex) || 0, stories.length - 1));
    renderStoryViewerFrame();
    renderStoryViewerProgress(0);
    modal.classList.add('active');
    modal.setAttribute('aria-hidden', 'false');
    startStoryViewerAutoplay();
}

function showPrevStory() {
    if (!storyViewerItems.length) return;
    storyViewerIndex = (storyViewerIndex - 1 + storyViewerItems.length) % storyViewerItems.length;
    renderStoryViewerFrame();
    startStoryViewerAutoplay();
}

function showNextStory() {
    if (!storyViewerItems.length) return;
    if (storyViewerIndex >= storyViewerItems.length - 1) {
        closeStoryViewer();
        return;
    }
    storyViewerIndex += 1;
    renderStoryViewerFrame();
    startStoryViewerAutoplay();
}

async function deleteCurrentStoryFromViewer() {
    const active = storyViewerItems[storyViewerIndex];
    if (!active) return;
    const owner = normalizeEmail(active.owner_email || '');
    if (!owner || owner !== normalizeEmail(currentUserEmail || '')) return;

    const localStories = getLocalStories();
    const nextLocal = localStories.filter((item) => {
        const sameId = String(item.id || '') === String(active.id || '');
        const samePayload =
            normalizeEmail(item.owner_email || '') === owner &&
            String(item.media_url || '') === String(active.media_url || '') &&
            String(item.created_at || '') === String(active.created_at || '');
        return !(sameId || samePayload);
    });
    saveLocalStories(nextLocal);

    if (isSupabaseEnabled()) {
        try {
            const client = getSupabaseClient();
            if (String(active.id || '').startsWith('local_')) {
                // local-only story
            } else {
                await client.from('stories').delete().eq('id', active.id);
            }
        } catch (_error) {
            // local copy already removed
        }
    }

    storyViewerItems.splice(storyViewerIndex, 1);
    if (!storyViewerItems.length) {
        closeStoryViewer();
    } else {
        storyViewerIndex = Math.min(storyViewerIndex, storyViewerItems.length - 1);
        renderStoryViewerFrame();
        startStoryViewerAutoplay();
    }

    if (currentUserEmail) {
        renderStoriesListForUser(currentUserEmail, 'profile-stories-list');
    }
    if (currentViewedUserProfileEmail) {
        renderStoriesListForUser(currentViewedUserProfileEmail, 'user-profile-stories-list');
    }
}

function initStoryViewer() {
    if (storyViewerInitialized) return;
    storyViewerInitialized = true;

    const modal = document.getElementById('story-viewer-modal');
    const closeBtn = document.getElementById('story-viewer-close');
    const prevBtn = document.getElementById('story-viewer-prev');
    const nextBtn = document.getElementById('story-viewer-next');
    const menuBtn = document.getElementById('story-viewer-menu-btn');
    const menu = document.getElementById('story-viewer-menu');
    const deleteBtn = document.getElementById('story-viewer-delete-btn');
    const content = document.getElementById('story-viewer-content');
    if (!modal || !content) return;

    if (closeBtn) closeBtn.addEventListener('click', closeStoryViewer);
    if (prevBtn) prevBtn.addEventListener('click', showPrevStory);
    if (nextBtn) nextBtn.addEventListener('click', showNextStory);
    if (menuBtn) {
        menuBtn.addEventListener('click', (event) => {
            event.stopPropagation();
            if (menu) menu.classList.toggle('show');
        });
    }
    if (deleteBtn) {
        deleteBtn.addEventListener('click', async (event) => {
            event.stopPropagation();
            closeStoryViewerMenu();
            const ok = window.confirm(getCurrentLanguage() === 'en' ? 'Delete this story?' : 'Удалить эту историю?');
            if (!ok) return;
            await deleteCurrentStoryFromViewer();
        });
    }

    modal.addEventListener('click', (event) => {
        if (event.target === modal) closeStoryViewer();
        if (menu && menu.classList.contains('show') && !menu.contains(event.target) && event.target !== menuBtn) {
            closeStoryViewerMenu();
        }
    });

    let swipeStartX = 0;
    let swipeStartY = 0;
    content.addEventListener('touchstart', (event) => {
        const touch = event.touches?.[0];
        if (!touch) return;
        swipeStartX = touch.clientX;
        swipeStartY = touch.clientY;
    }, { passive: true });

    content.addEventListener('touchend', (event) => {
        const touch = event.changedTouches?.[0];
        if (!touch) return;
        const dx = touch.clientX - swipeStartX;
        const dy = touch.clientY - swipeStartY;
        if (Math.abs(dx) < 40 || Math.abs(dx) < Math.abs(dy)) return;
        if (dx > 0) {
            showPrevStory();
        } else {
            showNextStory();
        }
    }, { passive: true });

    document.addEventListener('keydown', (event) => {
        if (!modal.classList.contains('active')) return;
        if (event.key === 'Escape') closeStoryViewer();
        if (event.key === 'ArrowLeft') showPrevStory();
        if (event.key === 'ArrowRight') showNextStory();
    });
}

async function renderStoriesListForUser(targetEmail, listId) {
    const list = document.getElementById(listId);
    if (!list) return;

    const isEn = getCurrentLanguage() === 'en';
    list.innerHTML = `<div class="stories-empty">${isEn ? 'Loading...' : 'Загрузка...'}</div>`;

    const stories = await fetchStoriesByEmail(targetEmail);
    if (!stories.length) {
        list.innerHTML = `<div class="stories-empty">${isEn ? 'No stories' : 'Нет историй'}</div>`;
        return;
    }

    list.innerHTML = stories.map((story, index) => {
        const src = String(story.media_url || '');
        const safeSrc = escapeHtml(src);
        return `
            <button type="button" class="story-card" data-story-src="${safeSrc}" data-story-index="${index}" aria-label="Story">
                <img src="${safeSrc}" alt="story" class="story-card-image">
            </button>
        `;
    }).join('');

    list.querySelectorAll('.story-card').forEach((node) => {
        node.addEventListener('click', () => {
            const index = Number(node.getAttribute('data-story-index') || 0);
            openStoryViewer(stories, index);
        });
    });
}

function initMobilePullToRefresh() {
    if (mobilePullRefreshInitialized) return;
    mobilePullRefreshInitialized = true;

    const isTouchDevice = 'ontouchstart' in window || navigator.maxTouchPoints > 0;
    if (!isTouchDevice) return;

    let startY = 0;
    let candidate = false;
    let triggered = false;

    document.addEventListener('touchstart', (event) => {
        if (document.getElementById('story-viewer-modal')?.classList.contains('active')) return;
        const touch = event.touches?.[0];
        if (!touch) return;
        startY = touch.clientY;
        candidate = touch.clientY <= 56;
        triggered = false;
    }, { passive: true });

    document.addEventListener('touchmove', (event) => {
        if (!candidate || triggered) return;
        const touch = event.touches?.[0];
        if (!touch) return;
        const dy = touch.clientY - startY;
        if (dy > 110) {
            triggered = true;
            window.location.reload();
        }
    }, { passive: true });
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
        let avatarHtml = `<div class="chat-avatar fallback">${escapeHtml((item.title || '•').charAt(0).toUpperCase())}</div>`;
        if (type === 'users') {
            const email = normalizeEmail(item.id || '');
            if (email) {
                avatarHtml = createAvatarMarkup({
                    email,
                    displayName: getDisplayNameByEmail(email),
                    avatar: getAvatarByEmail(email),
                    glowColor: getUserProfileDataByEmail(email).glowColor
                });
            }
        } else if (type === 'chats') {
            const conversation = getConversationById(item.id);
            const peerEmail = conversation ? getOtherParticipantEmail(conversation) : '';
            if (peerEmail) {
                avatarHtml = createAvatarMarkup({
                    email: peerEmail,
                    displayName: getDisplayNameByEmail(peerEmail),
                    avatar: getAvatarByEmail(peerEmail),
                    glowColor: getUserProfileDataByEmail(peerEmail).glowColor
                });
            }
        }

        const row = document.createElement('button');
        row.type = 'button';
        row.className = 'chat-list-item';
        row.innerHTML = `
            ${avatarHtml}
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

    if (activeSearchSubmenuTab === 'products') {
        chatArea.innerHTML = '<div class="no-chats-message">Товары появятся в следующих версиях</div>';
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

function normalizeMessageFilePayload(rawFile) {
    if (!rawFile) return null;

    let value = rawFile;
    for (let i = 0; i < 3; i += 1) {
        if (typeof value !== 'string') break;
        const trimmed = value.trim();
        if (!trimmed) return null;

        const maybeJson =
            (trimmed.startsWith('{') && trimmed.endsWith('}')) ||
            (trimmed.startsWith('"') && trimmed.endsWith('"'));

        if (!maybeJson) {
            return null;
        }

        try {
            value = JSON.parse(trimmed);
        } catch (_parseError) {
            return null;
        }
    }

    if (!value || typeof value !== 'object' || Array.isArray(value)) return null;

    const normalizedName = String(value.name || 'Файл').trim() || 'Файл';
    const normalizedType = String(value.type || '').trim() || inferMimeTypeFromName(normalizedName);
    const normalizedData = String(value.data || '').trim();
    if (!normalizedData) return null;

    return {
        name: normalizedName,
        type: normalizedType,
        size: Number(value.size || 0) || 0,
        data: normalizedData
    };
}

function normalizeConversationParticipants(rawParticipants) {
    if (Array.isArray(rawParticipants)) {
        return rawParticipants.map(v => normalizeEmail(v)).filter(Boolean);
    }

    const text = String(rawParticipants || '').trim();
    if (!text) return [];

    return text
        .replace(/[{}]/g, '')
        .split(',')
        .map(v => normalizeEmail(v))
        .filter(Boolean);
}

function normalizeSupabaseConversationRow(row) {
    const conversationId = row.conversation_id;
    const participants = normalizeConversationParticipants(row.participants);

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
            file: normalizeMessageFilePayload(row.file)
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
    const existingIndex = conversation.messages.findIndex(msg => msg.remoteId && msg.remoteId === normalized.message.remoteId);
    if (existingIndex === -1) {
        conversation.messages.push(normalized.message);
        conversation.updatedAt = Math.max(conversation.updatedAt || 0, normalized.message.timestamp);
        if (normalized.message.sender !== currentUserEmail) {
            markConversationAsUnread(normalized.conversationId);
            maybeShowIncomingMessageNotification(normalized.conversationId, normalized.message);
        }
    } else {
        const existingMessage = conversation.messages[existingIndex] || {};
        conversation.messages[existingIndex] = {
            ...existingMessage,
            ...normalized.message,
            file: normalized.message.file || existingMessage.file || null,
            pending: false,
            failed: false
        };
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
        const participants = normalizeConversationParticipants(row?.participants);
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
                const participants = normalizeConversationParticipants(row?.participants);
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
                const participants = normalizeConversationParticipants(row?.participants);
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
                const participants = normalizeConversationParticipants(row?.participants);
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
    initStoryViewer();
    initAvatarParticleAnimation();
    renderMarketCollectionItems();
    initMobilePullToRefresh();
    consumeNotificationConversationFromUrl();
    void ensureNotificationServiceWorkerReady();
    void syncWebPushSubscriptionWithSupabase();

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
    tryOpenPendingNotificationConversation();
}

function createAvatarParticleState(canvas) {
    const ctx = canvas.getContext('2d');
    if (!ctx) return null;

    const colors = [
        'rgba(48, 161, 255, 0.32)',
        'rgba(255, 94, 152, 0.32)',
        'rgba(139, 65, 223, 0.32)'
    ];

    const particles = Array.from({ length: 80 }, () => ({
        angle: Math.random() * Math.PI * 2,
        orbit: 20 + Math.random() * 68,
        speed: 0.18 + Math.random() * 0.58,
        radius: 1 + Math.random() * 2.8,
        alpha: 0.2 + Math.random() * 0.48,
        pulse: 0.6 + Math.random() * 1.6,
        color: colors[Math.floor(Math.random() * colors.length)]
    }));

    const blobs = Array.from({ length: 10 }, () => ({
        angle: Math.random() * Math.PI * 2,
        orbit: 22 + Math.random() * 48,
        speed: 0.22 + Math.random() * 0.46,
        radius: 10 + Math.random() * 16,
        alpha: 0.15 + Math.random() * 0.2,
        pulse: 0.8 + Math.random() * 1.8,
        color: colors[Math.floor(Math.random() * colors.length)]
    }));

    return {
        canvas,
        ctx,
        particles,
        blobs,
        shaderFlow: null,
        animationType: AVATAR_PARTICLE_ANIMATION_DEFAULT,
        width: 0,
        height: 0,
        dpr: Math.max(1, Math.min(2, window.devicePixelRatio || 1))
    };
}

function createAvatarShader(gl, type, source) {
    const shader = gl.createShader(type);
    if (!shader) return null;
    gl.shaderSource(shader, source);
    gl.compileShader(shader);
    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
        gl.deleteShader(shader);
        return null;
    }
    return shader;
}

function ensureAvatarShaderFlowState(state) {
    if (state.shaderFlow) return state.shaderFlow;

    const shaderCanvas = document.createElement('canvas');
    const gl = shaderCanvas.getContext('webgl', { alpha: true, antialias: false, premultipliedAlpha: true });
    if (!gl) {
        state.shaderFlow = { failed: true };
        return state.shaderFlow;
    }

    const vs = createAvatarShader(gl, gl.VERTEX_SHADER, AVATAR_SHADERFLOW_VERTEX_SOURCE);
    const fs = createAvatarShader(gl, gl.FRAGMENT_SHADER, AVATAR_SHADERFLOW_FRAGMENT_SOURCE);
    if (!vs || !fs) {
        state.shaderFlow = { failed: true };
        return state.shaderFlow;
    }

    const program = gl.createProgram();
    if (!program) {
        state.shaderFlow = { failed: true };
        return state.shaderFlow;
    }

    gl.attachShader(program, vs);
    gl.attachShader(program, fs);
    gl.linkProgram(program);
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
        state.shaderFlow = { failed: true };
        return state.shaderFlow;
    }

    const positionBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer);
    gl.bufferData(
        gl.ARRAY_BUFFER,
        new Float32Array([
            -1.0, -1.0,
             1.0, -1.0,
            -1.0,  1.0,
             1.0,  1.0,
        ]),
        gl.STATIC_DRAW
    );

    const positionLocation = gl.getAttribLocation(program, 'a_position');
    gl.enableVertexAttribArray(positionLocation);
    gl.vertexAttribPointer(positionLocation, 2, gl.FLOAT, false, 0, 0);

    const uniforms = {
        resolution: gl.getUniformLocation(program, 'u_resolution'),
        mouse: gl.getUniformLocation(program, 'u_mouse'),
        time: gl.getUniformLocation(program, 'u_time')
    };

    state.shaderFlow = {
        failed: false,
        canvas: shaderCanvas,
        gl,
        program,
        uniforms
    };

    return state.shaderFlow;
}

function resizeAvatarParticleState(state) {
    const wrapper = state.canvas.parentElement;
    if (!wrapper) return;

    const drawSize = AVATAR_PARTICLE_DRAW_SIZE;

    state.width = drawSize;
    state.height = drawSize;
    state.canvas.style.width = drawSize + 'px';
    state.canvas.style.height = drawSize + 'px';
    state.canvas.width = Math.round(drawSize * state.dpr);
    state.canvas.height = Math.round(drawSize * state.dpr);
    state.ctx.setTransform(state.dpr, 0, 0, state.dpr, 0, 0);

    if (state.shaderFlow && !state.shaderFlow.failed) {
        state.shaderFlow.canvas.width = state.canvas.width;
        state.shaderFlow.canvas.height = state.canvas.height;
        state.shaderFlow.gl.viewport(0, 0, state.shaderFlow.gl.drawingBufferWidth, state.shaderFlow.gl.drawingBufferHeight);
    }
}

function renderAvatarShaderFlow(state, elapsedSec) {
    const shader = ensureAvatarShaderFlowState(state);
    if (!shader || shader.failed) return false;

    const gl = shader.gl;
    const program = shader.program;
    gl.useProgram(program);
    gl.uniform2f(shader.uniforms.resolution, shader.canvas.width, shader.canvas.height);
    gl.uniform2f(shader.uniforms.mouse, -1.0, -1.0);
    gl.uniform1f(shader.uniforms.time, elapsedSec);
    gl.clearColor(0, 0, 0, 0);
    gl.clear(gl.COLOR_BUFFER_BIT);
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);

    state.ctx.save();
    state.ctx.globalCompositeOperation = 'screen';
    state.ctx.drawImage(shader.canvas, 0, 0, state.width, state.height);
    state.ctx.restore();
    return true;
}

function drawAvatarParticles(state, elapsedSec, dtSec) {
    const ctx = state.ctx;
    if (!ctx) return;
    ctx.clearRect(0, 0, state.width, state.height);

    const cx = state.width * 0.5;
    const cy = state.height * 0.5;

    if (state.animationType === 'nebula') {
        ctx.save();
        ctx.globalCompositeOperation = 'lighter';
        for (const blob of state.blobs) {
            blob.angle += blob.speed * dtSec;
            const wobble = Math.sin(elapsedSec * blob.pulse + blob.orbit * 0.07) * 10;
            const orbit = blob.orbit + wobble;
            const x = cx + Math.cos(blob.angle) * orbit;
            const y = cy + Math.sin(blob.angle * 1.08) * orbit * 0.86;
            const pulse = 0.78 + Math.sin(elapsedSec * blob.pulse) * 0.22;
            const radius = blob.radius * pulse;

            const gradient = ctx.createRadialGradient(x, y, 0, x, y, radius * 2.8);
            gradient.addColorStop(0, blob.color.replace('0.32', String(blob.alpha + 0.08)));
            gradient.addColorStop(0.55, blob.color.replace('0.32', String(blob.alpha * 0.55)));
            gradient.addColorStop(1, 'rgba(0, 0, 0, 0)');

            ctx.fillStyle = gradient;
            ctx.beginPath();
            ctx.arc(x, y, radius * 2.8, 0, Math.PI * 2);
            ctx.fill();
        }
        ctx.restore();
        return;
    }

    if (state.animationType === 'shaderflow') {
        renderAvatarShaderFlow(state, elapsedSec);
        return;
    }

    for (const p of state.particles) {
        p.angle += p.speed * dtSec;
        const wobble = Math.sin(elapsedSec * p.pulse + p.orbit * 0.05) * 8;
        const r = p.orbit + wobble;
        const x = cx + Math.cos(p.angle) * r;
        const y = cy + Math.sin(p.angle * 1.13) * r * 0.84;

        const gradient = ctx.createRadialGradient(x, y, 0, x, y, p.radius * 6.2);
        gradient.addColorStop(0, p.color.replace('0.32', String(p.alpha)));
        gradient.addColorStop(1, 'rgba(0, 0, 0, 0)');

        ctx.fillStyle = gradient;
        const size = p.radius * 12.4;
        ctx.fillRect(x - size * 0.5, y - size * 0.5, size, size);
    }
}

function normalizeAvatarParticleAnimation(value) {
    const raw = String(value || '').trim().toLowerCase();
    const normalized = raw === 'fireflow' ? 'shaderflow' : raw;
    return AVATAR_PARTICLE_ANIMATION_SET.has(normalized)
        ? normalized
        : AVATAR_PARTICLE_ANIMATION_DEFAULT;
}

function normalizeGlowAnimation(value) {
    const allowed = new Set(['pulse', 'spin', 'breathe', 'wave', 'flicker', 'nebula', 'singularity', 'quasar', 'wormhole', 'supernova', 'none']);
    const normalized = String(value || '').trim().toLowerCase();
    return allowed.has(normalized) ? normalized : 'pulse';
}

function getAvatarParticleAnimationType() {
    if (!currentUserEmail) return AVATAR_PARTICLE_ANIMATION_DEFAULT;
    const saved = localStorage.getItem('avatarParticleAnimation_' + currentUserEmail);
    return normalizeAvatarParticleAnimation(saved);
}

function applyAvatarParticleAnimationType(nextType) {
    const animationType = normalizeAvatarParticleAnimation(nextType);
    document.querySelectorAll('.avatar-particle-canvas').forEach((canvas) => {
        setAvatarParticleAnimationForCanvas(canvas, animationType);
    });
    const animationSelect = document.getElementById('edit-avatar-animation');
    if (animationSelect) {
        animationSelect.value = animationType;
    }
}

function setAvatarParticleAnimationForCanvas(canvas, nextType) {
    if (!canvas) return;
    const animationType = normalizeAvatarParticleAnimation(nextType);
    canvas.setAttribute('data-animation', animationType);
    const state = avatarParticleStates.find((item) => item?.canvas === canvas);
    if (state) {
        state.animationType = animationType;
    }
}

function initAvatarParticleAnimation() {
    if (avatarParticlesInitialized) return;

    const canvases = Array.from(document.querySelectorAll('.avatar-particle-canvas'));
    if (!canvases.length) return;

    avatarParticleStates = canvases
        .map((canvas) => createAvatarParticleState(canvas))
        .filter(Boolean);

    if (!avatarParticleStates.length) return;
    avatarParticlesInitialized = true;

    applyAvatarParticleAnimationType(getAvatarParticleAnimationType());

    avatarParticleStates.forEach((state) => resizeAvatarParticleState(state));
    window.addEventListener('resize', () => {
        avatarParticleStates.forEach((state) => resizeAvatarParticleState(state));
    });

    let previousTime = performance.now();
    const animate = (now) => {
        const dtSec = Math.min(0.05, (now - previousTime) / 1000);
        previousTime = now;
        const elapsedSec = now / 1000;
        if (document.documentElement.classList.contains('avatar-animation-off')) {
            avatarParticleStates.forEach((state) => {
                if (!state || !state.ctx) return;
                state.ctx.clearRect(0, 0, state.width, state.height);
            });
        } else {
            avatarParticleStates.forEach((state) => drawAvatarParticles(state, elapsedSec, dtSec));
        }
        avatarParticlesRafId = requestAnimationFrame(animate);
    };

    if (avatarParticlesRafId) {
        cancelAnimationFrame(avatarParticlesRafId);
    }
    avatarParticlesRafId = requestAnimationFrame(animate);
}

window.addEventListener('DOMContentLoaded', () => {
    bootstrapApp();
    const bootstrapEmail = normalizeEmail(currentUserEmail || localStorage.getItem('currentUserEmail') || '');
    applyAvatarAnimationEnabled(getAvatarAnimationEnabled(bootstrapEmail));
    applyAvatarGlowEnabled(getAvatarGlowEnabled(bootstrapEmail));
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
        const authScreens = new Set([
            'screen-login',
            'screen-register',
            'screen-name',
            'screen-code',
            'screen-phone',
            'screen-reset-email',
            'screen-reset-code',
            'screen-new-password'
        ]);
        authCard.style.display = authScreens.has(screenId) ? 'block' : 'none';
    }

    if(screenId === 'screen-reset-code') {
        setTimeout(() => document.querySelector('.reset-code-input').focus(), 100);
    }
    
    // Обновляем активный пункт навигации с анимацией
    updateActiveNavItem(screenId);

    if (screenId === 'screen-main') {
        requestAnimationFrame(syncMainSubmenuVisualState);
        setTimeout(syncMainSubmenuVisualState, 90);
        setTimeout(syncMainSubmenuVisualState, 220);
    }
}

// Функция перехода на главный экран
function goToMainScreen() {
    if (currentUserEmail) {
        touchCurrentDeviceSession(currentUserEmail);
        // Убедимся, что email сохранён в localStorage (для обновления страницы)
        if (!localStorage.getItem('currentUserEmail')) {
            localStorage.setItem('currentUserEmail', currentUserEmail);
        }
        
        // Добавляем текущий аккаунт в список сохранённых
        addAccountToLoggedList(currentUserEmail);
        ensureWalletSeedData(currentUserEmail);
        syncWalletFromOnline(currentUserEmail).catch(() => {
            // fallback to local wallet
        });

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
        loadGlowColor();
        applyAvatarParticleAnimationType(getAvatarParticleAnimationType());
        applyAvatarAnimationEnabled(getAvatarAnimationEnabled());
        applyAvatarGlowEnabled(getAvatarGlowEnabled());
        applyNicknameGradientEnabled(getNicknameGradientEnabled());
        applyNicknameGradientPalette(getNicknameGradientPalette());

        const searchInput = document.getElementById('chat-search');
        if (searchInput) {
            searchInput.value = '';
        }

        activeConversationId = null;
        activeThreadDom = null;
        lastRenderedConversationSignature = '';
        scheduleChatAreaUpdate({ skipRemoteRefresh: true });
        void setupNotificationPermissionAutoPrompt();
        void syncWebPushSubscriptionWithSupabase();

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
            updateMembershipUI();
            updateUnreadUiIndicators();
        }, 100);
    } else {
        goToScreen('screen-login');
    }
}

document.addEventListener('DOMContentLoaded', () => {
    applyLanguage(getCurrentLanguage());
});

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
    document.documentElement.classList.remove('nickname-gradient-on');
    
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
const navAddStoryBtn = document.getElementById('nav-add-story-btn');
const profileStoryUpload = document.getElementById('profile-story-upload');
const profileAvatarDisplay = document.getElementById('profile-avatar-display');
const saveProfileBtn = document.getElementById('save-profile-btn');
const servicesBtn = document.getElementById('services-btn');
const marketBtn = document.getElementById('market-btn');
const marketCollectionListEl = document.getElementById('market-collection-list');
const businessAccountBtn = document.getElementById('business-account-btn');
const actionNotificationsBtn = document.getElementById('action-notifications');
const actionPrivacyBtn = document.getElementById('action-privacy');
const actionDevicesBtn = document.getElementById('action-devices');
const actionLanguageBtn = document.getElementById('action-language');
const actionWalletBtn = document.getElementById('action-wallet');
const createGroupBtn = document.getElementById('create-group-btn');
const premiumCard = document.getElementById('premium-card');
const businessCard = document.getElementById('business-card');
const goldBackBtn = document.getElementById('gold-back-btn');
const goldBuyBtn = document.getElementById('gold-buy-btn');
const editGoldBadgeVisibleInput = document.getElementById('edit-gold-badge-visible');
const devicesList = document.getElementById('devices-list');
const langRuBtn = document.getElementById('lang-ru-btn');
const langEnBtn = document.getElementById('lang-en-btn');
const privacyChangePasswordBtn = document.getElementById('privacy-change-password-btn');
const privacyChangeEmailBtn = document.getElementById('privacy-change-email-btn');
const privacyChangePinBtn = document.getElementById('privacy-change-pin-btn');
const privacyPasswordPanel = document.getElementById('privacy-password-panel');
const privacyPasswordForm = document.getElementById('privacy-password-form');
const privacyOldPasswordInput = document.getElementById('privacy-old-password');
const privacyNewPasswordInput = document.getElementById('privacy-new-password');
const privacyEmailPanel = document.getElementById('privacy-email-panel');
const privacyEmailForm = document.getElementById('privacy-email-form');
const privacyNewEmailInput = document.getElementById('privacy-new-email');
const privacyPinPanel = document.getElementById('privacy-pin-panel');
const privacyPinForm = document.getElementById('privacy-pin-form');
const privacyLoginPinInput = document.getElementById('privacy-login-pin');
const groupCreateBackBtn = document.getElementById('group-create-back-btn');
const groupCreateSubmitBtn = document.getElementById('group-create-submit-btn');
const groupCreateTitleInput = document.getElementById('group-create-title');
const groupCreateCandidatesEl = document.getElementById('group-create-candidates');
const groupCreateSelectedCountEl = document.getElementById('group-create-selected-count');
const groupCreateAvatarBtn = document.getElementById('group-create-avatar-btn');
const groupCreateAvatarPreview = document.getElementById('group-create-avatar-preview');
const groupCreateAvatarInput = document.getElementById('group-create-avatar-input');
const conversationInfoBackBtn = document.getElementById('conversation-info-back-btn');
const conversationInfoAvatarEl = document.getElementById('conversation-info-avatar');
const conversationAvatarInput = document.getElementById('conversation-avatar-input');
const conversationInfoTitleEl = document.getElementById('conversation-info-title');
const conversationInfoSubtitleEl = document.getElementById('conversation-info-subtitle');
const conversationInfoRoleNoteEl = document.getElementById('conversation-info-role-note');
const conversationInfoMembersEl = document.getElementById('conversation-info-members');
const conversationInfoOwnerActionsEl = document.getElementById('conversation-info-owner-actions');
const conversationInfoEditBtn = document.getElementById('conversation-info-edit-btn');
const conversationInfoInviteBtn = document.getElementById('conversation-info-invite-btn');
const conversationInfoAdminsBtn = document.getElementById('conversation-info-admins-btn');
const conversationInfoLeaveBtn = document.getElementById('conversation-info-leave-btn');
const conversationInfoDeleteBtn = document.getElementById('conversation-info-delete-btn');
const conversationInfoMoreBtn = document.getElementById('conversation-info-more-btn');
const conversationInfoMoreMenu = document.getElementById('conversation-info-more-menu');
const conversationMenuLeaveBtn = document.getElementById('conversation-menu-leave-btn');
const conversationMenuDeleteBtn = document.getElementById('conversation-menu-delete-btn');
const conversationEditBackBtn = document.getElementById('conversation-edit-back-btn');
const conversationEditTitleInput = document.getElementById('conversation-edit-title');
const conversationEditSaveBtn = document.getElementById('conversation-edit-save-btn');
const conversationEditAvatarBtn = document.getElementById('conversation-edit-avatar-btn');
const conversationEditAvatarPreview = document.getElementById('conversation-edit-avatar-preview');
const conversationEditAvatarInput = document.getElementById('conversation-edit-avatar-input');
const conversationInviteBackBtn = document.getElementById('conversation-invite-back-btn');
const conversationInviteCandidatesEl = document.getElementById('conversation-invite-candidates');
const conversationInviteSelectedCountEl = document.getElementById('conversation-invite-selected-count');
const conversationInviteSubmitBtn = document.getElementById('conversation-invite-submit-btn');
const conversationAdminsBackBtn = document.getElementById('conversation-admins-back-btn');
const conversationAdminsMembersEl = document.getElementById('conversation-admins-members');
const conversationAdminsSelectedCountEl = document.getElementById('conversation-admins-selected-count');
const conversationAdminsSaveBtn = document.getElementById('conversation-admins-save-btn');
const privacyVisibilityOptions = Array.from(document.querySelectorAll('.privacy-visibility-option'));
const notifSendSoundInput = document.getElementById('notif-send-sound');
const notifIncomingSoundInput = document.getElementById('notif-incoming-sound');
const notifPushEnabledInput = document.getElementById('notif-push-enabled');
const notifVibrationEnabledInput = document.getElementById('notif-vibration-enabled');
const notifConnectBtn = document.getElementById('notif-connect-btn');
const notifPermissionStatus = document.getElementById('notif-permission-status');
const settingNicknameGradientInput = document.getElementById('setting-nickname-gradient');
const editNicknameGradientInput = document.getElementById('edit-nickname-gradient');
const editNicknameGradientPaletteSelect = document.getElementById('edit-nickname-gradient-palette');

function getNicknameGradientKey(email = currentUserEmail) {
    return 'nicknameGradientEnabled_' + normalizeEmail(email || 'guest');
}

function getNicknameGradientPaletteKey(email = currentUserEmail) {
    return 'nicknameGradientPalette_' + normalizeEmail(email || 'guest');
}

function normalizeNicknameGradientPalette(value) {
    const normalized = String(value || '').trim().toLowerCase();
    const allowed = new Set(['aurora', 'sunset', 'ocean', 'neon']);
    return allowed.has(normalized) ? normalized : 'aurora';
}

function getNicknameGradientPaletteStops(palette) {
    const normalized = normalizeNicknameGradientPalette(palette);
    const palettes = {
        aurora: ['#ff7aa2', '#ffd36f', '#67e8f9', '#7c9dff', '#ff7aa2'],
        sunset: ['#ff8f5a', '#ff4d8d', '#7f5cff', '#5fd3ff', '#ff8f5a'],
        ocean: ['#34d399', '#22d3ee', '#38bdf8', '#60a5fa', '#34d399'],
        neon: ['#f472b6', '#a78bfa', '#22d3ee', '#4ade80', '#f472b6']
    };
    return palettes[normalized] || palettes.aurora;
}

function getNicknameGradientEnabled(email = currentUserEmail) {
    const normalized = normalizeEmail(email || '');
    if (!normalized) return false;
    if (!hasMargeletBoost(normalized)) return false;
    return localStorage.getItem(getNicknameGradientKey(normalized)) === '1';
}

function getNicknameGradientPalette(email = currentUserEmail) {
    const normalized = normalizeEmail(email || '');
    if (!normalized) return 'aurora';
    return normalizeNicknameGradientPalette(localStorage.getItem(getNicknameGradientPaletteKey(normalized)));
}

function applyNicknameGradientPalette(palette) {
    const normalized = normalizeNicknameGradientPalette(palette);
    document.documentElement.setAttribute('data-nickname-gradient-palette', normalized);
    if (editNicknameGradientPaletteSelect) {
        editNicknameGradientPaletteSelect.value = normalized;
    }
}

function applyNicknameGradientEnabled(enabled) {
    const isEnabled = Boolean(enabled);
    document.documentElement.classList.toggle('nickname-gradient-on', isEnabled);
    if (settingNicknameGradientInput) {
        settingNicknameGradientInput.checked = isEnabled;
    }
    if (editNicknameGradientInput) {
        editNicknameGradientInput.checked = isEnabled;
    }
}

function applyNicknameGradientVarsToElement(element, palette) {
    if (!element) return;
    const [c1, c2, c3, c4, c5] = getNicknameGradientPaletteStops(palette);
    element.style.setProperty('--nickname-gradient-c1', c1);
    element.style.setProperty('--nickname-gradient-c2', c2);
    element.style.setProperty('--nickname-gradient-c3', c3);
    element.style.setProperty('--nickname-gradient-c4', c4);
    element.style.setProperty('--nickname-gradient-c5', c5);
}

function applyGradientToNameElement(element, email) {
    if (!element) return;
    const profileData = getUserProfileDataByEmail(email || '');
    const canShowGradient = document.documentElement.classList.contains('nickname-gradient-on') && Boolean(profileData.nicknameGradientEnabled);
    element.classList.toggle('nickname-gradient-active', canShowGradient);
    if (canShowGradient) {
        applyNicknameGradientVarsToElement(element, profileData.nicknameGradientPalette);
    } else {
        element.style.removeProperty('--nickname-gradient-c1');
        element.style.removeProperty('--nickname-gradient-c2');
        element.style.removeProperty('--nickname-gradient-c3');
        element.style.removeProperty('--nickname-gradient-c4');
        element.style.removeProperty('--nickname-gradient-c5');
    }
}

function renderDisplayNameWithGradient(displayName, email) {
    const safeName = escapeHtml(displayName || 'Пользователь');
    const profileData = getUserProfileDataByEmail(email || '');
    const canShowGradient = document.documentElement.classList.contains('nickname-gradient-on') && Boolean(profileData.nicknameGradientEnabled);
    if (!canShowGradient) return safeName;
    const [c1, c2, c3, c4, c5] = getNicknameGradientPaletteStops(profileData.nicknameGradientPalette);
    return `<span class="nickname-gradient-active" style="--nickname-gradient-c1:${c1};--nickname-gradient-c2:${c2};--nickname-gradient-c3:${c3};--nickname-gradient-c4:${c4};--nickname-gradient-c5:${c5};">${safeName}</span>`;
}

function bindNicknameGradientSettings() {
    const bindToggle = (input) => {
        if (!input || input.dataset.bound === '1') return;

        input.addEventListener('change', () => {
            if (!currentUserEmail) return;
            if (!hasMargeletBoost(currentUserEmail)) {
                input.checked = false;
                localStorage.setItem(getNicknameGradientKey(currentUserEmail), '0');
                applyNicknameGradientEnabled(false);
                alert('Градиент ника доступен только с подпиской Margelet Boost.');
                return;
            }
            const enabled = Boolean(input.checked);
            localStorage.setItem(getNicknameGradientKey(currentUserEmail), enabled ? '1' : '0');
            applyNicknameGradientEnabled(enabled);

            const users = getLocalUsersSafe();
            const userIndex = users.findIndex((user) => normalizeEmail(user.email) === normalizeEmail(currentUserEmail));
            if (userIndex !== -1) {
                users[userIndex] = {
                    ...users[userIndex],
                    nicknameGradientEnabled: enabled
                };
                saveLocalUsersSafe(users);
                invalidateUsersDirectoryCache();
            }

            void syncCurrentUserProfileToSupabase();
            createUsernameDisplay();
            scheduleChatAreaUpdate({ skipRemoteRefresh: true });
        });

        input.dataset.bound = '1';
    };

    bindToggle(settingNicknameGradientInput);
    bindToggle(editNicknameGradientInput);

    if (editNicknameGradientPaletteSelect && editNicknameGradientPaletteSelect.dataset.bound !== '1') {
        editNicknameGradientPaletteSelect.addEventListener('change', () => {
            if (!currentUserEmail) return;
            if (!hasMargeletBoost(currentUserEmail)) {
                editNicknameGradientPaletteSelect.value = getNicknameGradientPalette(currentUserEmail);
                alert('Палитра ника доступна только с подпиской Margelet Boost.');
                return;
            }
            const palette = normalizeNicknameGradientPalette(editNicknameGradientPaletteSelect.value);
            localStorage.setItem(getNicknameGradientPaletteKey(currentUserEmail), palette);
            applyNicknameGradientPalette(palette);

            const users = getLocalUsersSafe();
            const userIndex = users.findIndex((user) => normalizeEmail(user.email) === normalizeEmail(currentUserEmail));
            if (userIndex !== -1) {
                users[userIndex] = {
                    ...users[userIndex],
                    nicknameGradientPalette: palette
                };
                saveLocalUsersSafe(users);
                invalidateUsersDirectoryCache();
            }

            void syncCurrentUserProfileToSupabase();
            createUsernameDisplay();
            scheduleChatAreaUpdate({ skipRemoteRefresh: true });
        });
        editNicknameGradientPaletteSelect.dataset.bound = '1';
    }
}

function getMembershipKey() {
    return 'margeletMembership_' + normalizeEmail(currentUserEmail || 'guest');
}

function getMembershipState() {
    const defaults = { gold: false, business: false };
    try {
        const parsed = JSON.parse(localStorage.getItem(getMembershipKey()) || '{}');
        return { ...defaults, ...(parsed || {}) };
    } catch (_error) {
        return defaults;
    }
}

function hasMargeletBoost(email = currentUserEmail) {
    const normalized = normalizeEmail(email || '');
    if (!normalized) return false;

    if (normalized === normalizeEmail(currentUserEmail || '')) {
        return Boolean(getMembershipState().gold);
    }

    const userRecord = getUserRecordByEmail(normalized);
    return Boolean(userRecord?.hasGold || userRecord?.premium_gold);
}

function saveMembershipState(nextState) {
    localStorage.setItem(getMembershipKey(), JSON.stringify(nextState || {}));
}

function isGoldBadgeVisible() {
    const state = getMembershipState();
    if (!state.gold) return false;
    const stored = localStorage.getItem('margeletGoldBadgeVisible_' + normalizeEmail(currentUserEmail || 'guest'));
    return stored !== '0';
}

function setGoldBadgeVisible(value) {
    localStorage.setItem('margeletGoldBadgeVisible_' + normalizeEmail(currentUserEmail || 'guest'), value ? '1' : '0');
}

function getGoldBadgeStyle() {
    const raw = String(localStorage.getItem('margeletGoldBadgeStyle_' + normalizeEmail(currentUserEmail || 'guest')) || 'aurora').trim();
    const allowed = new Set(['aurora', 'crown', 'diamond']);
    return allowed.has(raw) ? raw : 'aurora';
}

function setGoldBadgeStyle(style) {
    const allowed = new Set(['aurora', 'crown', 'diamond']);
    const next = allowed.has(style) ? style : 'aurora';
    localStorage.setItem('margeletGoldBadgeStyle_' + normalizeEmail(currentUserEmail || 'guest'), next);
}

function updateBusinessMenuVisibility() {
    const state = getMembershipState();
    const connectBusinessItem = document.getElementById('connect-business-from-menu');
    if (connectBusinessItem) {
        connectBusinessItem.style.display = state.business ? 'flex' : 'none';
    }
}

function updateMembershipUI() {
    const state = getMembershipState();

    if (premiumCard) {
        premiumCard.classList.toggle('active', Boolean(state.gold));
        const title = premiumCard.querySelector('.premium-title');
        if (title) {
            title.textContent = 'Margelet Boost';
        }
    }

    if (businessCard) {
        businessCard.classList.toggle('active', Boolean(state.business));
        const title = businessCard.querySelector('.premium-title');
        if (title) {
            title.textContent = 'Margelet Business';
        }
    }

    if (businessAccountBtn) {
        businessAccountBtn.style.display = state.business ? 'flex' : 'none';
    }

    updateBusinessMenuVisibility();

    if (editGoldBadgeVisibleInput) {
        editGoldBadgeVisibleInput.checked = isGoldBadgeVisible();
        const row = editGoldBadgeVisibleInput.closest('.editor-v4-row');
        if (row) row.style.display = state.gold ? 'block' : 'none';
    }
}

async function changePasswordInPrivacy(oldPassword, newPassword) {
    const oldValue = String(oldPassword || '');
    const newValue = String(newPassword || '');
    if (!currentUserEmail) {
        alert('Сначала войдите в аккаунт.');
        return;
    }
    if (oldValue.length < 6 || newValue.length < 6) {
        alert('Пароль должен быть не короче 6 символов.');
        return;
    }
    if (oldValue === newValue) {
        alert('Новый пароль должен отличаться от старого.');
        return;
    }

    const users = getLocalUsersSafe();
    const userIndex = users.findIndex(u => normalizeEmail(u.email) === normalizeEmail(currentUserEmail));
    if (userIndex === -1) {
        alert('Локальные данные аккаунта не найдены.');
        return;
    }

    const localStoredPassword = String(users[userIndex].password || '');
    if (localStoredPassword !== oldValue) {
        alert('Старый пароль введен неверно.');
        return;
    }

    const client = getSupabaseClient();
    if (client) {
        const { error: reAuthError } = await client.auth.signInWithPassword({
            email: currentUserEmail,
            password: oldValue
        });
        if (reAuthError) {
            alert('Старый пароль введен неверно.');
            return;
        }

        const { error: updateError } = await client.auth.updateUser({ password: newValue });
        if (updateError) {
            alert('Не удалось обновить пароль: ' + updateError.message);
            return;
        }
    }

    users[userIndex].password = newValue;
    const saved = saveLocalUsersSafe(users);
    if (!saved) {
        alert('Не удалось сохранить новый пароль локально.');
        return;
    }

    alert('Пароль успешно обновлен.');
    if (privacyPasswordForm) privacyPasswordForm.reset();
    if (privacyPasswordPanel) privacyPasswordPanel.style.display = 'none';
}

function getLoginPinKey(email = currentUserEmail) {
    return 'loginPin_' + normalizeEmail(email || 'guest');
}

function getLoginPinForUser(email = currentUserEmail) {
    const normalized = normalizeEmail(email || '');
    if (!normalized) return '';
    const fromLocal = String(localStorage.getItem(getLoginPinKey(normalized)) || '').trim();
    if (/^\d{4}$/.test(fromLocal)) return fromLocal;
    const user = getUserRecordByEmail(normalized);
    const fromRecord = String(user?.loginPin || '').trim();
    return /^\d{4}$/.test(fromRecord) ? fromRecord : '';
}

function setPrivacyVisibilityForCurrentUser(field, value) {
    if (!currentUserEmail) return;
    const normalizedField = String(field || '').toLowerCase();
    if (!normalizedField) return;
    const normalizedValue = normalizePrivacyVisibilityValue(value, normalizedField === 'email' ? 'contacts' : 'all');
    localStorage.setItem(getPrivacyVisibilityKey(normalizedField, currentUserEmail), normalizedValue);
}

function loadPrivacySettingsUI() {
    const fields = ['email', 'phone', 'avatar', 'status', 'birthday'];
    fields.forEach((field) => {
        const value = getPrivacyVisibilityForUser(field, currentUserEmail);
        privacyVisibilityOptions.forEach((btn) => {
            if (btn.dataset.field !== field) return;
            btn.classList.toggle('active', btn.dataset.value === value);
        });
        const switchEl = document.querySelector(`.privacy-visibility-switch [data-field="${field}"]`)?.closest('.privacy-visibility-switch');
        if (switchEl) switchEl.classList.remove('expanded');
    });
}

function bindPrivacyVisibilityHandlers() {
    if (!document.body.dataset.privacyOutsideBound) {
        document.addEventListener('click', (event) => {
            if (event.target.closest('.privacy-visibility-switch')) return;
            document.querySelectorAll('.privacy-visibility-switch.expanded').forEach((el) => {
                el.classList.remove('expanded');
                const row = el.closest('.privacy-visibility-row');
                if (row) row.classList.remove('privacy-row-expanded');
            });
        });
        document.body.dataset.privacyOutsideBound = '1';
    }

    privacyVisibilityOptions.forEach((btn) => {
        if (btn.dataset.bound === '1') return;
        btn.addEventListener('click', async (event) => {
            event.stopPropagation();
            const switchEl = btn.closest('.privacy-visibility-switch');
            const field = String(btn.dataset.field || '').toLowerCase();
            const value = String(btn.dataset.value || '').toLowerCase();
            if (!field) return;

            if (btn.classList.contains('active') && switchEl && !switchEl.classList.contains('expanded')) {
                document.querySelectorAll('.privacy-visibility-switch.expanded').forEach((el) => {
                    if (el !== switchEl) {
                        el.classList.remove('expanded');
                        const row = el.closest('.privacy-visibility-row');
                        if (row) row.classList.remove('privacy-row-expanded');
                    }
                });
                switchEl.classList.add('expanded');
                const row = switchEl.closest('.privacy-visibility-row');
                if (row) row.classList.add('privacy-row-expanded');
                return;
            }

            setPrivacyVisibilityForCurrentUser(field, value);
            loadPrivacySettingsUI();
            if (switchEl) {
                switchEl.classList.remove('expanded');
                const row = switchEl.closest('.privacy-visibility-row');
                if (row) row.classList.remove('privacy-row-expanded');
            }
            await syncCurrentUserProfileToSupabase();
        });
        btn.dataset.bound = '1';
    });
}

async function changeEmailInPrivacy(newEmailRaw) {
    const newEmail = normalizeEmail(newEmailRaw);
    if (!currentUserEmail) {
        alert('Сначала войдите в аккаунт.');
        return;
    }
    if (!newEmail || !newEmail.includes('@')) {
        alert('Введите корректную почту.');
        return;
    }
    if (newEmail === normalizeEmail(currentUserEmail)) {
        alert('Это уже ваша текущая почта.');
        return;
    }

    const oldEmail = normalizeEmail(currentUserEmail);
    const client = getSupabaseClient();
    if (client) {
        const { error } = await client.auth.updateUser({ email: newEmail });
        if (error) {
            alert('Не удалось изменить почту: ' + error.message);
            return;
        }
    }

    const users = getLocalUsersSafe();
    const userIndex = users.findIndex((u) => normalizeEmail(u.email) === oldEmail);
    if (userIndex !== -1) {
        users[userIndex] = { ...users[userIndex], email: newEmail };
        saveLocalUsersSafe(users);
    }

    const copyKey = (prefix) => {
        const oldKey = prefix + oldEmail;
        const newKey = prefix + newEmail;
        const value = localStorage.getItem(oldKey);
        if (value !== null) {
            localStorage.setItem(newKey, value);
        }
    };

    ['userDisplayName_', 'userName_', 'userPhone_', 'userBirthday_', 'userStatus_', 'userAvatar_', 'glowColor_', 'glowAnimation_', 'avatarParticleAnimation_', 'avatarAnimationEnabled_', 'avatarGlowEnabled_', 'margeletMembership_', 'margeletGoldBadgeVisible_', 'margeletGoldBadgeStyle_', 'margeletContacts_', 'margeletBlockedUsers_', 'deviceSessions_'].forEach(copyKey);

    ['email', 'phone', 'avatar', 'status', 'birthday'].forEach((field) => {
        const oldKey = getPrivacyVisibilityKey(field, oldEmail);
        const nextKey = getPrivacyVisibilityKey(field, newEmail);
        const value = localStorage.getItem(oldKey);
        if (value !== null) localStorage.setItem(nextKey, value);
    });

    const oldPin = localStorage.getItem(getLoginPinKey(oldEmail));
    if (oldPin !== null) {
        localStorage.setItem(getLoginPinKey(newEmail), oldPin);
    }

    removeAccount(oldEmail);
    currentUserEmail = newEmail;
    localStorage.setItem('currentUserEmail', currentUserEmail);
    addAccountToLoggedList(currentUserEmail);
    upsertUserInLocalDirectory(currentUserEmail);
    invalidateUsersDirectoryCache();
    await syncCurrentUserProfileToSupabase();

    if (privacyEmailForm) privacyEmailForm.reset();
    if (privacyEmailPanel) privacyEmailPanel.style.display = 'none';
    updateDisplayData();

    alert('Почта обновлена.');
}

async function saveLoginPinInPrivacy(pinRaw) {
    const pin = String(pinRaw || '').trim();
    if (!/^\d{4}$/.test(pin)) {
        alert('Код должен состоять из 4 цифр.');
        return;
    }
    if (!currentUserEmail) {
        alert('Сначала войдите в аккаунт.');
        return;
    }

    localStorage.setItem(getLoginPinKey(currentUserEmail), pin);

    const users = getLocalUsersSafe();
    const userIndex = users.findIndex((u) => normalizeEmail(u.email) === normalizeEmail(currentUserEmail));
    if (userIndex !== -1) {
        users[userIndex] = { ...users[userIndex], loginPin: pin };
        saveLocalUsersSafe(users);
    }

    await syncCurrentUserProfileToSupabase();

    if (privacyPinForm) privacyPinForm.reset();
    if (privacyPinPanel) privacyPinPanel.style.display = 'none';
    alert('Дополнительный код сохранен.');
}

function verifyAdditionalPinForEmail(email) {
    const pin = getLoginPinForUser(email);
    if (!pin) return true;

    const entered = prompt('Введите дополнительный 4-значный код входа');
    if (entered === null) return false;
    return String(entered).trim() === pin;
}

async function hydrateLoginPinForEmailFromSupabase(email) {
    const client = getSupabaseClient();
    const normalized = normalizeEmail(email || '');
    if (!client || !normalized || !supabaseProfilesTableAvailable) return;

    try {
        const { data, error } = await client
            .from('profiles')
            .select('login_pin')
            .eq('email', normalized)
            .maybeSingle();

        if (error) {
            const details = String(error?.details || '').toLowerCase();
            const message = String(error?.message || '').toLowerCase();
            const missingPinColumn = details.includes('login_pin') || message.includes('login_pin');
            if (missingPinColumn || isSupabaseProfilesTableMissing(error)) {
                return;
            }
            return;
        }

        const pin = String(data?.login_pin || '').trim();
        if (/^\d{4}$/.test(pin)) {
            localStorage.setItem(getLoginPinKey(normalized), pin);
        }
    } catch (_error) {
        // non-blocking helper
    }
}

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
const editEmailVisibility = document.getElementById('edit-email-visibility');
const editEmailVisibilitySwitch = document.getElementById('edit-email-visibility-switch');

// Элементы для редактирования аватара
const editAvatarDisplay = document.getElementById('edit-avatar-display');
const editChangeAvatarBtn = document.getElementById('edit-change-avatar-btn');
const editCountryPicker = document.getElementById('edit-country-picker');
const editCurrentFlag = document.getElementById('edit-current-flag');
const editCurrentCode = document.getElementById('edit-current-code');
const editStatusCounter = document.getElementById('edit-status-counter');
const editUsernameHint = document.getElementById('edit-username-hint');
const editGenerateUsernameBtn = document.getElementById('edit-generate-username-btn');
const editResetBtn = document.getElementById('edit-reset-btn');
const editCancelBottomBtn = document.getElementById('edit-cancel-bottom-btn');
const editSaveBottomBtn = document.getElementById('edit-save-bottom-btn');
const editAvatarAnimationEnabledInput = document.getElementById('edit-avatar-animation-enabled');
const editAvatarGlowEnabledInput = document.getElementById('edit-avatar-glow-enabled');
const editAvatarAnimationSelect = document.getElementById('edit-avatar-animation');

let editSnapshot = null;

function getAvatarAnimationEnabled(email = currentUserEmail) {
    const normalized = normalizeEmail(email || '');
    if (!normalized) return false;
    if (!hasMargeletBoost(normalized)) return false;

    const raw = localStorage.getItem('avatarAnimationEnabled_' + normalized);
    if (raw !== null) return raw !== '0';

    // Backward compatibility with old single switch.
    const legacy = localStorage.getItem('avatarEffectsEnabled_' + normalized);
    if (legacy !== null) return legacy !== '0';

    return false;
}

function getAvatarGlowEnabled(email = currentUserEmail) {
    const normalized = normalizeEmail(email || '');
    if (!normalized) return false;
    if (!hasMargeletBoost(normalized)) return false;

    const raw = localStorage.getItem('avatarGlowEnabled_' + normalized);
    if (raw !== null) return raw !== '0';

    // Backward compatibility with old single switch.
    const legacy = localStorage.getItem('avatarEffectsEnabled_' + normalized);
    if (legacy !== null) return legacy !== '0';

    return false;
}

function applyAvatarAnimationEnabled(enabled) {
    const isEnabled = Boolean(enabled);
    document.documentElement.classList.toggle('avatar-animation-off', !isEnabled);
    if (isEnabled) return;
    avatarParticleStates.forEach((state) => {
        if (!state || !state.ctx) return;
        state.ctx.clearRect(0, 0, state.width || 0, state.height || 0);
    });
}

function applyAvatarGlowEnabled(enabled) {
    const isEnabled = Boolean(enabled);
    document.documentElement.classList.toggle('avatar-glow-off', !isEnabled);
}

function setEmailVisibilityValue(nextValue = 'contacts') {
    const value = nextValue === 'nobody' ? 'nobody' : 'contacts';
    if (editEmailVisibility) {
        editEmailVisibility.value = value;
    }

    if (!editEmailVisibilitySwitch) return;
    editEmailVisibilitySwitch.querySelectorAll('.edit-visibility-option').forEach((btn) => {
        btn.classList.toggle('active', btn.getAttribute('data-value') === value);
    });
}

function getEmailVisibilityValue() {
    const value = editEmailVisibility?.value;
    return value === 'nobody' ? 'nobody' : 'contacts';
}

function sanitizeUsernameInput(value = '') {
    return String(value)
        .trim()
        .replace(/^@+/, '')
        .toLowerCase()
        .replace(/[^a-z0-9_.]/g, '')
        .replace(/\.{2,}/g, '.')
        .replace(/_{2,}/g, '_')
        .slice(0, 30);
}

function generateUsernameFromName(value = '') {
    const base = sanitizeUsernameInput(
        String(value)
            .trim()
            .toLowerCase()
            .replace(/\s+/g, '_')
    );

    if (base) return base;
    return `user${Math.floor(Math.random() * 9000) + 1000}`;
}

function isUsernameValid(value = '') {
    return /^[a-z0-9_.]{3,30}$/.test(value);
}

function updateEditPreview() {
    const usernameSanitized = sanitizeUsernameInput(editUsername?.value || '');

    if (editStatusCounter && editStatus) {
        editStatusCounter.textContent = `${editStatus.value.length}/100`;
    }

    if (editUsernameHint) {
        if (!usernameSanitized) {
            editUsernameHint.textContent = 'Только латиница, цифры, _ и .';
            editUsernameHint.classList.remove('invalid');
        } else if (!isUsernameValid(usernameSanitized)) {
            editUsernameHint.textContent = 'Username: от 3 до 30 символов.';
            editUsernameHint.classList.add('invalid');
        } else {
            editUsernameHint.textContent = 'Username корректный.';
            editUsernameHint.classList.remove('invalid');
        }
    }

    if (editUsername && editUsername.value !== usernameSanitized) {
        editUsername.value = usernameSanitized;
    }
}

function refreshEditPreviewAvatar() {
    return;
}

function formatRuPhone(value = '') {
    let digits = String(value).replace(/\D/g, '');
    if (!digits) return '';

    // В поле ввода скрываем код страны и оставляем только 10 цифр номера.
    if (digits.length >= 11 && (digits.startsWith('7') || digits.startsWith('8'))) {
        digits = digits.slice(1);
    }
    digits = digits.slice(0, 10);

    const p1 = digits.slice(0, 3);
    const p2 = digits.slice(3, 6);
    const p3 = digits.slice(6, 8);
    const p4 = digits.slice(8, 10);

    let result = '';
    if (p1) result += `(${p1}`;
    if (p1.length === 3) result += ')';
    if (p2) result += ` ${p2}`;
    if (p3) result += `-${p3}`;
    if (p4) result += `-${p4}`;
    return result.trim();
}

function sanitizePhoneForStorage(value = '') {
    let digits = String(value).replace(/\D/g, '');
    if (!digits) return '';
    if (digits.startsWith('8')) digits = '7' + digits.slice(1);
    if (!digits.startsWith('7')) digits = '7' + digits;
    return digits.slice(0, 11);
}

function formatStoredPhoneForDisplay(value = '', showCountryCode = false) {
    let digits = sanitizePhoneForStorage(value);
    if (!digits) return '';

    if (digits.startsWith('7')) {
        digits = digits.slice(1);
    }

    const p1 = digits.slice(0, 3);
    const p2 = digits.slice(3, 6);
    const p3 = digits.slice(6, 8);
    const p4 = digits.slice(8, 10);

    let result = '';
    if (p1) result += `(${p1}`;
    if (p1.length === 3) result += ')';
    if (p2) result += ` ${p2}`;
    if (p3) result += `-${p3}`;
    if (p4) result += `-${p4}`;
    return showCountryCode ? `+7 ${result}`.trim() : result.trim();
}

function applyEditPhoneMask() {
    if (!editPhone) return;
    const formatted = formatRuPhone(editPhone.value || '');
    if (editPhone.value !== formatted) {
        editPhone.value = formatted;
    }
}

function enforceEditCountryCode() {
    if (editCurrentFlag) editCurrentFlag.textContent = 'RU';
    if (editCurrentCode) {
        const hasDigits = String(editPhone?.value || '').replace(/\D/g, '').length > 0;
        editCurrentCode.textContent = hasDigits ? '+7' : '';
    }
}

function captureEditSnapshot() {
    editSnapshot = {
        displayName: editDisplayName?.value || '',
        username: sanitizeUsernameInput(editUsername?.value || ''),
        phone: editPhone?.value || '',
        birthday: editBirthday?.value || '',
        status: editStatus?.value || '',
        emailVisibility: getEmailVisibilityValue()
    };
}

function restoreEditSnapshot() {
    if (!editSnapshot) return;
    if (editDisplayName) editDisplayName.value = editSnapshot.displayName;
    if (editUsername) editUsername.value = editSnapshot.username;
    if (editPhone) editPhone.value = editSnapshot.phone;
    if (editBirthday) editBirthday.value = editSnapshot.birthday;
    if (editStatus) editStatus.value = editSnapshot.status;
    setEmailVisibilityValue(editSnapshot.emailVisibility || 'contacts');
    updateEditPreview();
}

function initEditProfileEnhancedUX() {
    const boundFlag = 'editUxBound';
    if (editDisplayName && !editDisplayName.dataset[boundFlag]) {
        [editDisplayName, editUsername, editStatus].forEach(el => {
            if (!el) return;
            el.addEventListener('input', updateEditPreview);
        });

        editDisplayName.dataset[boundFlag] = '1';
    }

    if (editGenerateUsernameBtn && !editGenerateUsernameBtn.dataset.bound) {
        editGenerateUsernameBtn.addEventListener('click', () => {
            if (!editUsername) return;
            editUsername.value = generateUsernameFromName(editDisplayName?.value || '');
            updateEditPreview();
        });
        editGenerateUsernameBtn.dataset.bound = '1';
    }

    if (editResetBtn && !editResetBtn.dataset.bound) {
        editResetBtn.addEventListener('click', restoreEditSnapshot);
        editResetBtn.dataset.bound = '1';
    }

    if (editPhone && !editPhone.dataset.boundMask) {
        editPhone.addEventListener('input', () => {
            applyEditPhoneMask();
            enforceEditCountryCode();
        });
        editPhone.dataset.boundMask = '1';
    }

    if (editEmailVisibilitySwitch && !editEmailVisibilitySwitch.dataset.bound) {
        editEmailVisibilitySwitch.addEventListener('click', (event) => {
            const optionBtn = event.target.closest('.edit-visibility-option');
            if (!optionBtn) return;
            setEmailVisibilityValue(optionBtn.getAttribute('data-value') || 'contacts');
        });
        editEmailVisibilitySwitch.dataset.bound = '1';
    }

    enforceEditCountryCode();
    applyEditPhoneMask();

    if (editCancelBottomBtn && !editCancelBottomBtn.dataset.bound) {
        editCancelBottomBtn.addEventListener('click', () => {
            restoreEditSnapshot();
            goToScreen('screen-profile');
        });
        editCancelBottomBtn.dataset.bound = '1';
    }

    if (editSaveBottomBtn && !editSaveBottomBtn.dataset.bound) {
        editSaveBottomBtn.addEventListener('click', saveEditData);
        editSaveBottomBtn.dataset.bound = '1';
    }
}

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
    createUsernameDisplay();
    
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
    const savedAvatarAnimation = getAvatarParticleAnimationType();
    const hasBoost = hasMargeletBoost(currentUserEmail);
    const savedAvatarAnimationEnabled = hasBoost ? getAvatarAnimationEnabled() : false;
    const savedAvatarGlowEnabled = hasBoost ? getAvatarGlowEnabled() : false;
    const savedNicknameGradientEnabled = hasBoost ? getNicknameGradientEnabled() : false;
    const savedNicknameGradientPalette = getNicknameGradientPalette();
    const savedEmailVisibility = getEmailVisibilityForUser(currentUserEmail);
    
    if (editDisplayName) editDisplayName.value = savedDisplayName || '';
    if (editUsername) editUsername.value = sanitizeUsernameInput(savedUsername || '');
    if (editPhone) editPhone.value = formatStoredPhoneForDisplay(savedPhone || '', false);
    if (editBirthday) editBirthday.value = savedBirthday || '';
    if (editStatus) editStatus.value = savedStatus || '';
    if (editGoldBadgeVisibleInput) {
        editGoldBadgeVisibleInput.checked = isGoldBadgeVisible();
        const row = editGoldBadgeVisibleInput.closest('.editor-v4-row');
        if (row) row.style.display = getMembershipState().gold ? 'block' : 'none';
    }
    if (editAvatarAnimationEnabledInput) {
        editAvatarAnimationEnabledInput.checked = savedAvatarAnimationEnabled;
        editAvatarAnimationEnabledInput.disabled = !hasBoost;
    }
    if (editAvatarGlowEnabledInput) {
        editAvatarGlowEnabledInput.checked = savedAvatarGlowEnabled;
        editAvatarGlowEnabledInput.disabled = !hasBoost;
    }
    if (editNicknameGradientInput) {
        editNicknameGradientInput.checked = savedNicknameGradientEnabled;
        editNicknameGradientInput.disabled = !hasBoost;
    }
    if (editNicknameGradientPaletteSelect) {
        editNicknameGradientPaletteSelect.value = savedNicknameGradientPalette;
        editNicknameGradientPaletteSelect.disabled = !hasBoost;
    }
    setEmailVisibilityValue(savedEmailVisibility);
    
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
    applyAvatarParticleAnimationType(savedAvatarAnimation);
    applyAvatarAnimationEnabled(savedAvatarAnimationEnabled);
    applyAvatarGlowEnabled(savedAvatarGlowEnabled);

    refreshEditPreviewAvatar();
    enforceEditCountryCode();
    applyEditPhoneMask();
    updateEditPreview();
    captureEditSnapshot();
    initEditProfileEnhancedUX();
}

// Функция сохранения данных из формы редактирования
function saveEditData() {
    if (!currentUserEmail) return;
    const hasBoost = hasMargeletBoost(currentUserEmail);
    
    if (editDisplayName) localStorage.setItem('userDisplayName_' + currentUserEmail, editDisplayName.value);
    
    // Сохраняем username без @, но при отображении будем добавлять @
    let usernameValue = sanitizeUsernameInput(editUsername?.value || '');
    if (usernameValue && !isUsernameValid(usernameValue)) {
        alert('Username должен быть от 3 до 30 символов и содержать только латиницу, цифры, _ или .');
        return;
    }
    if (usernameValue.startsWith('@')) {
        usernameValue = usernameValue.substring(1);
    }
    if (editUsername) editUsername.value = usernameValue;
    if (editUsername) localStorage.setItem('userName_' + currentUserEmail, usernameValue);
    
    if (editPhone) {
        applyEditPhoneMask();
        const normalizedPhone = sanitizePhoneForStorage(editPhone.value || '');
        localStorage.setItem('userPhone_' + currentUserEmail, normalizedPhone);
        editPhone.value = formatStoredPhoneForDisplay(normalizedPhone, false);
    }

    if (editGoldBadgeVisibleInput) {
        setGoldBadgeVisible(Boolean(editGoldBadgeVisibleInput.checked));
    }
    if (editAvatarAnimationEnabledInput) {
        const animationEnabled = hasBoost ? Boolean(editAvatarAnimationEnabledInput.checked) : false;
        localStorage.setItem('avatarAnimationEnabled_' + currentUserEmail, animationEnabled ? '1' : '0');
        applyAvatarAnimationEnabled(animationEnabled);
    }
    if (editAvatarGlowEnabledInput) {
        const glowEnabled = hasBoost ? Boolean(editAvatarGlowEnabledInput.checked) : false;
        localStorage.setItem('avatarGlowEnabled_' + currentUserEmail, glowEnabled ? '1' : '0');
        applyAvatarGlowEnabled(glowEnabled);
    }
    if (editAvatarAnimationSelect) {
        const selectedAnimation = normalizeAvatarParticleAnimation(editAvatarAnimationSelect.value);
        localStorage.setItem('avatarParticleAnimation_' + currentUserEmail, selectedAnimation);
        applyAvatarParticleAnimationType(selectedAnimation);
    }
    if (editNicknameGradientInput) {
        const nicknameGradientEnabled = hasBoost ? Boolean(editNicknameGradientInput.checked) : false;
        localStorage.setItem(getNicknameGradientKey(currentUserEmail), nicknameGradientEnabled ? '1' : '0');
        applyNicknameGradientEnabled(nicknameGradientEnabled);
    }
    if (editNicknameGradientPaletteSelect) {
        const palette = normalizeNicknameGradientPalette(editNicknameGradientPaletteSelect.value);
        localStorage.setItem(getNicknameGradientPaletteKey(currentUserEmail), palette);
        applyNicknameGradientPalette(palette);
    }
    if (editBirthday) localStorage.setItem('userBirthday_' + currentUserEmail, editBirthday.value);
    if (editStatus) localStorage.setItem('userStatus_' + currentUserEmail, editStatus.value);
    const visibility = getEmailVisibilityValue();
    localStorage.setItem(getEmailVisibilityKey(currentUserEmail), visibility);
    
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
            glowColor: localStorage.getItem('glowColor_' + currentUserEmail) || existingUser.glowColor || 'gradient',
            nicknameGradientEnabled: hasBoost && localStorage.getItem(getNicknameGradientKey(currentUserEmail)) === '1',
            nicknameGradientPalette: normalizeNicknameGradientPalette(localStorage.getItem(getNicknameGradientPaletteKey(currentUserEmail)) || existingUser.nicknameGradientPalette || ''),
            avatarParticleAnimation: normalizeAvatarParticleAnimation(localStorage.getItem('avatarParticleAnimation_' + currentUserEmail) || existingUser.avatarParticleAnimation || existingUser.avatarAnimation || ''),
            avatarAnimationEnabled: hasBoost && localStorage.getItem('avatarAnimationEnabled_' + currentUserEmail) !== '0',
            avatarGlowEnabled: hasBoost && localStorage.getItem('avatarGlowEnabled_' + currentUserEmail) !== '0',
            glowAnimation: normalizeGlowAnimation(localStorage.getItem('glowAnimation_' + currentUserEmail) || existingUser.glowAnimation || ''),
            emailVisibility: getEmailVisibilityForUser(currentUserEmail)
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
    captureEditSnapshot();
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
        renderStoriesListForUser(currentUserEmail, 'profile-stories-list');
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
        restoreEditSnapshot();
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

if (marketBtn) {
    marketBtn.addEventListener('click', goToMarketScreen);
}

// Обработчик кнопки "Business Account"
if (businessAccountBtn) {
    businessAccountBtn.addEventListener('click', () => {
        const membership = getMembershipState();
        if (!membership.business) {
            alert('Сначала подключите Margelet Business в настройках.');
            return;
        }
        alert('Business account подключен и готов к использованию.');
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
                refreshEditPreviewAvatar();
            };
            reader.readAsDataURL(file);
        }
    });
}

if (navAddStoryBtn && profileStoryUpload) {
    navAddStoryBtn.addEventListener('click', () => {
        if (!document.documentElement.classList.contains('own-profile-open')) return;
        profileStoryUpload.click();
    });

    profileStoryUpload.addEventListener('change', (e) => {
        const file = e.target.files?.[0];
        if (!file || !currentUserEmail) return;

        const reader = new FileReader();
        reader.onload = async (event) => {
            const mediaDataUrl = String(event.target?.result || '');
            if (!mediaDataUrl) return;

            const ok = await publishStory(mediaDataUrl);
            if (!ok) return;

            await renderStoriesListForUser(currentUserEmail, 'profile-stories-list');
        };
        reader.readAsDataURL(file);
        profileStoryUpload.value = '';
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

function findLocalUserByLoginIdentifier(loginIdentifier = '') {
    const raw = String(loginIdentifier || '').trim();
    if (!raw) return null;

    const normalizedEmail = normalizeEmail(raw);
    const normalizedUsername = normalizeUsername(raw);
    const normalizedPhone = normalizePhone(raw);
    const users = getLocalUsersSafe();

    return users.find((u) => {
        if (normalizedEmail && normalizeEmail(u.email) === normalizedEmail) return true;
        if (normalizedUsername && normalizeUsername(u.username || '') === normalizedUsername) return true;
        if (normalizedPhone && normalizePhone(u.phone || '') === normalizedPhone) return true;
        return false;
    }) || null;
}

function tryLegacyLocalLogin(loginIdentifier, password) {
    const user = findLocalUserByLoginIdentifier(loginIdentifier);
    const normalizedEmail = normalizeEmail(user?.email || '');
    const users = getLocalUsersSafe();
    const matched = users.find(u => normalizeEmail(u.email) === normalizedEmail && u.password === password);
    if (!matched) return false;

    if (!verifyAdditionalPinForEmail(normalizedEmail)) {
        alert('Дополнительный код введен неверно.');
        return false;
    }

    completeSuccessfulLogin(normalizeEmail(matched.email), matched.name || '');
    return true;
}

function getLegacyLocalUserByEmail(email) {
    const normalizedEmail = normalizeEmail(email);
    const users = getLocalUsersSafe();
    return users.find(u => normalizeEmail(u.email) === normalizedEmail) || null;
}

async function resolveSupabaseLoginIdentifierToEmail(loginIdentifierRaw = '') {
    const loginIdentifier = String(loginIdentifierRaw || '').trim();
    if (!loginIdentifier) return '';

    const asEmail = normalizeEmail(loginIdentifier);
    if (asEmail.includes('@')) return asEmail;

    const client = getSupabaseClient();
    if (!client) return '';

    const username = normalizeUsername(loginIdentifier);
    const phoneDigits = normalizePhone(loginIdentifier);

    if (username) {
        const { data, error } = await client
            .from('profiles')
            .select('email')
            .eq('username', username)
            .limit(1)
            .maybeSingle();
        if (!error && data?.email) {
            return normalizeEmail(data.email);
        }
    }

    if (phoneDigits) {
        const { data, error } = await client
            .from('profiles')
            .select('email, phone')
            .limit(1000);

        if (!error && Array.isArray(data)) {
            const row = data.find(item => normalizePhone(item?.phone || '') === phoneDigits);
            if (row?.email) {
                return normalizeEmail(row.email);
            }
        }
    }

    return '';
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
    const loginIdentifier = String(inputs[0].value || '').trim();
    const password = inputs[1].value;
    const legacyUserByEmail = findLocalUserByLoginIdentifier(loginIdentifier) || getLegacyLocalUserByEmail(loginIdentifier);
    let supabaseLoginErrorMessage = '';

    if (isSupabaseEnabled()) {
        try {
            const client = getSupabaseClient();
            const resolvedEmail = await resolveSupabaseLoginIdentifierToEmail(loginIdentifier);
            const loginEmail = normalizeEmail(resolvedEmail || loginIdentifier);
            const { data, error } = await client.auth.signInWithPassword({
                email: loginEmail,
                password
            });

            if (!error && data?.user?.email) {
                const supabaseEmail = normalizeEmail(data.user.email);
                const displayName =
                    data.user.user_metadata?.display_name ||
                    data.user.user_metadata?.name ||
                    getDisplayNameByEmail(supabaseEmail);

                await hydrateLoginPinForEmailFromSupabase(supabaseEmail);

                if (!verifyAdditionalPinForEmail(supabaseEmail)) {
                    alert('Дополнительный код введен неверно.');
                    await client.auth.signOut();
                    return;
                }

                completeSuccessfulLogin(supabaseEmail, displayName);

                syncSupabaseProfilesToLocalDirectory(true).catch(() => {
                    // Синхронизация справочника не должна блокировать вход.
                });
                return;
            }

            if (error) {
                supabaseLoginErrorMessage = String(error.message || '');
            }
        } catch (_error) {
            supabaseLoginErrorMessage = 'Network error';
        }
    }

    // Fallback для локальных legacy-аккаунтов.
    if (tryLegacyLocalLogin(loginIdentifier, password)) {
        if (legacyUserByEmail) {
            migrateLegacyUserToSupabase(legacyUserByEmail).catch(() => {
                // Миграция выполняется фоном и не должна мешать пользователю.
            });
        }
        return;
    }

    if (supabaseLoginErrorMessage) {
        const lower = supabaseLoginErrorMessage.toLowerCase();
        if (lower.includes('email not confirmed') || lower.includes('not confirmed')) {
            alert('Почта в Supabase еще не подтверждена. Подтвердите email и попробуйте снова.');
            return;
        }
    }

    alert('Аккаунт не найден (логин/email/телефон) или пароль неверный.');
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
    const headerTitle = document.querySelector('.header-title');
    const mainScreen = document.getElementById('screen-main');

    if (!chatArea || !chatForm || !messageInput) return;

    if (mainScreen) {
        mainScreen.classList.toggle('conversations-tab-active', activeMainSubmenuTab === 'conversations');
    }

    if (headerTitle) {
        const isEn = getCurrentLanguage() === 'en';
        if (activeMainSubmenuTab === 'communities') {
            headerTitle.textContent = isEn ? 'Communities' : 'Сообщества';
        } else if (activeMainSubmenuTab === 'conversations') {
            headerTitle.textContent = isEn ? 'Conversations' : 'Беседы';
        } else if (activeMainSubmenuTab === 'contacts') {
            headerTitle.textContent = isEn ? 'Contacts' : 'Контакты';
        } else {
            headerTitle.textContent = isEn ? 'Chats' : 'Чаты';
        }
    }

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

    if (activeMainSubmenuTab === 'contacts') {
        renderContactsList(chatArea);
        chatForm.classList.add('hidden');
        updateBottomNavigationVisibility();
        return;
    }

    if (activeMainSubmenuTab === 'communities') {
        renderCommunitiesList(chatArea);
        chatForm.classList.add('hidden');
        updateBottomNavigationVisibility();
        return;
    }

    const groupsOnly = activeMainSubmenuTab === 'conversations';

    if (activeConversationId) {
        const conversation = getConversationById(activeConversationId);
        const canShowConversation = Boolean(
            conversation
            && conversation.participants.includes(currentUserEmail)
            && (!groupsOnly || isGroupConversation(conversation))
        );
        if (canShowConversation) {
            renderConversationThread(chatArea, conversation);
            chatForm.classList.remove('hidden');
            updateBottomNavigationVisibility();
            return;
        }

        activeConversationId = null;
        activeThreadDom = null;
        lastRenderedConversationSignature = '';
    }

    renderConversationsList(chatArea, { groupsOnly });
    chatForm.classList.add('hidden');
    updateBottomNavigationVisibility();
}

async function fileToDataUrl(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = (event) => resolve(String(event.target?.result || ''));
        reader.onerror = () => reject(new Error('Не удалось прочитать файл'));
        reader.readAsDataURL(file);
    });
}

function buildCommunityVisualSeed(name = '') {
    const normalized = String(name || 'Community').trim() || 'Community';
    let hash = 0;
    for (let i = 0; i < normalized.length; i += 1) {
        hash = (hash * 31 + normalized.charCodeAt(i)) >>> 0;
    }
    const palettes = [
        ['#4e8cff', '#5f5bff'],
        ['#14b8a6', '#0ea5e9'],
        ['#f59e0b', '#ef4444'],
        ['#10b981', '#0ea5e9'],
        ['#ff7a59', '#ff4d8d']
    ];
    const palette = palettes[hash % palettes.length];
    return { text: normalized.charAt(0).toUpperCase(), colorA: palette[0], colorB: palette[1] };
}

function createDefaultAvatarDataUrl(name = '') {
    const seed = buildCommunityVisualSeed(name);
    const canvas = document.createElement('canvas');
    canvas.width = 240;
    canvas.height = 240;
    const ctx = canvas.getContext('2d');
    if (!ctx) return '';
    const gradient = ctx.createLinearGradient(0, 0, 240, 240);
    gradient.addColorStop(0, seed.colorA);
    gradient.addColorStop(1, seed.colorB);
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, 240, 240);
    ctx.fillStyle = 'rgba(255,255,255,0.92)';
    ctx.font = 'bold 124px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(seed.text || 'C', 120, 124);
    return canvas.toDataURL('image/png');
}

function createDefaultCoverDataUrl(name = '') {
    const seed = buildCommunityVisualSeed(name);
    const safeName = String(name || 'Community').replace(/[<>&"']/g, '');
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="520" viewBox="0 0 1200 520"><defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0%" stop-color="${seed.colorA}"/><stop offset="100%" stop-color="${seed.colorB}"/></linearGradient></defs><rect width="1200" height="520" fill="url(#g)"/><text x="70" y="430" fill="rgba(255,255,255,0.9)" font-size="74" font-family="Arial, sans-serif" font-weight="700">${safeName}</text></svg>`;
    return `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg)}`;
}

async function fetchOnlineCommunitiesBundle() {
    const client = getSupabaseClient();
    if (!client || !currentUserEmail) {
        return { communities: [], joinedSet: new Set() };
    }

    const [communitiesRes, membershipsRes, myMembershipsRes, postsRes] = await Promise.all([
        client.from('communities').select('*').order('created_at', { ascending: false }),
        client.from('community_memberships').select('community_id'),
        client.from('community_memberships').select('community_id').eq('member_email', normalizeEmail(currentUserEmail)),
        client.from('community_posts').select('*').order('created_at', { ascending: false })
    ]);

    if (communitiesRes.error) throw communitiesRes.error;
    if (membershipsRes.error) throw membershipsRes.error;
    if (myMembershipsRes.error) throw myMembershipsRes.error;
    if (postsRes.error) throw postsRes.error;

    const memberCounts = new Map();
    (membershipsRes.data || []).forEach((row) => {
        memberCounts.set(row.community_id, (memberCounts.get(row.community_id) || 0) + 1);
    });

    const postsByCommunity = new Map();
    (postsRes.data || []).forEach((row) => {
        const list = postsByCommunity.get(row.community_id) || [];
        list.push(row);
        postsByCommunity.set(row.community_id, list);
    });

    const joinedSet = new Set((myMembershipsRes.data || []).map((row) => row.community_id));

    const communities = (communitiesRes.data || []).map((community) => {
        const posts = postsByCommunity.get(community.id) || [];
        return {
            id: community.id,
            name: community.name,
            description: community.description || 'Описание сообщества',
            icon: String(community.name || 'C').trim().charAt(0).toUpperCase() || 'C',
            color: community.theme_color || 'linear-gradient(135deg,#4e8cff,#5f5bff)',
            image: community.cover_url || posts[0]?.image_url || '',
            avatarUrl: community.avatar_url || '',
            coverUrl: community.cover_url || '',
            ownerEmail: normalizeEmail(community.owner_email || ''),
            members: memberCounts.get(community.id) || 0,
            posts
        };
    });

    return { communities, joinedSet };
}

function renderCommunitiesList(chatArea) {
    if (!currentUserEmail) {
        chatArea.innerHTML = '<div class="no-chats-message">Сначала войдите в аккаунт</div>';
        return;
    }

    const recentKey = 'margeletRecentCommunities_' + normalizeEmail(currentUserEmail);
    const newsSnapshotKey = 'margeletNewsSnapshot_' + normalizeEmail(currentUserEmail);
    const communitiesTabKey = 'margeletCommunitiesActiveTab_' + normalizeEmail(currentUserEmail);
    const communitiesCacheKey = 'margeletCommunitiesCache_' + normalizeEmail(currentUserEmail);

    const canReuseMountedCommunities = Boolean(
        chatArea?.dataset?.communitiesMounted === '1'
        && chatArea.__communitiesState
        && chatArea.querySelector('.communities-top-tabs')
        && chatArea.querySelector('.communities-wrap')
    );

    if (canReuseMountedCommunities) {
        const activeTab = localStorage.getItem(communitiesTabKey) || 'all';
        chatArea.__communitiesState.reload().then(() => {
            chatArea.__communitiesState.setTab(activeTab);
        });
        return;
    }

    chatArea.dataset.communitiesMounted = '0';
    chatArea.__communitiesState = null;
    let recentIds = [];
    try {
        const rawRecent = JSON.parse(localStorage.getItem(recentKey) || '[]');
        recentIds = Array.isArray(rawRecent) ? rawRecent.filter(Boolean) : [];
    } catch (_error) {
        recentIds = [];
    }

    let snapshotIds = [];
    try {
        const rawSnapshot = JSON.parse(localStorage.getItem(newsSnapshotKey) || '[]');
        snapshotIds = Array.isArray(rawSnapshot) ? rawSnapshot.filter(Boolean) : [];
    } catch (_error) {
        snapshotIds = [];
    }

    chatArea.innerHTML = `
        <div class="communities-top-tabs">
            <button type="button" class="communities-tab-btn active" data-tab="all"><span class="tab-icon" aria-hidden="true"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 10.5 12 4l9 6.5"></path><path d="M5 10v9h14v-9"></path><path d="M9 19v-5h6v5"></path></svg></span><span>Сообщества</span></button>
            <button type="button" class="communities-tab-btn" data-tab="subs"><span class="tab-icon" aria-hidden="true"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m12 3 2.6 5.3 5.9.9-4.2 4.1 1 5.8-5.3-2.8-5.3 2.8 1-5.8L3.5 9.2l5.9-.9z"></path></svg></span><span>Подписки</span></button>
            <button type="button" class="communities-tab-btn" data-tab="news"><span class="tab-icon" aria-hidden="true"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="5" width="18" height="14" rx="2"></rect><path d="M7 9h10"></path><path d="M7 13h6"></path></svg></span><span>Новости</span></button>
            <button type="button" class="communities-tab-btn" data-tab="recent"><span class="tab-icon" aria-hidden="true"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"></circle><path d="M12 7v6l4 2"></path></svg></span><span>Недавно посещали</span></button>
            <button type="button" class="communities-tab-btn" data-tab="create"><span class="tab-icon" aria-hidden="true"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 5v14"></path><path d="M5 12h14"></path><circle cx="12" cy="12" r="9"></circle></svg></span><span>Создать</span></button>
        </div>
        <div class="communities-wrap"></div>
    `;
    const list = chatArea.querySelector('.communities-wrap');
    let allCommunities = [];
    let joinedSet = new Set();
    let currentTab = localStorage.getItem(communitiesTabKey) || 'all';

    async function reloadCommunitiesOnline() {
        try {
            const bundle = await fetchOnlineCommunitiesBundle();
            allCommunities = bundle.communities;
            joinedSet = bundle.joinedSet;
            if (allCommunities.length) {
                localStorage.setItem(communitiesCacheKey, JSON.stringify(allCommunities));
            }
        } catch (error) {
            console.error('Ошибка загрузки сообществ:', error);
            try {
                const cached = JSON.parse(localStorage.getItem(communitiesCacheKey) || '[]');
                allCommunities = Array.isArray(cached) ? cached : [];
            } catch (_e) {
                allCommunities = [];
            }
            joinedSet = new Set();
        }

        if (!allCommunities.length) {
            try {
                const cached = JSON.parse(localStorage.getItem(communitiesCacheKey) || '[]');
                if (Array.isArray(cached) && cached.length) {
                    allCommunities = cached;
                }
            } catch (_e) {
                // ignore
            }
        }

        if (!allCommunities.length) {
            allCommunities = [
                {
                    id: 'demo-tech',
                    name: 'Margelet Tech',
                    description: 'Технологии, апдейты и новые функции',
                    icon: 'M',
                    color: 'linear-gradient(135deg,#4e8cff,#5f5bff)',
                    image: '',
                    avatarUrl: '',
                    coverUrl: '',
                    ownerEmail: normalizeEmail(currentUserEmail || ''),
                    members: 1290,
                    posts: []
                },
                {
                    id: 'demo-news',
                    name: 'Новости Margelet',
                    description: 'Новости платформы и важные объявления',
                    icon: 'N',
                    color: 'linear-gradient(135deg,#06b6d4,#3b82f6)',
                    image: '',
                    avatarUrl: '',
                    coverUrl: '',
                    ownerEmail: normalizeEmail(currentUserEmail || ''),
                    members: 845,
                    posts: []
                },
                {
                    id: 'demo-creative',
                    name: 'Creative Hub',
                    description: 'Дизайн, идеи и вдохновение',
                    icon: 'C',
                    color: 'linear-gradient(135deg,#f59e0b,#ef4444)',
                    image: '',
                    avatarUrl: '',
                    coverUrl: '',
                    ownerEmail: normalizeEmail(currentUserEmail || ''),
                    members: 512,
                    posts: []
                }
            ];
            joinedSet = new Set(allCommunities.map((item) => item.id));
        }

        const knownIds = new Set(allCommunities.map(item => item.id));
        snapshotIds = snapshotIds.filter(id => knownIds.has(id));
        if (!snapshotIds.length && allCommunities.length) {
            snapshotIds = [...allCommunities].map(item => item.id);
            localStorage.setItem(newsSnapshotKey, JSON.stringify(snapshotIds));
        }
    }

    function rememberRecent(id) {
        recentIds = [id, ...recentIds.filter(x => x !== id)].slice(0, 10);
        localStorage.setItem(recentKey, JSON.stringify(recentIds));
    }

    function renderFeed(items, emptyText) {
        if (!items.length) {
            list.innerHTML = `<div class="no-chats-message">${emptyText}</div>`;
            return;
        }
        list.innerHTML = '<div class="communities-news-feed"></div>';
        const feed = list.querySelector('.communities-news-feed');
        items.forEach((community) => {
            const latestPost = Array.isArray(community.posts) ? community.posts[0] : null;
            const postText = latestPost?.description || 'Пока нет публикаций';
            const imageUrl = latestPost?.image_url || community.coverUrl || '';
            const card = document.createElement('div');
            card.className = 'community-news-card';
            card.innerHTML = `
                <div class="community-news-head">
                    <div class="community-vk-avatar" style="${community.avatarUrl ? `background-image:url(${escapeHtml(community.avatarUrl)});background-size:cover;background-position:center;` : `background:${community.color};`} width:42px; height:42px; font-size:16px; border-radius:10px;">${community.avatarUrl ? '' : community.icon}</div>
                    <div>
                        <div class="community-vk-name">${escapeHtml(community.name)}</div>
                        <div class="community-vk-meta">${community.members.toLocaleString('ru-RU')} подписчиков</div>
                    </div>
                </div>
                ${imageUrl ? `<img class="community-news-image" src="${escapeHtml(imageUrl)}" alt="news">` : ''}
                <div class="community-news-body">${escapeHtml(postText)}</div>
            `;
            card.addEventListener('click', async () => {
                rememberRecent(community.id);
                await openCommunityProfile(community, { joinedSet, onMembershipChange: reloadCommunitiesOnline });
            });
            feed.appendChild(card);
        });
    }

    function renderGrid(items, emptyText) {
        if (!items.length) {
            list.innerHTML = `<div class="no-chats-message">${emptyText}</div>`;
            return;
        }
        list.innerHTML = '<div class="communities-grid"></div>';
        const grid = list.querySelector('.communities-grid');
        items.forEach((community) => {
            const joined = joinedSet.has(community.id);
            const card = document.createElement('div');
            card.className = 'community-grid-card';
            card.innerHTML = `
                <div class="community-vk-avatar" style="${community.avatarUrl ? `background-image:url(${escapeHtml(community.avatarUrl)});background-size:cover;background-position:center;` : `background:${community.color};`} width:58px; height:58px;">${community.avatarUrl ? '' : community.icon}</div>
                <div class="community-grid-name">${escapeHtml(community.name)}</div>
                <div class="community-grid-subs">${community.members.toLocaleString('ru-RU')} подписчиков</div>
                <button type="button" class="community-vk-join${joined ? ' joined' : ''}">${joined ? 'Вы подписаны' : 'Подписаться'}</button>
            `;
            const joinBtn = card.querySelector('.community-vk-join');
            joinBtn.addEventListener('click', async (event) => {
                event.stopPropagation();
                const client = getSupabaseClient();
                if (!client) return;
                const next = !joinedSet.has(community.id);
                if (next) {
                    await client.from('community_memberships').insert([{ community_id: community.id, member_email: normalizeEmail(currentUserEmail) }]);
                    joinedSet.add(community.id);
                } else {
                    await client.from('community_memberships').delete().eq('community_id', community.id).eq('member_email', normalizeEmail(currentUserEmail));
                    joinedSet.delete(community.id);
                }
                joinBtn.classList.toggle('joined', next);
                joinBtn.textContent = next ? 'Вы подписаны' : 'Подписаться';
                await reloadCommunitiesOnline();
            });
            card.addEventListener('click', async () => {
                rememberRecent(community.id);
                await openCommunityProfile(community, { joinedSet, onMembershipChange: reloadCommunitiesOnline });
            });
            grid.appendChild(card);
        });
    }

    function renderCreateCommunityForm() {
        list.innerHTML = `
            <div class="community-create-layout">
                <div class="community-create-mock">
                    <button type="button" class="community-create-mock-cover" id="community-create-cover-btn" title="Выбрать шапку">
                        <span class="community-upload-hint">
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 7a2 2 0 0 1 2-2h3l1.5 2H19a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"></path><circle cx="12" cy="13" r="3"></circle></svg>
                            <span>Загрузить шапку</span>
                        </span>
                    </button>
                    <button type="button" class="community-create-mock-avatar" id="community-create-avatar-btn" title="Выбрать аватар">
                        <span class="community-upload-hint community-upload-hint-avatar">
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 7a2 2 0 0 1 2-2h3l1.5 2H18a2 2 0 0 1 2 2v7a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2z"></path><circle cx="12" cy="12" r="2.5"></circle></svg>
                        </span>
                    </button>
                    <div class="community-create-mock-form">
                        <label class="community-create-field-label" for="community-create-name">Название сообщества</label>
                        <input id="community-create-name" class="community-create-field" type="text" placeholder="Введите название" maxlength="80">
                        <label class="community-create-field-label" for="community-create-description">Описание</label>
                        <textarea id="community-create-description" class="community-create-field" placeholder="Введите описание" rows="3"></textarea>
                        <input id="community-create-avatar" type="file" accept="image/*" hidden>
                        <input id="community-create-cover" type="file" accept="image/*" hidden>
                        <button id="community-create-submit" type="button" class="community-vk-join">Создать сообщество</button>
                    </div>
                </div>
            </div>
        `;

        const coverBtn = list.querySelector('#community-create-cover-btn');
        const avatarBtn = list.querySelector('#community-create-avatar-btn');
        const coverInput = list.querySelector('#community-create-cover');
        const avatarInput = list.querySelector('#community-create-avatar');

        coverBtn?.addEventListener('click', () => coverInput?.click());
        avatarBtn?.addEventListener('click', () => avatarInput?.click());

        avatarInput?.addEventListener('change', async () => {
            const file = avatarInput.files?.[0] || null;
            if (!file || !avatarBtn) return;
            const dataUrl = await fileToDataUrl(file);
            avatarBtn.style.backgroundImage = `url(${dataUrl})`;
            avatarBtn.classList.add('has-image');
        });

        coverInput?.addEventListener('change', async () => {
            const file = coverInput.files?.[0] || null;
            if (!file || !coverBtn) return;
            const dataUrl = await fileToDataUrl(file);
            coverBtn.style.backgroundImage = `url(${dataUrl})`;
            coverBtn.classList.add('has-image');
        });

        const submitBtn = list.querySelector('#community-create-submit');
        submitBtn?.addEventListener('click', async () => {
            if (submitBtn.dataset.submitting === '1') return;
            const client = getSupabaseClient();
            if (!client || !currentUserEmail) {
                alert('Supabase недоступен');
                return;
            }

            const name = String(list.querySelector('#community-create-name')?.value || '').trim();
            const description = String(list.querySelector('#community-create-description')?.value || '').trim();
            const avatarFile = avatarInput?.files?.[0] || null;
            const coverFile = coverInput?.files?.[0] || null;

            if (!name) {
                alert('Введите название сообщества');
                return;
            }

            submitBtn.dataset.submitting = '1';
            submitBtn.disabled = true;
            const originalLabel = submitBtn.textContent;
            submitBtn.textContent = 'Создание...';
            try {
                const seed = buildCommunityVisualSeed(name);
                const avatarUrl = avatarFile ? await fileToDataUrl(avatarFile) : createDefaultAvatarDataUrl(name);
                const coverUrl = coverFile ? await fileToDataUrl(coverFile) : createDefaultCoverDataUrl(name);
                const themeColor = `linear-gradient(135deg,${seed.colorA},${seed.colorB})`;

                const { data: created, error } = await client
                    .from('communities')
                    .insert([{ name, description, owner_email: normalizeEmail(currentUserEmail), avatar_url: avatarUrl, cover_url: coverUrl, theme_color: themeColor }])
                    .select('*')
                    .single();

                if (error || !created) {
                    alert('Не удалось создать сообщество');
                    return;
                }

                await client.from('community_memberships').insert([{ community_id: created.id, member_email: normalizeEmail(currentUserEmail) }]);
                await reloadCommunitiesOnline();
                setTab('all');
            } finally {
                submitBtn.dataset.submitting = '0';
                submitBtn.disabled = false;
                submitBtn.textContent = originalLabel || 'Создать сообщество';
            }
        });
    }

    function renderRandomNews() {
        const defaultNewsPool = snapshotIds
            .map(id => allCommunities.find(item => item.id === id))
            .filter(Boolean)
            .slice(0, 3);
        renderFeed(defaultNewsPool, 'Пока нет новостей');
    }

    function setTab(tab) {
        currentTab = tab || 'all';
        localStorage.setItem(communitiesTabKey, currentTab);
        list.classList.toggle('communities-wrap-scroll', tab === 'news');
        chatArea.querySelectorAll('.communities-tab-btn').forEach(btn => {
            btn.classList.toggle('active', btn.getAttribute('data-tab') === tab);
        });
        if (!tab) {
            renderRandomNews();
            return;
        }
        if (tab === 'all') {
            renderGrid(allCommunities, 'Сообщества пока пусты');
            return;
        }
        if (tab === 'subs') {
            const subs = allCommunities.filter(c => joinedSet.has(c.id));
            renderFeed(subs, 'Вы пока не подписаны на сообщества');
            return;
        }
        if (tab === 'news') {
            const newsPool = snapshotIds
                .map(id => allCommunities.find(item => item.id === id))
                .filter(Boolean)
                .filter(c => Array.isArray(c.posts) && c.posts.length > 0);
            renderFeed(newsPool, 'Пока нет новостей');
            return;
        }
        if (tab === 'create') {
            renderCreateCommunityForm();
            return;
        }
        const recent = recentIds.map(id => allCommunities.find(c => c.id === id)).filter(Boolean);
        renderGrid(recent, 'Вы еще не открывали сообщества');
    }

    chatArea.querySelectorAll('.communities-tab-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            const tab = btn.getAttribute('data-tab') || '';
            setTab(tab);
        });
    });

    reloadCommunitiesOnline().then(() => {
        const allowedTabs = new Set(['all', 'subs', 'news', 'recent', 'create']);
        setTab(allowedTabs.has(currentTab) ? currentTab : 'all');
    });

    chatArea.dataset.communitiesMounted = '1';
    chatArea.__communitiesState = {
        reload: reloadCommunitiesOnline,
        setTab
    };
}

async function openCommunityProfile(community, context = {}) {
    currentViewedCommunity = { ...community };

    const client = getSupabaseClient();
    if (client) {
        const { data: freshCommunity } = await client.from('communities').select('*').eq('id', community.id).single();
        const { data: posts } = await client.from('community_posts').select('*').eq('community_id', community.id).order('created_at', { ascending: false });
        const { data: memberships } = await client.from('community_memberships').select('member_email').eq('community_id', community.id);
        if (freshCommunity) {
            community = {
                ...community,
                ...freshCommunity,
                name: freshCommunity.name,
                description: freshCommunity.description || community.description,
                coverUrl: freshCommunity.cover_url || community.coverUrl,
                avatarUrl: freshCommunity.avatar_url || community.avatarUrl,
                ownerEmail: normalizeEmail(freshCommunity.owner_email || community.ownerEmail || ''),
                posts: posts || [],
                members: (memberships || []).length
            };
        }
    }

    const avatar = document.getElementById('community-profile-avatar');
    const name = document.getElementById('community-profile-name');
    const cover = document.getElementById('community-profile-cover');
    const desc = document.getElementById('community-profile-description');
    const members = document.getElementById('community-profile-members');
    const postsRoot = document.getElementById('community-profile-posts');
    const messageBtn = document.getElementById('community-profile-message-btn');
    const joinBtn = document.getElementById('community-profile-join-btn');
    const ownerMenuContainer = document.getElementById('community-profile-menu-container');
    const ownerMenuBtn = document.getElementById('community-profile-menu-btn');
    const ownerMenu = document.getElementById('community-profile-menu');
    const ownerNameAction = document.getElementById('community-change-name-action');
    const ownerDescriptionAction = document.getElementById('community-change-description-action');
    const ownerCoverAction = document.getElementById('community-change-cover-action');
    const ownerAvatarAction = document.getElementById('community-change-avatar-action');
    const ownerDeleteAction = document.getElementById('community-delete-action');
    const ownerCoverInput = document.getElementById('community-change-cover-input');
    const ownerAvatarInput = document.getElementById('community-change-avatar-input');

    if (avatar) {
        if (community.avatarUrl) {
            avatar.textContent = '';
            avatar.style.backgroundImage = `url(${community.avatarUrl})`;
            avatar.style.backgroundSize = 'cover';
            avatar.style.backgroundPosition = 'center';
        } else {
            avatar.textContent = community.icon || 'C';
            avatar.style.background = community.color || 'linear-gradient(135deg,#4e8cff,#5f5bff)';
            avatar.style.color = '#fff';
        }
    }
    if (cover) {
        if (community.coverUrl) {
            cover.style.background = `center / cover no-repeat url(${community.coverUrl})`;
        } else {
            cover.style.background = community.color || 'linear-gradient(135deg,#4e8cff,#5f5bff)';
        }
    }
    if (name) name.textContent = community.name || 'Сообщество';
    if (desc) desc.textContent = community.description || 'Описание сообщества';
    if (members) members.textContent = Number(community.members || 0).toLocaleString('ru-RU') + ' подписчиков';
    const isOwner = normalizeEmail(community.ownerEmail || '') === normalizeEmail(currentUserEmail || '');

    if (ownerMenuContainer) {
        ownerMenuContainer.style.display = isOwner ? 'flex' : 'none';
    }
    if (ownerMenuBtn && ownerMenu) {
        ownerMenu.classList.remove('show');
        ownerMenuBtn.onclick = (event) => {
            event.stopPropagation();
            ownerMenu.classList.toggle('show');
        };
    }
    if (ownerCoverAction && ownerCoverInput) {
        ownerCoverAction.onclick = () => {
            ownerMenu?.classList.remove('show');
            ownerCoverInput.click();
        };
    }
    if (ownerAvatarAction && ownerAvatarInput) {
        ownerAvatarAction.onclick = () => {
            ownerMenu?.classList.remove('show');
            ownerAvatarInput.click();
        };
    }

    if (ownerDeleteAction) {
        ownerDeleteAction.onclick = async () => {
            ownerMenu?.classList.remove('show');
            if (!client || !isOwner) return;
            const confirmed = confirm(`Удалить сообщество "${community.name || 'Сообщество'}"? Это действие нельзя отменить.`);
            if (!confirmed) return;
            const { error } = await client.from('communities').delete().eq('id', community.id).eq('owner_email', normalizeEmail(currentUserEmail || ''));
            if (error) {
                alert('Не удалось удалить сообщество');
                return;
            }
            if (typeof context.onMembershipChange === 'function') {
                await context.onMembershipChange();
            }
            goToScreen('screen-main');
        };
    }

    if (ownerNameAction) {
        ownerNameAction.onclick = async () => {
            ownerMenu?.classList.remove('show');
            const nextName = prompt('Новое название сообщества', community.name || '');
            if (nextName === null) return;
            const trimmed = String(nextName).trim();
            if (!trimmed || !client) return;
            const { error } = await client.from('communities').update({ name: trimmed }).eq('id', community.id);
            if (error) return;
            await openCommunityProfile({ ...community, name: trimmed }, context);
            if (typeof context.onMembershipChange === 'function') {
                await context.onMembershipChange();
            }
        };
    }

    if (ownerDescriptionAction) {
        ownerDescriptionAction.onclick = async () => {
            ownerMenu?.classList.remove('show');
            const nextDescription = prompt('Новое описание сообщества', community.description || '');
            if (nextDescription === null) return;
            const trimmed = String(nextDescription).trim();
            if (!client) return;
            const { error } = await client.from('communities').update({ description: trimmed }).eq('id', community.id);
            if (error) return;
            await openCommunityProfile({ ...community, description: trimmed }, context);
            if (typeof context.onMembershipChange === 'function') {
                await context.onMembershipChange();
            }
        };
    }

    if (ownerCoverInput) {
        ownerCoverInput.onchange = async () => {
            const file = ownerCoverInput.files?.[0] || null;
            if (!file || !client) return;
            const coverUrl = await fileToDataUrl(file);
            const { error } = await client.from('communities').update({ cover_url: coverUrl }).eq('id', community.id);
            if (error) return;
            await openCommunityProfile(community, context);
            if (typeof context.onMembershipChange === 'function') {
                await context.onMembershipChange();
            }
        };
    }

    if (ownerAvatarInput) {
        ownerAvatarInput.onchange = async () => {
            const file = ownerAvatarInput.files?.[0] || null;
            if (!file || !client) return;
            const avatarUrl = await fileToDataUrl(file);
            const { error } = await client.from('communities').update({ avatar_url: avatarUrl }).eq('id', community.id);
            if (error) return;
            await openCommunityProfile(community, context);
            if (typeof context.onMembershipChange === 'function') {
                await context.onMembershipChange();
            }
        };
    }

    if (!window.__communityOwnerMenuOutsideClickBound) {
        document.addEventListener('click', (event) => {
            const menu = document.getElementById('community-profile-menu');
            const container = document.getElementById('community-profile-menu-container');
            if (!menu || !container) return;
            if (!container.contains(event.target)) {
                menu.classList.remove('show');
            }
        });
        window.__communityOwnerMenuOutsideClickBound = true;
    }

    if (postsRoot) {
        const onlinePosts = Array.isArray(community.posts) ? community.posts : [];

        const composer = isOwner ? `
            <div class="community-create-card community-post-composer">
                <h3>Опубликовать пост</h3>
                <textarea id="community-post-description" class="community-create-field community-post-field" rows="3" placeholder="Описание поста"></textarea>
                <button type="button" id="community-post-image-btn" class="community-post-upload-btn">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 7a2 2 0 0 1 2-2h3l1.5 2H19a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"></path><circle cx="12" cy="13" r="3"></circle></svg>
                    <span>Добавить фото</span>
                </button>
                <input id="community-post-image" type="file" accept="image/*" hidden>
                <button type="button" id="community-post-submit" class="community-vk-join">Опубликовать</button>
            </div>
        ` : '';

        const postsHtml = onlinePosts.length
            ? onlinePosts.map((post) => {
                const timeLabel = new Date(post.created_at || Date.now()).toLocaleString('ru-RU');
                const imageBlock = post.image_url ? `<img class="community-news-image community-post-image" src="${escapeHtml(post.image_url)}" alt="post">` : '';
                return `<div class="community-post-item">${imageBlock}<strong>${escapeHtml(community.name)}</strong><br>${escapeHtml(post.description || '')}<br><span class="community-vk-meta">${timeLabel}</span></div>`;
            }).join('')
            : '<div class="no-chats-message">Пока нет постов</div>';

        postsRoot.innerHTML = composer + postsHtml;

        const postImageBtn = postsRoot.querySelector('#community-post-image-btn');
        const postImageInput = postsRoot.querySelector('#community-post-image');
        postImageBtn?.addEventListener('click', () => postImageInput?.click());
        postImageInput?.addEventListener('change', async () => {
            const file = postImageInput.files?.[0] || null;
            if (!file || !postImageBtn) return;
            const dataUrl = await fileToDataUrl(file);
            postImageBtn.classList.add('has-image');
            postImageBtn.innerHTML = `<img class="community-post-upload-preview" src="${escapeHtml(dataUrl)}" alt="preview">`;
        });

        const submitPostBtn = postsRoot.querySelector('#community-post-submit');
        if (submitPostBtn) {
            submitPostBtn.addEventListener('click', async () => {
                const descriptionInput = postsRoot.querySelector('#community-post-description');
                const imageInput = postsRoot.querySelector('#community-post-image');
                const description = String(descriptionInput?.value || '').trim();
                const file = imageInput?.files?.[0] || null;

                if (!description) {
                    alert('Добавьте описание поста');
                    return;
                }

                const imageUrl = file ? await fileToDataUrl(file) : '';
                const supabase = getSupabaseClient();
                if (!supabase) return;

                const { error } = await supabase.from('community_posts').insert([{
                    community_id: community.id,
                    author_email: normalizeEmail(currentUserEmail),
                    description,
                    image_url: imageUrl
                }]);

                if (error) {
                    alert('Не удалось опубликовать пост');
                    return;
                }

                await openCommunityProfile(community, context);
                if (typeof context.onMembershipChange === 'function') {
                    await context.onMembershipChange();
                }
            });
        }
    }
    if (messageBtn) {
        messageBtn.onclick = () => {
            alert('Чат с сообществом скоро появится.');
        };
    }

    if (joinBtn) {
        const isJoined = context.joinedSet instanceof Set
            ? context.joinedSet.has(community.id)
            : false;
        joinBtn.classList.toggle('joined', isJoined);
        const label = joinBtn.querySelector('.language-label');
        if (label) label.textContent = isJoined ? 'Вы подписаны' : 'Подписаться';

        joinBtn.onclick = async () => {
            const supabase = getSupabaseClient();
            if (!supabase || !currentUserEmail) return;
            const nextJoined = !(context.joinedSet instanceof Set && context.joinedSet.has(community.id));
            if (nextJoined) {
                await supabase.from('community_memberships').insert([{ community_id: community.id, member_email: normalizeEmail(currentUserEmail) }]);
                if (context.joinedSet instanceof Set) context.joinedSet.add(community.id);
            } else {
                await supabase.from('community_memberships').delete().eq('community_id', community.id).eq('member_email', normalizeEmail(currentUserEmail));
                if (context.joinedSet instanceof Set) context.joinedSet.delete(community.id);
            }
            joinBtn.classList.toggle('joined', nextJoined);
            if (label) label.textContent = nextJoined ? 'Вы подписаны' : 'Подписаться';
            if (typeof context.onMembershipChange === 'function') {
                await context.onMembershipChange();
            }
        };
    }

    lastScreenBeforeUserProfile = 'screen-main';
    goToScreen('screen-community-profile');
}

function updateBottomNavigationVisibility() {
    const root = document.documentElement;
    const screenMain = document.getElementById('screen-main');
    const ownProfileScreen = document.getElementById('screen-profile');
    const userProfileScreen = document.getElementById('screen-user-profile');
    const communityProfileScreen = document.getElementById('screen-community-profile');
    const editProfileScreen = document.getElementById('screen-edit-profile');
    const goldScreen = document.getElementById('screen-gold');
    const createGroupScreen = document.getElementById('screen-create-group');
    const threadView = document.querySelector('#chat-area .thread-view');
    const isMainActive = Boolean(screenMain && screenMain.classList.contains('active'));
    const isOwnProfileOpen = Boolean(ownProfileScreen && ownProfileScreen.classList.contains('active'));
    const isThreadOpen = Boolean(threadView && isMainActive);
    const isUserProfileOpen = Boolean(userProfileScreen && userProfileScreen.classList.contains('active'));
    const isCommunityProfileOpen = Boolean(communityProfileScreen && communityProfileScreen.classList.contains('active'));
    const isEditProfileOpen = Boolean(editProfileScreen && editProfileScreen.classList.contains('active'));
    const isGoldOpen = Boolean(goldScreen && goldScreen.classList.contains('active'));
    const isCreateGroupOpen = Boolean(createGroupScreen && createGroupScreen.classList.contains('active'));

    root.classList.toggle('chat-thread-open', isThreadOpen);
    root.classList.toggle('own-profile-open', isOwnProfileOpen);
    root.classList.toggle('user-profile-open', isUserProfileOpen || isCommunityProfileOpen);
    root.classList.toggle('edit-profile-open', isEditProfileOpen);
    root.classList.toggle('gold-open', isGoldOpen);
    root.classList.toggle('create-group-open', isCreateGroupOpen);
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

function getGlowColorValue(glowColor = 'gradient') {
    const key = String(glowColor || 'gradient').toLowerCase();
    const palette = {
        gradient: '#8b41df',
        pink: '#ff5e98',
        purple: '#8b41df',
        blue: '#30a1ff',
        green: '#00e676',
        orange: '#ff9800',
        red: '#f44336',
        cyan: '#00bcd4'
    };
    return palette[key] || key || '#8b41df';
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
                email_visibility: getEmailVisibilityForUser(currentUserEmail),
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
    const normalizedEmail = normalizeEmail(email || '');
    const isCurrent = normalizedEmail && normalizedEmail === normalizeEmail(currentUserEmail || '');

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
        (isCurrent ? localStorage.getItem('glowColor_' + email) : '') ||
        userRecord.glowColor ||
        localStorage.getItem('glowColor_' + email) ||
        'gradient';

    const nicknameGradientEnabledRaw =
        (isCurrent ? localStorage.getItem(getNicknameGradientKey(email)) : null) ??
        userRecord.nicknameGradientEnabled;

    const nicknameGradientPaletteRaw =
        (isCurrent ? localStorage.getItem(getNicknameGradientPaletteKey(email)) : '') ||
        userRecord.nicknameGradientPalette ||
        localStorage.getItem(getNicknameGradientPaletteKey(email)) ||
        'aurora';

    const avatarAnimationRaw =
        (isCurrent ? localStorage.getItem('avatarParticleAnimation_' + email) : '') ||
        userRecord.avatarParticleAnimation ||
        userRecord.avatarAnimation ||
        localStorage.getItem('avatarParticleAnimation_' + email) ||
        AVATAR_PARTICLE_ANIMATION_DEFAULT;

    const glowAnimationRaw =
        (isCurrent ? localStorage.getItem('glowAnimation_' + email) : '') ||
        userRecord.glowAnimation ||
        localStorage.getItem('glowAnimation_' + email) ||
        'pulse';

    const avatarAnimationEnabledRaw =
        (isCurrent ? localStorage.getItem('avatarAnimationEnabled_' + email) : null) ??
        userRecord.avatarAnimationEnabled;

    const avatarGlowEnabledRaw =
        (isCurrent ? localStorage.getItem('avatarGlowEnabled_' + email) : null) ??
        userRecord.avatarGlowEnabled;

    const hasGold = isCurrent
        ? Boolean(getMembershipState().gold)
        : Boolean(userRecord.hasGold);
    const goldBadgeVisible = isCurrent
        ? isGoldBadgeVisible()
        : Boolean(userRecord.goldBadgeVisible !== false);
    const goldBadgeStyle = isCurrent
        ? getGoldBadgeStyle()
        : String(userRecord.goldBadgeStyle || 'aurora');

    const normalizedUsername = normalizeUsername(usernameRaw);
    const fallbackUsername = normalizeUsername(email.split('@')[0] || '');

    const normalizedStatus = String(statusRaw || '').trim();

    return {
        displayName: getDisplayNameByEmail(email),
        username: normalizedUsername || fallbackUsername,
        status: normalizedStatus,
        birthday: String(birthdayRaw || '').trim(),
        glowColor: glowColorRaw || 'gradient',
        nicknameGradientEnabled: hasGold && (nicknameGradientEnabledRaw === true || nicknameGradientEnabledRaw === '1'),
        nicknameGradientPalette: normalizeNicknameGradientPalette(nicknameGradientPaletteRaw),
        avatarAnimation: normalizeAvatarParticleAnimation(avatarAnimationRaw),
        avatarAnimationEnabled: hasGold && !(avatarAnimationEnabledRaw === false || avatarAnimationEnabledRaw === '0'),
        avatarGlowEnabled: hasGold && !(avatarGlowEnabledRaw === false || avatarGlowEnabledRaw === '0'),
        glowAnimation: normalizeGlowAnimation(glowAnimationRaw),
        avatar: getAvatarByEmail(email),
        hasGold,
        goldBadgeVisible,
        goldBadgeStyle
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

    const lang = getCurrentLanguage();
    const blocked = isUserBlocked(currentViewedUserProfileEmail);
    const label = blockAction.querySelector('span');
    if (label) {
        label.textContent = blocked
            ? (lang === 'en' ? 'Unblock user' : 'Разблокировать пользователя')
            : (lang === 'en' ? 'Block user' : 'Заблокировать пользователя');
    }
    blockAction.classList.toggle('blocked', blocked);
    blockAction.classList.toggle('user-profile-dropdown-item', true);
}

function updateUserProfileContactAction() {
    const contactAction = document.getElementById('user-profile-add-contact-action');
    if (!contactAction || !currentViewedUserProfileEmail || !currentUserEmail) return;

    const lang = getCurrentLanguage();
    const added = isUserInContacts(currentViewedUserProfileEmail);
    const label = contactAction.querySelector('span');
    if (label) {
        label.textContent = added
            ? (lang === 'en' ? 'Remove from contacts' : 'Удалить из контактов')
            : (lang === 'en' ? 'Add to contacts' : 'Добавить в контакты');
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
    const lang = getCurrentLanguage();
    if (!rawBirthday) return lang === 'en' ? 'Not specified' : 'Не указана';
    const parsedDate = new Date(rawBirthday);
    if (Number.isNaN(parsedDate.getTime())) return rawBirthday;
    return parsedDate.toLocaleDateString(lang === 'en' ? 'en-US' : 'ru-RU', {
        year: 'numeric',
        month: 'long',
        day: 'numeric'
    });
}

function openUserProfileScreenByEmail(email, sourceScreenId = 'screen-main') {
    if (!email) return;

    const lang = getCurrentLanguage();
    const profileData = getUserProfileDataByEmail(email);
    const safeName = profileData.displayName;
    const savedUsername = profileData.username;
    const savedBirthday = profileData.birthday;
    const savedStatus = profileData.status;
    const savedGlowColor = profileData.glowColor;
    const savedGlowAnimation = profileData.glowAnimation;
    const savedAvatarAnimation = profileData.avatarAnimation;
    const savedAvatarAnimationEnabled = profileData.avatarAnimationEnabled;
    const savedAvatarGlowEnabled = profileData.avatarGlowEnabled;
    const savedAvatar = profileData.avatar;
    const hasGold = Boolean(profileData.hasGold);
    const goldBadgeVisible = Boolean(profileData.goldBadgeVisible);
    const goldBadgeStyle = String(profileData.goldBadgeStyle || 'aurora');

    const profileName = document.getElementById('user-profile-name');
    const profileUsername = document.getElementById('user-profile-username');
    const profileBirthday = document.getElementById('user-profile-birthday');
    const profileStatus = document.getElementById('user-profile-status');
    const profileAvatar = document.getElementById('user-profile-avatar-display');
    const profileGlow = document.getElementById('user-profile-avatar-glow');
    const profileParticles = document.getElementById('user-profile-avatar-particles');
    const canSeeAvatar = canCurrentUserSeeProfileField(email, 'avatar');
    const canSeeStatus = canCurrentUserSeeProfileField(email, 'status');
    const canSeeBirthday = canCurrentUserSeeProfileField(email, 'birthday');

    if (profileName) {
        profileName.innerHTML = '';
        const textNode = document.createElement('span');
        textNode.textContent = safeName || (lang === 'en' ? 'User' : 'Пользователь');
        applyGradientToNameElement(textNode, email);
        profileName.appendChild(textNode);
        if (hasGold && goldBadgeVisible) {
            const badge = document.createElement('span');
            badge.className = 'profile-gold-badge readonly';
            badge.dataset.style = goldBadgeStyle;
            badge.setAttribute('aria-hidden', 'true');
            badge.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M6 10h12"></path><path d="m8 10 4-5 4 5"></path><path d="m9 10 3 9 3-9"></path></svg>';
            profileName.appendChild(badge);
        }
    }
    if (profileUsername) profileUsername.textContent = savedUsername ? '@' + savedUsername : (lang === 'en' ? 'Not specified' : 'Не указан');
    if (profileBirthday) profileBirthday.textContent = canSeeBirthday ? formatBirthdayForDisplay(savedBirthday) : (lang === 'en' ? 'Hidden' : 'Скрыто');
    const birthdayRow = profileBirthday?.closest('.detail-item-static');
    if (birthdayRow) birthdayRow.style.display = canSeeBirthday ? 'flex' : 'none';
    if (profileStatus) {
        const normalizedStatus = savedStatus.trim();
        profileStatus.textContent = canSeeStatus ? normalizedStatus : '';
        const statusRow = profileStatus.closest('.detail-item-static');
        if (statusRow) {
            statusRow.style.display = canSeeStatus && normalizedStatus ? 'flex' : 'none';
        }
    }

    if (profileGlow) {
        profileGlow.style.background = getGlowBackgroundByColor(savedGlowColor);
        profileGlow.setAttribute('data-anim', normalizeGlowAnimation(savedGlowAnimation));
        profileGlow.style.display = canSeeAvatar && savedAvatarGlowEnabled ? 'block' : 'none';
    }

    if (profileParticles) {
        setAvatarParticleAnimationForCanvas(profileParticles, savedAvatarAnimation);
        profileParticles.style.display = canSeeAvatar && savedAvatarAnimationEnabled ? 'block' : 'none';
    }

    if (profileAvatar) {
        if (canSeeAvatar && savedAvatar) {
            profileAvatar.style.backgroundImage = `url(${savedAvatar})`;
            profileAvatar.style.backgroundSize = 'cover';
            profileAvatar.style.backgroundPosition = 'center';
            profileAvatar.style.backgroundColor = 'transparent';
            profileAvatar.textContent = '';
            profileAvatar.classList.remove('fallback');
        } else {
            const firstLetter = (safeName || (lang === 'en' ? 'U' : 'П')).charAt(0).toUpperCase();
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
    renderStoriesListForUser(email, 'user-profile-stories-list');
    renderCollectionListForUser(email, 'user-profile-collection-list', false);

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
            if ((conversation.participants || []).length > 2 || conversation.type === 'group') return true;
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

function isGroupConversation(conversation) {
    if (!conversation || !Array.isArray(conversation.participants)) return false;
    return conversation.type === 'group' || conversation.participants.length > 2;
}

function getConversationOwnerEmail(conversation) {
    if (!conversation) return '';
    const explicitOwner = normalizeEmail(conversation.ownerEmail || '');
    if (explicitOwner) return explicitOwner;
    const participants = Array.isArray(conversation.participants) ? conversation.participants : [];
    return normalizeEmail(participants[0] || '');
}

function getConversationAdminSet(conversation) {
    const ownerEmail = getConversationOwnerEmail(conversation);
    const source = Array.isArray(conversation?.admins) ? conversation.admins : [];
    const set = new Set(source.map((email) => normalizeEmail(email)).filter(Boolean));
    if (ownerEmail) set.add(ownerEmail);
    return set;
}

function ensureGroupConversationMeta(conversation) {
    if (!conversation || !isGroupConversation(conversation)) return conversation;
    const participants = Array.isArray(conversation.participants) ? conversation.participants : [];
    if (!participants.length) return conversation;

    const ownerEmail = getConversationOwnerEmail(conversation);
    const adminSet = getConversationAdminSet(conversation);

    conversation.type = 'group';
    conversation.ownerEmail = ownerEmail;
    conversation.admins = Array.from(adminSet);
    return conversation;
}

function getConversationDisplayMeta(conversation) {
    const group = isGroupConversation(conversation);
    if (!group) {
        const peerEmail = getOtherParticipantEmail(conversation);
        if (!peerEmail) {
            return {
                isGroup: false,
                peerEmail: null,
                title: 'Диалог',
                subtitle: '',
                avatar: null,
                glowColor: getGlowColorValue('gradient'),
                firstLetter: 'D'
            };
        }
        const title = getDisplayNameByEmail(peerEmail);
        return {
            isGroup: false,
            peerEmail,
            title,
            subtitle: getUserPresenceText(peerEmail),
            avatar: getAvatarByEmail(peerEmail),
            glowColor: getGlowColorValue(getUserProfileDataByEmail(peerEmail).glowColor || 'gradient'),
            firstLetter: (title || 'П').charAt(0).toUpperCase()
        };
    }

    const participantEmails = (conversation.participants || []).filter((email) => normalizeEmail(email) !== normalizeEmail(currentUserEmail));
    const count = participantEmails.length + 1;
    const title = String(conversation.title || '').trim() || `Группа (${count})`;
    const firstPeer = participantEmails[0] || null;
    const avatar = conversation.avatar || (firstPeer ? getAvatarByEmail(firstPeer) : null);
    return {
        isGroup: true,
        peerEmail: null,
        title,
        subtitle: `${count} участников`,
        avatar,
        glowColor: getGlowColorValue('blue'),
        firstLetter: title.charAt(0).toUpperCase() || 'G'
    };
}

function createGroupConversation(participantEmails, title = '', avatar = '') {
    const normalizedParticipants = Array.from(new Set((participantEmails || [])
        .map((email) => normalizeEmail(email))
        .filter((email) => email && email !== normalizeEmail(currentUserEmail))));

    if (normalizedParticipants.length < 2) {
        return null;
    }

    const conversationId = 'group_' + Date.now() + '_' + Math.random().toString(36).slice(2, 8);
    const store = getConversationsStore();
    store[conversationId] = {
        id: conversationId,
        type: 'group',
        title: String(title || '').trim(),
        avatar: String(avatar || '').trim(),
        participants: [currentUserEmail, ...normalizedParticipants],
        ownerEmail: normalizeEmail(currentUserEmail),
        admins: [normalizeEmail(currentUserEmail)],
        messages: [],
        updatedAt: Date.now()
    };
    saveConversationsStore(store);
    return store[conversationId];
}

function createAvatarMarkup(user) {
    const safeName = user.displayName || 'Пользователь';
    const firstLetter = safeName.charAt(0).toUpperCase();
    const glowColorRaw = user.glowColor || getUserProfileDataByEmail(user.email).glowColor || 'gradient';
    const glowColor = getGlowColorValue(glowColorRaw);
    const styleParts = [`--avatar-glow:${escapeHtml(glowColor)};`];
    if (user.avatar) {
        styleParts.push(`background-image:url('${escapeHtml(user.avatar)}');`);
    }
    const avatarStyle = `style="${styleParts.join(' ')}"`;
    const fallbackClass = user.avatar ? 'chat-avatar user-profile-trigger' : 'chat-avatar fallback user-profile-trigger';
    return `<div class="${fallbackClass}" data-email="${escapeHtml(user.email)}" ${avatarStyle}>${user.avatar ? '' : escapeHtml(firstLetter)}</div>`;
}

function createGroupAvatarMarkup(title = '', avatarUrl = '') {
    const firstLetter = String(title || 'G').trim().charAt(0).toUpperCase() || 'G';
    if (avatarUrl) {
        return `<div class="chat-avatar group-avatar" style="background-image:url('${escapeHtml(avatarUrl)}');"> </div>`;
    }
    return `<div class="chat-avatar fallback group-avatar">${escapeHtml(firstLetter)}</div>`;
}

function buildGroupCreatedSystemText(conversationTitle = '') {
    const trimmedTitle = String(conversationTitle || '').trim();
    if (trimmedTitle) {
        return `Создана беседа «${trimmedTitle}»`;
    }
    return 'Создана новая беседа';
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
                avatar: user.avatar_url || null,
                glowColor: user.glow_color || 'gradient'
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
                    <span class="chat-list-name">${renderDisplayNameWithGradient(user.displayName, user.email)}</span>
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

            if (typeof window.closeSearchMode === 'function') {
                window.closeSearchMode();
            }

            scheduleChatAreaUpdate({ skipRemoteRefresh: true });

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

function renderConversationsList(chatArea, options = {}) {
    const groupsOnly = Boolean(options.groupsOnly);
    const allConversations = getCurrentUserConversations();
    const conversations = groupsOnly
        ? allConversations.filter((conversation) => isGroupConversation(conversation))
        : allConversations;
    const unreadMap = getUnreadConversationMap();

    if (!conversations.length) {
        chatArea.innerHTML = groupsOnly
            ? '<div class="no-chats-message">У вас пока нет бесед. Создайте группу, чтобы начать общение.</div>'
            : '<div class="no-chats-message">У вас пока нет чатов. Найдите пользователя через поиск сверху.</div>';
        return;
    }

    chatArea.innerHTML = '<div class="chat-list"></div>';
    const list = chatArea.querySelector('.chat-list');

    conversations.forEach(conversation => {
        const meta = getConversationDisplayMeta(conversation);
        if (!meta.title) return;

        const lastMessage = conversation.messages[conversation.messages.length - 1];
        const lastText = lastMessage?.text || 'Начните диалог';
        const lastTime = formatChatTime(lastMessage?.timestamp || conversation.updatedAt);
        const hasUnread = Boolean(unreadMap[conversation.id]);
        const subtitlePrefix = meta.isGroup ? `[Группа] ` : '';
        const avatarHtml = meta.isGroup
            ? createGroupAvatarMarkup(meta.title, meta.avatar)
            : createAvatarMarkup({
                email: meta.peerEmail,
                displayName: meta.title,
                avatar: meta.avatar,
                glowColor: meta.glowColor
            });

        const row = document.createElement('button');
        row.type = 'button';
        row.className = `chat-list-item${hasUnread ? ' has-unread' : ''}`;
        row.innerHTML = `
            ${avatarHtml}
            <div class="chat-list-content">
                <div class="chat-list-top">
                    <span class="chat-list-name">${meta.isGroup ? escapeHtml(meta.title) : renderDisplayNameWithGradient(meta.title, meta.peerEmail)}</span>
                    <span class="chat-list-time">${escapeHtml(lastTime)}</span>
                </div>
                <div class="chat-list-bottom">${escapeHtml(subtitlePrefix + lastText)}</div>
            </div>
            ${hasUnread ? '<span class="chat-unread-badge" aria-label="Непрочитанное сообщение"></span>' : ''}
        `;

        row.addEventListener('click', (e) => {
            if (e.target.closest('.user-profile-trigger')) return;

            activeConversationId = conversation.id;
            if (searchModeActive) {
                addSearchHistoryItem('chats', conversation.id, meta.title, meta.isGroup ? 'Групповой чат' : '@username');
            }
            markConversationAsRead(conversation.id);
            scheduleChatAreaUpdate({ skipRemoteRefresh: true });
        });

        const avatarTrigger = row.querySelector('.user-profile-trigger');
        if (avatarTrigger && !meta.isGroup && meta.peerEmail) {
            avatarTrigger.addEventListener('click', (e) => {
                e.preventDefault();
                e.stopPropagation();
                openUserProfileScreenByEmail(meta.peerEmail, 'screen-main');
            });
        }

        list.appendChild(row);
    });

    updateUnreadUiIndicators();
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
            avatar: getAvatarByEmail(email),
            glowColor: getUserProfileDataByEmail(email).glowColor
        }));

    if (!contacts.length) {
        chatArea.innerHTML = '<div class="no-chats-message">Контакты пусты. Добавьте пользователей через их профиль.</div>';
        return;
    }

    chatArea.innerHTML = '<div class="chat-list"></div>';
    const list = chatArea.querySelector('.chat-list');

    contacts.forEach(user => {
        const showEmail = canCurrentUserSeeEmailOf(user.email);
        const subtitleText = showEmail
            ? user.email
            : (user.username ? '@' + user.username : '@username не указан');

        const row = document.createElement('button');
        row.type = 'button';
        row.className = 'chat-list-item';
        row.innerHTML = `
            ${createAvatarMarkup(user)}
            <div class="chat-list-content">
                <div class="chat-list-top">
                    <span class="chat-list-name">${renderDisplayNameWithGradient(user.displayName, user.email)}</span>
                    <span class="chat-list-time">Контакт</span>
                </div>
                <div class="chat-list-bottom">${escapeHtml(subtitleText)}</div>
            </div>
        `;

        row.addEventListener('click', (e) => {
            if (e.target.closest('.user-profile-trigger')) return;

            if (walletContactSelectionMode) {
                walletContactSelectionMode = false;
                selectedWalletSendContact = normalizeEmail(user.email);
                populateWalletSendContacts();
                goToScreen('screen-wallet-send');
                return;
            }

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
    if (!message) return 'sent';
    if (message.sender !== currentUserEmail) return 'none';
    if (message.pending) return 'pending';
    if (message.failed) return 'failed';

    const readBy = Array.isArray(message.read_by) ? message.read_by : [];
    if (!peerEmail) {
        return readBy.some((email) => email && email !== currentUserEmail) ? 'read' : 'sent';
    }
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
        peerEmail ? getUserPresenceText(peerEmail) : String(conversation?.participants?.length || 0)
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

function createMessageBubbleMarkup(message, peerEmail, isGrouped, conversation) {
    const isOutgoing = message.sender === currentUserEmail;
    const timestamp = new Date(message.timestamp || 0);
    const timeString = timestamp.toLocaleTimeString('ru-RU', {
        hour: '2-digit',
        minute: '2-digit',
        hour12: false
    });
    const fullTimeString = timeString; // show only time inside bubbles (date moved to separators)
    const messageStatus = isOutgoing ? getMessageReadStatus(message, peerEmail) : '';
    let fileMarkup = '';
    const normalizedFile = normalizeMessageFilePayload(message.file);
    const hasFile = Boolean(normalizedFile);
    const rawText = String(message.text || '');
    const normalizedText = rawText.trim();
    const syntheticFileLabel = /^📎\s+/u.test(normalizedText) || normalizedText === '[file]';
    const showText = normalizedText.length > 0 && !(hasFile && syntheticFileLabel);

    const mediaFooterMarkup = `
        <div class="message-media-footer">
            <span class="message-time">${escapeHtml(fullTimeString)}</span>
            ${isOutgoing ? `<span class="message-status" data-state="${escapeHtml(messageStatus)}">${getMessageStatusIconMarkup(messageStatus)}</span>` : ''}
        </div>
    `;

    if (hasFile) {
        const fileData = normalizedFile;
        const safeName = escapeHtml(fileData.name || 'Файл');
        const safeData = escapeHtml(fileData.data || '');

        if (String(fileData.type || '').startsWith('image/')) {
            fileMarkup = `
                <div class="message-file">
                    <img class="message-file-preview image" src="${safeData}" alt="${safeName}" data-file-preview="image" data-file-name="${safeName}" data-file-src="${safeData}">
                    ${mediaFooterMarkup}
                    <div class="message-file-name">${safeName}</div>
                </div>
            `;
        } else if (String(fileData.type || '').startsWith('video/')) {
            const videoId = `video-${escapeHtml(message.id || Math.random().toString(36).slice(2, 9))}`;
            fileMarkup = `
                <div class="message-file message-file-video">
                    <div class="c-video-item">
                        <div class="c-ex-video js-ex-video" id="${videoId}" data-video-src="${safeData}" data-file-preview="video" data-file-name="${safeName}" data-file-src="${safeData}">
                            <button type="button" class="c-ex-video__close js-ex-video__close" data-parentid="${videoId}" aria-label="Закрыть видео"></button>
                            <video class="c-ex-video__player js-inline-video-player" playsinline preload="metadata" data-parentid="${videoId}" src="${safeData}" data-file-preview="video" data-file-name="${safeName}" data-file-src="${safeData}"></video>
                        </div>
                    </div>
                    ${mediaFooterMarkup}
                    <div class="message-file-name">${safeName}</div>
                </div>
            `;
        } else if (String(fileData.type || '').startsWith('audio/')) {
            fileMarkup = `
                <div class="message-file">
                    <audio class="message-file-preview" controls src="${safeData}"></audio>
                    ${mediaFooterMarkup}
                    <div class="message-file-name">${safeName}</div>
                </div>
            `;
        } else {
            fileMarkup = `
                <div class="message-file">
                    ${mediaFooterMarkup}
                    <div class="message-file-name">${safeName}</div>
                </div>
            `;
        }
    }

    const showIncomingAvatar = !isOutgoing && isGroupConversation(conversation);
    let senderAvatar = '';
    if (showIncomingAvatar) {
        const senderEmail = normalizeEmail(message.sender || '');
        const senderName = getDisplayNameByEmail(senderEmail) || 'Пользователь';
        const senderAvatarUrl = getAvatarByEmail(senderEmail);
        const senderFirst = senderName.charAt(0).toUpperCase();
        senderAvatar = senderAvatarUrl
            ? `<div class="message-sender-avatar" style="background-image:url('${escapeHtml(senderAvatarUrl)}');" title="${escapeHtml(senderName)}"></div>`
            : `<div class="message-sender-avatar fallback" title="${escapeHtml(senderName)}">${escapeHtml(senderFirst)}</div>`;
    }

    return `
        <div class="message-row ${isOutgoing ? 'outgoing' : 'incoming'}">
            ${isOutgoing ? '' : senderAvatar}
            <div class="message ${isOutgoing ? 'outgoing' : 'incoming'}${isGrouped ? ' message-grouped' : ''}${hasFile ? ' message-has-file' : ''}${hasFile && !showText ? ' message-file-only' : ''}" data-message-id="${escapeHtml(message.id || '')}" data-sender="${escapeHtml(message.sender || '')}">
                <div class="message-content">
                    ${showText ? `<span class="message-text">${escapeHtml(rawText)}</span>` : ''}
                    ${fileMarkup}
                    ${hasFile ? '' : `<div class="message-footer"><span class="message-time">${escapeHtml(fullTimeString)}</span>${isOutgoing ? `<span class="message-status" data-state="${escapeHtml(messageStatus)}">${getMessageStatusIconMarkup(messageStatus)}</span>` : ''}</div>`}
                </div>
            </div>
        </div>
    `;
}

function bindThreadInteractions(chatArea, peerEmail, conversation) {
    const backBtn = document.getElementById('thread-back-btn');
    const peerAvatarTrigger = chatArea.querySelector('.thread-peer-avatar.user-profile-trigger');
    const threadHeader = chatArea.querySelector('.thread-header');
    const messagesContainer = document.getElementById('thread-messages');

    if (peerAvatarTrigger) {
        peerAvatarTrigger.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            openUserProfileScreenByEmail(peerEmail, 'screen-main');
        });
    }

    if (threadHeader && isGroupConversation(conversation)) {
        threadHeader.classList.add('group-thread-header');
        threadHeader.addEventListener('click', (e) => {
            if (e.target.closest('#thread-back-btn')) return;
            openConversationInfoScreen(conversation.id);
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
            openChatMediaModal({
                type: 'image',
                src: imagePreview.getAttribute('data-file-src') || '',
                name: imagePreview.getAttribute('data-file-name') || 'image'
            });
            return;
        }

        const videoPreview = e.target.closest('[data-file-preview="video"]');
        if (videoPreview) {
            e.preventDefault();
            e.stopPropagation();
            openChatMediaModal({
                type: 'video',
                src: videoPreview.getAttribute('data-file-src') || '',
                name: videoPreview.getAttribute('data-file-name') || 'video'
            });
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

function openChatMediaModal({ type = 'image', src = '', name = '' } = {}) {
    const modal = document.getElementById('image-modal');
    const modalImg = document.getElementById('image-modal-img');
    const modalVideo = document.getElementById('image-modal-video');
    const modalDownloadBtn = document.getElementById('image-modal-download');
    if (!modal || !modalImg || !modalVideo || !modalDownloadBtn || !src) return;

    const safeName = String(name || (type === 'video' ? 'video' : 'image'));
    const mediaType = type === 'video' ? 'video' : 'image';

    modal.dataset.type = mediaType;
    modalDownloadBtn.href = src;
    modalDownloadBtn.download = safeName;

    if (mediaType === 'video') {
        modalImg.classList.remove('active');
        modalImg.removeAttribute('src');
        modalVideo.src = src;
        modalVideo.classList.add('active');
        modalVideo.currentTime = 0;
    } else {
        modalVideo.pause();
        modalVideo.removeAttribute('src');
        modalVideo.classList.remove('active');
        modalImg.src = src;
        modalImg.alt = safeName;
        modalImg.classList.add('active');
    }

    modal.classList.add('active');
}

function bindInlineVideoPlayers(container) {
    if (!container) return;

    const players = Array.from(container.querySelectorAll('.js-inline-video-player'));
    const closeButtons = Array.from(container.querySelectorAll('.js-ex-video__close'));

    players.forEach((player) => {
        if (player.dataset.bound === '1') return;
        const parentId = player.getAttribute('data-parentid') || '';
        const parent = parentId ? document.getElementById(parentId) : null;

        // Keep native controls hidden while video is in compact circular preview.
        player.controls = Boolean(parent?.classList.contains('is-active'));

        if (parent && parent.dataset.bound !== '1') {
            parent.addEventListener('click', (event) => {
                if (event.target.closest('.js-ex-video__close')) return;
                if (event.target.closest('[data-file-preview="video"]')) return;
                if (!parent.classList.contains('is-active')) {
                    parent.classList.add('is-active');
                    player.controls = true;
                    const playPromise = player.play();
                    if (playPromise && typeof playPromise.catch === 'function') {
                        playPromise.catch(() => {
                            // Autoplay can be blocked; user can press play manually.
                        });
                    }
                }
            });
            parent.dataset.bound = '1';
        }

        player.addEventListener('play', () => {
            players.forEach((other) => {
                const otherParentId = other.getAttribute('data-parentid') || '';
                const otherParent = otherParentId ? document.getElementById(otherParentId) : null;
                if (other === player) return;
                other.pause();
                if (otherParent) {
                    otherParent.classList.remove('is-active');
                }
                other.controls = false;
                try {
                    other.currentTime = 0;
                } catch (_error) {
                    // ignore reset errors
                }
            });

            if (parent) {
                parent.classList.add('is-active');
            }
            player.controls = true;
        });

        player.addEventListener('ended', () => {
            if (parent) {
                parent.classList.remove('is-active');
            }
            player.controls = false;
            try {
                player.currentTime = 0;
            } catch (_error) {
                // ignore reset errors
            }
        });

        player.dataset.bound = '1';
    });

    closeButtons.forEach((button) => {
        if (button.dataset.bound === '1') return;
        const parentId = button.getAttribute('data-parentid') || '';
        const parent = parentId ? document.getElementById(parentId) : null;
        const video = parent?.querySelector('video');

        button.addEventListener('click', () => {
            if (!video || !parent) return;
            video.pause();
            parent.classList.remove('is-active');
            video.controls = false;
            try {
                video.currentTime = 0;
            } catch (_error) {
                // ignore reset errors
            }
        });

        button.dataset.bound = '1';
    });
}

function renderConversationThread(chatArea, conversation) {
    const meta = getConversationDisplayMeta(conversation);
    const peerEmail = meta.peerEmail;
    const peerName = meta.title;
    const peerAvatar = meta.avatar;
    const peerGlowColor = meta.glowColor;
    const peerFirstLetter = meta.firstLetter;
    const threadAvatarStyleParts = [`--avatar-glow:${escapeHtml(peerGlowColor)};`];
    if (peerAvatar) {
        threadAvatarStyleParts.push(`background-image:url('${escapeHtml(peerAvatar)}');`);
    }
    const avatarStyle = `style="${threadAvatarStyleParts.join(' ')}"`;
    const headerSubtitle = meta.subtitle;
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
                    <div class="thread-peer-avatar ${meta.isGroup ? '' : 'user-profile-trigger'} ${peerAvatar ? '' : 'fallback'}" data-email="${escapeHtml(peerEmail || '')}" ${avatarStyle}>${peerAvatar ? '' : escapeHtml(peerFirstLetter)}</div>
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

        bindThreadInteractions(chatArea, meta.isGroup ? '' : peerEmail, conversation);
    } else {
        const avatarNode = chatArea.querySelector('.thread-peer-avatar');
        const nameNode = chatArea.querySelector('.thread-peer-name');
        const subtitleNode = chatArea.querySelector('.thread-peer-subtitle');

        if (avatarNode) {
            avatarNode.className = `thread-peer-avatar ${meta.isGroup ? '' : 'user-profile-trigger'} ${peerAvatar ? '' : 'fallback'}`.trim();
            avatarNode.setAttribute('data-email', peerEmail || '');
            avatarNode.style.setProperty('--avatar-glow', peerGlowColor);
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
            html += createMessageBubbleMarkup(message, peerEmail, isGrouped, conversation);
            prevTimestamp = msgTs;
            prevSender = message.sender;
        });

        messagesContainer.innerHTML = html;
        bindInlineVideoPlayers(messagesContainer);
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

async function sendMessageToActiveConversation(text, fileData, forcedConversationId = null) {
    const targetConversationId = forcedConversationId || activeConversationId;
    if (!currentUserEmail || !targetConversationId) return false;
    
    const trimmedText = (text || '').trim();
    
    // Если нет текста и нет файла, то не отправляем
    if (!trimmedText && !fileData) return false;

    const store = getConversationsStore();
    const conversation = store[targetConversationId];
    if (!conversation) return false;

    let messageBody = trimmedText;
    let attachedFile = null;
    
    if (fileData) {
        attachedFile = fileData;
        messageBody = trimmedText || '[file]';
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
    store[targetConversationId] = conversation;
    saveConversationsStore(store);
    scheduleChatAreaUpdate({ skipRemoteRefresh: true });
    
    // Проигрываем звук отправления
    playSendMessageSound();

    const client = getSupabaseClient();
    if (client && supabaseMessagesTableAvailable) {
        try {
            const buildMessageRow = (filePayload) => ({
                conversation_id: targetConversationId,
                participants: conversation.participants,
                sender_email: currentUserEmail,
                body: messageBody,
                sent_at: optimisticTimestamp,
                read_by: [currentUserEmail],
                file: filePayload
            });

            let data = null;
            let error = null;

            const primaryAttempt = await client
                .from('messages_app')
                .insert(buildMessageRow(attachedFile ? JSON.stringify(attachedFile) : null))
                .select('id, conversation_id, participants, sender_email, body, sent_at, deleted_for, read_by, file')
                .single();

            data = primaryAttempt.data || null;
            error = primaryAttempt.error || null;

            if (error && attachedFile) {
                // Compatibility fallback: some schemas keep file as jsonb and expect object payload.
                const retryObject = await client
                    .from('messages_app')
                    .insert(buildMessageRow(attachedFile))
                    .select('id, conversation_id, participants, sender_email, body, sent_at, deleted_for, read_by, file')
                    .single();

                if (!retryObject.error) {
                    data = retryObject.data || null;
                    error = null;
                }
            }

            const freshStore = getConversationsStore();
            const freshConversation = freshStore[targetConversationId];

            if (error) {
                if (freshConversation) {
                    freshConversation.messages = freshConversation.messages.map(message => {
                        if (message.id === optimisticId) {
                            return {
                                ...message,
                                pending: false,
                                failed: true
                            };
                        }
                        return message;
                    });
                    freshStore[targetConversationId] = freshConversation;
                    saveConversationsStore(freshStore);
                }

                if (isSupabaseMessagesTableMissing(error)) {
                    supabaseMessagesTableAvailable = false;
                    if (!supabaseMessagesMissingWarningShown) {
                        alert('Таблица сообщений в Supabase не найдена. Временно используется локальный чат. Запусти SQL из supabase-schema.sql.');
                        supabaseMessagesMissingWarningShown = true;
                    }
                    updateChatArea({ skipRemoteRefresh: true });
                    return false;
                }

                console.warn('Supabase send failed', error);
                updateChatArea({ skipRemoteRefresh: true });
                return false;
            }

            if (freshConversation) {
                freshConversation.messages = freshConversation.messages.filter(message => message.id !== optimisticId);
                freshStore[targetConversationId] = freshConversation;
                saveConversationsStore(freshStore);
            }

            if (data) {
                mergeSupabaseMessageRowIntoStore(data);
                updateChatArea({ skipRemoteRefresh: true });
                void sendWebPushForMessage(conversation, data);
            }
            return true;
        } catch (transportError) {
            const freshStore = getConversationsStore();
            const freshConversation = freshStore[targetConversationId];
            if (freshConversation) {
                freshConversation.messages = freshConversation.messages.map(message => {
                    if (message.id === optimisticId) {
                        return {
                            ...message,
                            pending: false,
                            failed: true
                        };
                    }
                    return message;
                });
                freshStore[targetConversationId] = freshConversation;
                saveConversationsStore(freshStore);
            }
            console.warn('Supabase transport exception', transportError);
            updateChatArea({ skipRemoteRefresh: true });
            return false;
        }
    }

    const localStore = getConversationsStore();
    const localConversation = localStore[targetConversationId];
    if (localConversation) {
        localConversation.messages = localConversation.messages.map(message => {
            if (message.id === optimisticId) {
                return {
                    ...message,
                    pending: false,
                    failed: true
                };
            }
            return message;
        });
        localStore[targetConversationId] = localConversation;
        saveConversationsStore(localStore);
    }

    updateChatArea({ skipRemoteRefresh: true });
    return false;
}

function enqueueOutgoingMessage(text, fileData, conversationId) {
    if (!conversationId || !currentUserEmail) return;

    outgoingMessageQueue.push({
        text: String(text || ''),
        fileData: fileData || null,
        conversationId,
        queuedAt: Date.now()
    });

    processOutgoingMessageQueue();
}

function inferMimeTypeFromName(fileName = '') {
    const value = String(fileName || '').trim().toLowerCase();
    if (!value.includes('.')) return 'application/octet-stream';
    const ext = value.split('.').pop() || '';
    const map = {
        jpg: 'image/jpeg',
        jpeg: 'image/jpeg',
        png: 'image/png',
        gif: 'image/gif',
        webp: 'image/webp',
        mp4: 'video/mp4',
        webm: 'video/webm',
        mov: 'video/quicktime',
        m4v: 'video/x-m4v',
        mp3: 'audio/mpeg',
        wav: 'audio/wav',
        ogg: 'audio/ogg'
    };
    return map[ext] || 'application/octet-stream';
}

function openCreateGroupChatDialog() {
    groupCreateSelectedEmails = new Set();
    groupCreateAvatarDataUrl = '';

    if (groupCreateTitleInput) {
        groupCreateTitleInput.value = '';
    }

    setConversationAvatarPreview(groupCreateAvatarPreview, groupCreateAvatarDataUrl);

    renderGroupCreateCandidates();
    syncGroupCreateSubmitState();
    goToScreen('screen-create-group');
}

function getGroupChatCandidates() {
    const map = new Map();
    const myEmail = normalizeEmail(currentUserEmail || '');
    const blocked = new Set(getBlockedUsersForCurrentUser());

    const addCandidate = (email, source) => {
        const normalized = normalizeEmail(email || '');
        if (!normalized || normalized === myEmail || blocked.has(normalized)) return;

        const existing = map.get(normalized);
        if (existing) {
            existing.fromContacts = existing.fromContacts || source === 'contacts';
            existing.fromChats = existing.fromChats || source === 'chats';
            return;
        }

        map.set(normalized, {
            email: normalized,
            displayName: getDisplayNameByEmail(normalized) || normalized,
            username: getUsernameByEmail(normalized) || '',
            avatar: getAvatarByEmail(normalized),
            glowColor: getUserProfileDataByEmail(normalized).glowColor,
            fromContacts: source === 'contacts',
            fromChats: source === 'chats'
        });
    };

    getCurrentUserContacts().forEach((email) => addCandidate(email, 'contacts'));

    getCurrentUserConversations().forEach((conversation) => {
        (conversation.participants || []).forEach((email) => addCandidate(email, 'chats'));
    });

    return Array.from(map.values()).sort((a, b) => a.displayName.localeCompare(b.displayName, 'ru'));
}

function getInviteCandidatesForConversation(conversation) {
    if (!conversation) return [];
    const participants = new Set((conversation.participants || []).map((email) => normalizeEmail(email)).filter(Boolean));
    return getGroupChatCandidates().filter((user) => !participants.has(normalizeEmail(user.email)));
}

function buildMemberAvatarMarkup(email, displayName, avatarUrl, glowColorRaw = 'gradient') {
    const safeName = displayName || 'Пользователь';
    const firstLetter = safeName.charAt(0).toUpperCase() || 'U';
    const glowColor = getGlowColorValue(glowColorRaw);
    if (avatarUrl) {
        return `<div class="conversation-member-avatar" style="--avatar-glow:${escapeHtml(glowColor)};"><img src="${escapeHtml(avatarUrl)}" alt="${escapeHtml(safeName)}"></div>`;
    }
    return `<div class="conversation-member-avatar fallback" style="--avatar-glow:${escapeHtml(glowColor)};">${escapeHtml(firstLetter)}</div>`;
}

function setConversationAvatarPreview(node, dataUrl = '') {
    if (!node) return;
    const value = String(dataUrl || '').trim();
    const hasImage = Boolean(value);
    node.classList.toggle('fallback', !hasImage);
    node.classList.toggle('has-image', hasImage);
    node.style.backgroundImage = hasImage ? `url('${escapeHtml(value)}')` : '';
    node.textContent = hasImage ? '' : '+';
}

function updateConversationInStore(conversationId, mutate) {
    const store = getConversationsStore();
    const conversation = store[conversationId];
    if (!conversation) return null;
    ensureGroupConversationMeta(conversation);
    mutate(conversation);
    conversation.updatedAt = Date.now();
    store[conversationId] = conversation;
    saveConversationsStore(store);
    return conversation;
}

function openConversationInfoScreen(conversationId) {
    const conversation = getConversationById(conversationId);
    if (!conversation || !isGroupConversation(conversation)) return;
    currentConversationInfoId = conversationId;
    renderConversationInfoScreen();
    goToScreen('screen-conversation-info');
}

function renderConversationInfoMembers(conversation) {
    if (!conversationInfoMembersEl) return;
    const ownerEmail = getConversationOwnerEmail(conversation);
    const adminSet = getConversationAdminSet(conversation);

    const members = (conversation.participants || [])
        .map((email) => normalizeEmail(email))
        .filter(Boolean)
        .map((email) => ({
            email,
            displayName: getDisplayNameByEmail(email),
            avatar: getAvatarByEmail(email),
            role: email === ownerEmail ? 'owner' : (adminSet.has(email) ? 'admin' : 'member')
        }));

    conversationInfoMembersEl.innerHTML = '';
    if (!members.length) {
        conversationInfoMembersEl.innerHTML = '<div class="devices-empty">Участники не найдены</div>';
        return;
    }

    members.forEach((member) => {
        const row = document.createElement('div');
        row.className = 'device-item conversation-member-row';

        row.innerHTML = `
            ${buildMemberAvatarMarkup(member.email, member.displayName, member.avatar, getUserProfileDataByEmail(member.email).glowColor)}
            <div class="device-item-main group-candidate-main">
                <div class="device-item-title">${renderDisplayNameWithGradient(member.displayName, member.email)}</div>
                <div class="device-item-meta">&nbsp;</div>
            </div>
            ${member.role === 'admin' ? '<span class="conversation-role-badge">АДМИН</span>' : ''}
        `;

        conversationInfoMembersEl.appendChild(row);
    });
}

function renderConversationMainAvatar(conversation) {
    if (!conversationInfoAvatarEl) return;
    const title = String(conversation.title || '').trim();
    const storedAvatar = String(conversation.avatar || '').trim();
    if (storedAvatar) {
        conversationInfoAvatarEl.classList.add('has-image');
        conversationInfoAvatarEl.style.backgroundImage = `url('${escapeHtml(storedAvatar)}')`;
        conversationInfoAvatarEl.textContent = '';
        return;
    }
    const participants = (conversation.participants || [])
        .map((email) => normalizeEmail(email))
        .filter(Boolean)
        .filter((email) => email !== normalizeEmail(currentUserEmail || ''));
    const previewEmail = participants[0] || getConversationOwnerEmail(conversation);
    const previewAvatar = previewEmail ? getAvatarByEmail(previewEmail) : '';

    conversationInfoAvatarEl.classList.remove('has-image');
    conversationInfoAvatarEl.style.backgroundImage = '';
    if (previewAvatar) {
        conversationInfoAvatarEl.classList.add('has-image');
        conversationInfoAvatarEl.style.backgroundImage = `url('${escapeHtml(previewAvatar)}')`;
        conversationInfoAvatarEl.textContent = '';
        return;
    }

    conversationInfoAvatarEl.textContent = (title.charAt(0).toUpperCase() || 'B');
}

function openConversationEditScreen() {
    const conversation = getConversationById(currentConversationInfoId || '');
    if (!conversation) return;
    if (conversationEditTitleInput) {
        conversationEditTitleInput.value = String(conversation.title || '').trim();
    }
    conversationEditAvatarDataUrl = String(conversation.avatar || '').trim();
    setConversationAvatarPreview(conversationEditAvatarPreview, conversationEditAvatarDataUrl);
    goToScreen('screen-conversation-edit');
}

function syncConversationInviteSubmitState() {
    if (conversationInviteSelectedCountEl) {
        conversationInviteSelectedCountEl.textContent = 'Выбрано: ' + conversationInviteSelectedEmails.size;
    }
    if (conversationInviteSubmitBtn) {
        conversationInviteSubmitBtn.disabled = conversationInviteSelectedEmails.size < 1;
    }
}

function renderConversationInviteScreen() {
    if (!conversationInviteCandidatesEl) return;
    const conversation = getConversationById(currentConversationInfoId || '');
    if (!conversation) return;
    conversationInviteSelectedEmails = new Set();

    const candidates = getInviteCandidatesForConversation(conversation);
    conversationInviteCandidatesEl.innerHTML = '';
    if (!candidates.length) {
        conversationInviteCandidatesEl.innerHTML = '<div class="devices-empty">Нет пользователей для приглашения</div>';
        syncConversationInviteSubmitState();
        return;
    }

    candidates.forEach((user) => {
        const row = document.createElement('button');
        row.type = 'button';
        row.className = 'device-item group-candidate-row';
        row.dataset.email = user.email;
        row.innerHTML = `
            ${buildMemberAvatarMarkup(user.email, user.displayName, user.avatar, user.glowColor)}
            <div class="device-item-main group-candidate-main">
                <div class="device-item-title">${renderDisplayNameWithGradient(user.displayName, user.email)}</div>
            </div>
            <span class="group-candidate-check">✓</span>
        `;
        row.addEventListener('click', () => {
            if (conversationInviteSelectedEmails.has(user.email)) {
                conversationInviteSelectedEmails.delete(user.email);
                row.classList.remove('selected');
            } else {
                conversationInviteSelectedEmails.add(user.email);
                row.classList.add('selected');
            }
            syncConversationInviteSubmitState();
        });
        conversationInviteCandidatesEl.appendChild(row);
    });

    syncConversationInviteSubmitState();
}

function renderConversationAdminsScreen() {
    if (!conversationAdminsMembersEl) return;
    const conversation = getConversationById(currentConversationInfoId || '');
    if (!conversation) return;
    ensureGroupConversationMeta(conversation);

    const ownerEmail = getConversationOwnerEmail(conversation);
    const adminSet = getConversationAdminSet(conversation);
    conversationAdminDraftSet = new Set(Array.from(adminSet));

    const members = (conversation.participants || []).map((email) => normalizeEmail(email)).filter(Boolean);
    conversationAdminsMembersEl.innerHTML = '';
    members.forEach((email) => {
        const isOwner = email === ownerEmail;
        const row = document.createElement('button');
        row.type = 'button';
        row.className = 'device-item group-candidate-row';
        if (conversationAdminDraftSet.has(email)) {
            row.classList.add('selected');
        }

        row.innerHTML = `
            ${buildMemberAvatarMarkup(email, getDisplayNameByEmail(email), getAvatarByEmail(email), getUserProfileDataByEmail(email).glowColor)}
            <div class="device-item-main group-candidate-main">
                <div class="device-item-title">${renderDisplayNameWithGradient(getDisplayNameByEmail(email), email)}</div>
                <div class="device-item-meta">${isOwner ? 'Владелец' : 'Нажмите, чтобы назначить админом'}</div>
            </div>
            <span class="group-candidate-check">✓</span>
        `;

        row.addEventListener('click', () => {
            if (isOwner) return;
            if (conversationAdminDraftSet.has(email)) {
                conversationAdminDraftSet.delete(email);
                row.classList.remove('selected');
            } else {
                conversationAdminDraftSet.add(email);
                row.classList.add('selected');
            }
            if (conversationAdminsSelectedCountEl) {
                conversationAdminsSelectedCountEl.textContent = 'Админов: ' + conversationAdminDraftSet.size;
            }
        });

        conversationAdminsMembersEl.appendChild(row);
    });

    if (conversationAdminsSelectedCountEl) {
        conversationAdminsSelectedCountEl.textContent = 'Админов: ' + conversationAdminDraftSet.size;
    }
}

function renderConversationInfoScreen() {
    const conversation = getConversationById(currentConversationInfoId || '');
    if (!conversation || !isGroupConversation(conversation)) {
        goToScreen('screen-main');
        return;
    }

    ensureGroupConversationMeta(conversation);
    const ownerEmail = getConversationOwnerEmail(conversation);
    const adminSet = getConversationAdminSet(conversation);
    const meEmail = normalizeEmail(currentUserEmail || '');
    const isOwner = meEmail === ownerEmail;
    const canManageInfo = isOwner || adminSet.has(meEmail);
    const participants = (conversation.participants || []).map((email) => normalizeEmail(email)).filter(Boolean);
    const title = String(conversation.title || '').trim() || `Беседа (${participants.length})`;

    if (conversationInfoTitleEl) conversationInfoTitleEl.textContent = title;
    if (conversationInfoSubtitleEl) conversationInfoSubtitleEl.textContent = `${participants.length} участников`;
    if (conversationInfoRoleNoteEl) {
        conversationInfoRoleNoteEl.textContent = isOwner ? 'Владелец' : '';
    }
    renderConversationMainAvatar(conversation);

    if (conversationInfoOwnerActionsEl) {
        conversationInfoOwnerActionsEl.classList.toggle('hidden', !isOwner);
    }

    if (conversationInfoAvatarEl) {
        conversationInfoAvatarEl.classList.toggle('editable', canManageInfo);
    }

    if (conversationInfoDeleteBtn) {
        conversationInfoDeleteBtn.classList.toggle('owner-only', !isOwner);
        conversationInfoDeleteBtn.style.display = isOwner ? 'inline-flex' : 'none';
    }
    if (conversationMenuDeleteBtn) {
        conversationMenuDeleteBtn.style.display = isOwner ? 'inline-flex' : 'none';
    }

    renderConversationInfoMembers(conversation);
}

function handleLeaveConversationFromInfo() {
    const conversation = getConversationById(currentConversationInfoId || '');
    if (!conversation) return;
    if (!confirm('Покинуть эту беседу?')) return;

    const me = normalizeEmail(currentUserEmail || '');
    updateConversationInStore(conversation.id, (target) => {
        target.participants = (target.participants || []).filter((email) => normalizeEmail(email) !== me);
        const admins = getConversationAdminSet(target);
        admins.delete(me);
        target.admins = Array.from(admins);
    });

    if (activeConversationId === conversation.id) {
        activeConversationId = null;
    }
    goToScreen('screen-main');
    scheduleChatAreaUpdate({ skipRemoteRefresh: true });
}

function handleDeleteConversationFromInfo() {
    const conversation = getConversationById(currentConversationInfoId || '');
    if (!conversation) return;
    const ownerEmail = getConversationOwnerEmail(conversation);
    if (normalizeEmail(currentUserEmail || '') !== ownerEmail) {
        alert('Удалить беседу может только владелец.');
        return;
    }
    if (!confirm('Удалить беседу для всех участников?')) return;

    const store = getConversationsStore();
    delete store[conversation.id];
    saveConversationsStore(store);
    if (activeConversationId === conversation.id) {
        activeConversationId = null;
    }
    goToScreen('screen-main');
    scheduleChatAreaUpdate({ skipRemoteRefresh: true });
}

function syncGroupCreateSubmitState() {
    if (groupCreateSelectedCountEl) {
        groupCreateSelectedCountEl.textContent = 'Выбрано: ' + groupCreateSelectedEmails.size;
    }
    if (groupCreateSubmitBtn) {
        groupCreateSubmitBtn.disabled = groupCreateSelectedEmails.size < 2;
    }
}

function renderGroupCreateCandidates() {
    if (!groupCreateCandidatesEl) return;

    const candidates = getGroupChatCandidates();
    if (!candidates.length) {
        groupCreateCandidatesEl.innerHTML = '<div class="devices-empty">Нет пользователей для добавления. Добавьте контакты или начните переписку.</div>';
        return;
    }

    groupCreateCandidatesEl.innerHTML = '';

    candidates.forEach((user) => {
        const row = document.createElement('button');
        row.type = 'button';
        row.className = 'device-item group-candidate-row';
        row.dataset.email = user.email;
        if (groupCreateSelectedEmails.has(user.email)) {
            row.classList.add('selected');
        }

        const sourceLabel = user.fromContacts && user.fromChats
            ? 'Контакт и чат'
            : (user.fromContacts ? 'Контакт' : 'Из переписки');

        const avatarHtml = createAvatarMarkup({
            email: user.email,
            displayName: user.displayName,
            avatar: user.avatar,
            glowColor: user.glowColor
        });

        row.innerHTML = `
            ${avatarHtml}
            <div class="device-item-main group-candidate-main">
                <div class="device-item-title">${escapeHtml(user.displayName)}</div>
                <div class="device-item-meta">${escapeHtml(sourceLabel)}</div>
            </div>
            <span class="group-candidate-check">✓</span>
        `;

        row.addEventListener('click', () => {
            if (groupCreateSelectedEmails.has(user.email)) {
                groupCreateSelectedEmails.delete(user.email);
                row.classList.remove('selected');
            } else {
                groupCreateSelectedEmails.add(user.email);
                row.classList.add('selected');
            }
            syncGroupCreateSubmitState();
        });

        groupCreateCandidatesEl.appendChild(row);
    });
}

async function processOutgoingMessageQueue() {
    if (isOutgoingQueueProcessing) return;
    if (!outgoingMessageQueue.length) return;

    isOutgoingQueueProcessing = true;
    pendingMessageSend = true;

    try {
        while (outgoingMessageQueue.length) {
            const item = outgoingMessageQueue[0];
            const sent = await sendMessageToActiveConversation(item.text, item.fileData, item.conversationId);
            outgoingMessageQueue.shift();
            if (!sent) {
                // Do not block the entire queue on one failed message.
                continue;
            }
        }
    } finally {
        pendingMessageSend = false;
        isOutgoingQueueProcessing = false;
    }
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
    const chatActionBtn = document.getElementById('chat-action-btn');
    const fileUploadBtn = document.getElementById('file-upload-btn');
    const fileInput = document.getElementById('file-input');
    const fileDraftNode = document.getElementById('chat-file-draft');
    const searchInput = document.getElementById('chat-search');

    const renderPendingAttachmentDraft = () => {
        if (!fileDraftNode) return;
        if (!pendingAttachmentDraft) {
            fileDraftNode.innerHTML = '';
            fileDraftNode.classList.remove('active');
            return;
        }

        const safeName = escapeHtml(pendingAttachmentDraft.name || 'Файл');
        const type = String(pendingAttachmentDraft.type || '');
        const isImage = type.startsWith('image/');
        const preview = isImage
            ? `<img class="chat-file-draft-preview" src="${escapeHtml(pendingAttachmentDraft.data || '')}" alt="${safeName}">`
            : `<div class="chat-file-draft-icon">📎</div>`;

        fileDraftNode.innerHTML = `
            <div class="chat-file-draft-card">
                ${preview}
                <div class="chat-file-draft-meta">
                    <div class="chat-file-draft-name">${safeName}</div>
                    <div class="chat-file-draft-hint">Добавьте описание и отправьте</div>
                </div>
                <button type="button" class="chat-file-draft-remove" id="chat-file-draft-remove" aria-label="Убрать файл">×</button>
            </div>
        `;
        fileDraftNode.classList.add('active');

        const removeBtn = document.getElementById('chat-file-draft-remove');
        if (removeBtn) {
            removeBtn.addEventListener('click', () => {
                pendingAttachmentDraft = null;
                if (fileInput) fileInput.value = '';
                renderPendingAttachmentDraft();
                updateComposerActionButton();
            });
        }
    };

    const updateComposerActionButton = () => {
        if (!chatActionBtn || !messageInput) return;
        const hasText = Boolean((messageInput.value || '').trim());
        const hasPendingFile = Boolean(pendingAttachmentDraft);
        const hasSendIntent = hasText || hasPendingFile;
        const mode = hasSendIntent ? 'send' : 'file';
        if (fileUploadBtn) {
            fileUploadBtn.classList.toggle('is-visible', hasText);
        }
        chatActionBtn.dataset.mode = mode;
        chatActionBtn.setAttribute('aria-label', hasSendIntent ? 'Отправить сообщение' : 'Выбрать файл');
        chatActionBtn.classList.toggle('send-mode', hasSendIntent);
        chatActionBtn.innerHTML = hasSendIntent
            ? '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 12L20 4L14 20L11 13L4 12Z"/></svg>'
            : '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21.44 11.05l-8.49 8.49a5 5 0 0 1-7.07-7.07l8.49-8.49a3.5 3.5 0 0 1 4.95 4.95l-8.49 8.49a2 2 0 0 1-2.83-2.83l7.78-7.78"/></svg>';
    };

    const handleFileSelection = async (event) => {
        const file = event?.target?.files?.[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = async (readerEvent) => {
            const base64Data = readerEvent?.target?.result;
            const fileData = {
                name: file.name,
                type: file.type || inferMimeTypeFromName(file.name),
                size: file.size,
                data: base64Data
            };

            pendingAttachmentDraft = fileData;
            renderPendingAttachmentDraft();
            updateComposerActionButton();
            if (fileInput) fileInput.value = '';
        };
        reader.readAsDataURL(file);
    };

    if (createGroupBtn && createGroupBtn.dataset.bound !== '1') {
        createGroupBtn.addEventListener('click', (event) => {
            event.preventDefault();
            openCreateGroupChatDialog();
        });
        createGroupBtn.dataset.bound = '1';
    }

    if (groupCreateBackBtn && groupCreateBackBtn.dataset.bound !== '1') {
        groupCreateBackBtn.addEventListener('click', () => {
            goToScreen('screen-main');
        });
        groupCreateBackBtn.dataset.bound = '1';
    }

    if (groupCreateSubmitBtn && groupCreateSubmitBtn.dataset.bound !== '1') {
        groupCreateSubmitBtn.addEventListener('click', async () => {
            const participants = Array.from(groupCreateSelectedEmails);
            if (participants.length < 2) {
                alert('Выберите минимум 2 участников.');
                return;
            }

            const title = String(groupCreateTitleInput?.value || '').trim();
            const groupConversation = createGroupConversation(participants, title, groupCreateAvatarDataUrl);
            if (!groupConversation) {
                alert('Не удалось создать групповой чат.');
                return;
            }

            const initialSystemText = buildGroupCreatedSystemText(groupConversation.title);
            await sendMessageToActiveConversation(initialSystemText, null, groupConversation.id);

            activeConversationId = groupConversation.id;
            goToScreen('screen-main');
            scheduleChatAreaUpdate({ skipRemoteRefresh: true });
        });
        groupCreateSubmitBtn.dataset.bound = '1';
    }

    if (groupCreateAvatarBtn && groupCreateAvatarBtn.dataset.bound !== '1') {
        groupCreateAvatarBtn.addEventListener('click', () => {
            groupCreateAvatarInput?.click();
        });
        groupCreateAvatarBtn.dataset.bound = '1';
    }

    if (groupCreateAvatarInput && groupCreateAvatarInput.dataset.bound !== '1') {
        groupCreateAvatarInput.addEventListener('change', async (event) => {
            const file = event.target?.files?.[0];
            if (!file) return;
            try {
                groupCreateAvatarDataUrl = await fileToDataUrl(file);
                setConversationAvatarPreview(groupCreateAvatarPreview, groupCreateAvatarDataUrl);
            } catch (_error) {
                alert('Не удалось загрузить фото беседы.');
            } finally {
                groupCreateAvatarInput.value = '';
            }
        });
        groupCreateAvatarInput.dataset.bound = '1';
    }

    if (conversationInfoBackBtn && conversationInfoBackBtn.dataset.bound !== '1') {
        conversationInfoBackBtn.addEventListener('click', () => {
            goToScreen('screen-main');
            scheduleChatAreaUpdate({ skipRemoteRefresh: true });
        });
        conversationInfoBackBtn.dataset.bound = '1';
    }

    if (conversationInfoAvatarEl && conversationInfoAvatarEl.dataset.bound !== '1') {
        conversationInfoAvatarEl.addEventListener('click', () => {
            const conversation = getConversationById(currentConversationInfoId || '');
            if (!conversation) return;
            const ownerEmail = getConversationOwnerEmail(conversation);
            const adminSet = getConversationAdminSet(conversation);
            const meEmail = normalizeEmail(currentUserEmail || '');
            if (!(meEmail === ownerEmail || adminSet.has(meEmail))) return;
            conversationAvatarInput?.click();
        });
        conversationInfoAvatarEl.dataset.bound = '1';
    }

    if (conversationAvatarInput && conversationAvatarInput.dataset.bound !== '1') {
        conversationAvatarInput.addEventListener('change', async (event) => {
            const file = event.target?.files?.[0];
            if (!file) return;
            const conversation = getConversationById(currentConversationInfoId || '');
            if (!conversation) return;
            const ownerEmail = getConversationOwnerEmail(conversation);
            const adminSet = getConversationAdminSet(conversation);
            const meEmail = normalizeEmail(currentUserEmail || '');
            if (!(meEmail === ownerEmail || adminSet.has(meEmail))) return;

            try {
                const nextAvatar = await fileToDataUrl(file);
                updateConversationInStore(conversation.id, (target) => {
                    target.avatar = nextAvatar;
                });
                renderConversationInfoScreen();
                scheduleChatAreaUpdate({ skipRemoteRefresh: true });
            } catch (_error) {
                alert('Не удалось обновить аватар беседы.');
            } finally {
                conversationAvatarInput.value = '';
            }
        });
        conversationAvatarInput.dataset.bound = '1';
    }

    if (conversationInfoEditBtn && conversationInfoEditBtn.dataset.bound !== '1') {
        conversationInfoEditBtn.addEventListener('click', () => {
            openConversationEditScreen();
        });
        conversationInfoEditBtn.dataset.bound = '1';
    }

    if (conversationInfoInviteBtn && conversationInfoInviteBtn.dataset.bound !== '1') {
        conversationInfoInviteBtn.addEventListener('click', () => {
            renderConversationInviteScreen();
            goToScreen('screen-conversation-invite');
        });
        conversationInfoInviteBtn.dataset.bound = '1';
    }

    if (conversationInfoAdminsBtn && conversationInfoAdminsBtn.dataset.bound !== '1') {
        conversationInfoAdminsBtn.addEventListener('click', () => {
            renderConversationAdminsScreen();
            goToScreen('screen-conversation-admins');
        });
        conversationInfoAdminsBtn.dataset.bound = '1';
    }

    if (conversationEditBackBtn && conversationEditBackBtn.dataset.bound !== '1') {
        conversationEditBackBtn.addEventListener('click', () => {
            renderConversationInfoScreen();
            goToScreen('screen-conversation-info');
        });
        conversationEditBackBtn.dataset.bound = '1';
    }

    if (conversationEditSaveBtn && conversationEditSaveBtn.dataset.bound !== '1') {
        conversationEditSaveBtn.addEventListener('click', () => {
            const conversation = getConversationById(currentConversationInfoId || '');
            if (!conversation) return;
            const trimmed = String(conversationEditTitleInput?.value || '').trim().slice(0, 40);
            updateConversationInStore(conversation.id, (target) => {
                target.title = trimmed;
                target.avatar = String(conversationEditAvatarDataUrl || '').trim();
            });
            renderConversationInfoScreen();
            goToScreen('screen-conversation-info');
            scheduleChatAreaUpdate({ skipRemoteRefresh: true });
        });
        conversationEditSaveBtn.dataset.bound = '1';
    }

    if (conversationEditAvatarBtn && conversationEditAvatarBtn.dataset.bound !== '1') {
        conversationEditAvatarBtn.addEventListener('click', () => {
            conversationEditAvatarInput?.click();
        });
        conversationEditAvatarBtn.dataset.bound = '1';
    }

    if (conversationEditAvatarInput && conversationEditAvatarInput.dataset.bound !== '1') {
        conversationEditAvatarInput.addEventListener('change', async (event) => {
            const file = event.target?.files?.[0];
            if (!file) return;
            try {
                conversationEditAvatarDataUrl = await fileToDataUrl(file);
                setConversationAvatarPreview(conversationEditAvatarPreview, conversationEditAvatarDataUrl);
            } catch (_error) {
                alert('Не удалось загрузить фото беседы.');
            } finally {
                conversationEditAvatarInput.value = '';
            }
        });
        conversationEditAvatarInput.dataset.bound = '1';
    }

    if (conversationInviteBackBtn && conversationInviteBackBtn.dataset.bound !== '1') {
        conversationInviteBackBtn.addEventListener('click', () => {
            renderConversationInfoScreen();
            goToScreen('screen-conversation-info');
        });
        conversationInviteBackBtn.dataset.bound = '1';
    }

    if (conversationInviteSubmitBtn && conversationInviteSubmitBtn.dataset.bound !== '1') {
        conversationInviteSubmitBtn.addEventListener('click', () => {
            const conversation = getConversationById(currentConversationInfoId || '');
            if (!conversation || !conversationInviteSelectedEmails.size) return;
            const selectedEmails = Array.from(conversationInviteSelectedEmails);
            updateConversationInStore(conversation.id, (target) => {
                const participants = new Set((target.participants || []).map((email) => normalizeEmail(email)).filter(Boolean));
                selectedEmails.forEach((email) => participants.add(normalizeEmail(email)));
                target.participants = Array.from(participants);
            });
            conversationInviteSelectedEmails = new Set();
            renderConversationInfoScreen();
            goToScreen('screen-conversation-info');
            scheduleChatAreaUpdate({ skipRemoteRefresh: true });
        });
        conversationInviteSubmitBtn.dataset.bound = '1';
    }

    if (conversationAdminsBackBtn && conversationAdminsBackBtn.dataset.bound !== '1') {
        conversationAdminsBackBtn.addEventListener('click', () => {
            renderConversationInfoScreen();
            goToScreen('screen-conversation-info');
        });
        conversationAdminsBackBtn.dataset.bound = '1';
    }

    if (conversationAdminsSaveBtn && conversationAdminsSaveBtn.dataset.bound !== '1') {
        conversationAdminsSaveBtn.addEventListener('click', () => {
            const conversation = getConversationById(currentConversationInfoId || '');
            if (!conversation) return;
            updateConversationInStore(conversation.id, (target) => {
                const owner = getConversationOwnerEmail(target);
                const nextSet = new Set(Array.from(conversationAdminDraftSet));
                if (owner) nextSet.add(owner);
                target.admins = Array.from(nextSet);
            });
            renderConversationInfoScreen();
            goToScreen('screen-conversation-info');
            scheduleChatAreaUpdate({ skipRemoteRefresh: true });
        });
        conversationAdminsSaveBtn.dataset.bound = '1';
    }

    if (conversationInfoLeaveBtn && conversationInfoLeaveBtn.dataset.bound !== '1') {
        conversationInfoLeaveBtn.addEventListener('click', handleLeaveConversationFromInfo);
        conversationInfoLeaveBtn.dataset.bound = '1';
    }

    if (conversationInfoMoreBtn && conversationInfoMoreBtn.dataset.bound !== '1') {
        conversationInfoMoreBtn.addEventListener('click', (event) => {
            event.preventDefault();
            event.stopPropagation();
            if (!conversationInfoMoreMenu) return;
            conversationInfoMoreMenu.classList.toggle('active');
        });
        conversationInfoMoreBtn.dataset.bound = '1';
    }

    if (conversationInfoMoreMenu && conversationInfoMoreMenu.dataset.bound !== '1') {
        document.addEventListener('click', (event) => {
            if (!conversationInfoMoreMenu.classList.contains('active')) return;
            if (event.target.closest('#conversation-info-more-btn')) return;
            if (event.target.closest('#conversation-info-more-menu')) return;
            conversationInfoMoreMenu.classList.remove('active');
        });
        conversationInfoMoreMenu.dataset.bound = '1';
    }

    if (conversationMenuLeaveBtn && conversationMenuLeaveBtn.dataset.bound !== '1') {
        conversationMenuLeaveBtn.addEventListener('click', () => {
            conversationInfoMoreMenu?.classList.remove('active');
            handleLeaveConversationFromInfo();
        });
        conversationMenuLeaveBtn.dataset.bound = '1';
    }

    if (conversationMenuDeleteBtn && conversationMenuDeleteBtn.dataset.bound !== '1') {
        conversationMenuDeleteBtn.addEventListener('click', () => {
            conversationInfoMoreMenu?.classList.remove('active');
            handleDeleteConversationFromInfo();
        });
        conversationMenuDeleteBtn.dataset.bound = '1';
    }

    if (conversationInfoDeleteBtn && conversationInfoDeleteBtn.dataset.bound !== '1') {
        conversationInfoDeleteBtn.addEventListener('click', handleDeleteConversationFromInfo);
        conversationInfoDeleteBtn.dataset.bound = '1';
    }

    if (chatForm && messageInput) {
        if (messageInput.dataset.composerBound !== '1') {
            messageInput.addEventListener('input', updateComposerActionButton);
            messageInput.dataset.composerBound = '1';
        }

        if (chatActionBtn && chatActionBtn.dataset.bound !== '1') {
            chatActionBtn.addEventListener('click', (event) => {
                const mode = chatActionBtn.dataset.mode || 'file';
                event.preventDefault();
                if (mode === 'send') {
                    chatForm?.requestSubmit();
                    return;
                }
                fileInput?.click();
            });
            chatActionBtn.dataset.bound = '1';
        }

        if (fileUploadBtn && fileUploadBtn.dataset.bound !== '1') {
            fileUploadBtn.addEventListener('click', (event) => {
                event.preventDefault();
                fileInput?.click();
            });
            fileUploadBtn.dataset.bound = '1';
        }

        if (fileInput && fileInput.dataset.bound !== '1') {
            fileInput.addEventListener('change', handleFileSelection);
            fileInput.dataset.bound = '1';
        }

        chatForm.addEventListener('submit', async function(e) {
            e.preventDefault();
            if (!activeConversationId) return;

            const textToSend = messageInput.value;
            const fileToSend = pendingAttachmentDraft ? { ...pendingAttachmentDraft } : null;

            if (!textToSend.trim() && !fileToSend) {
                fileInput?.click();
                return;
            }

            messageInput.value = '';
            pendingAttachmentDraft = null;
            renderPendingAttachmentDraft();
            updateComposerActionButton();

            enqueueOutgoingMessage(textToSend, fileToSend, activeConversationId);
        });

        renderPendingAttachmentDraft();
        updateComposerActionButton();
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
    const openChatAction = document.getElementById('user-profile-open-chat-action');
    const contactAction = document.getElementById('user-profile-add-contact-action');
    const blockAction = document.getElementById('user-profile-block-action');
    if (!menuBtn || !dropdown || !openChatAction || !contactAction || !blockAction) return;
    if (menuBtn.dataset.hasListener === '1') return;

    menuBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        dropdown.classList.toggle('show');
    });

    openChatAction.addEventListener('click', (e) => {
        e.stopPropagation();
        if (!currentViewedUserProfileEmail) return;
        const conversation = getOrCreateConversationWithUser(currentViewedUserProfileEmail);
        activeConversationId = conversation.id;
        dropdown.classList.remove('show');
        goToScreen('screen-main');
        scheduleChatAreaUpdate({ skipRemoteRefresh: true });
    });

    contactAction.addEventListener('click', (e) => {
        e.stopPropagation();
        if (!currentViewedUserProfileEmail) return;
        const changed = isUserInContacts(currentViewedUserProfileEmail)
            ? removeUserFromContacts(currentViewedUserProfileEmail)
            : addUserToContacts(currentViewedUserProfileEmail);
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

function closeGoldBadgeActionMenu() {
    if (goldBadgeActionMenuEl) {
        goldBadgeActionMenuEl.remove();
        goldBadgeActionMenuEl = null;
    }
}

function openGoldBadgeActionMenu(anchor) {
    if (!anchor) return;
    closeGoldBadgeActionMenu();

    const menu = document.createElement('div');
    menu.className = 'profile-dropdown-menu gold-badge-action-menu';
    menu.innerHTML = `
        <div class="profile-dropdown-item" data-action="style-aurora">Стиль: Aurora</div>
        <div class="profile-dropdown-item" data-action="style-crown">Стиль: Crown</div>
        <div class="profile-dropdown-item" data-action="style-diamond">Стиль: Diamond</div>
        <div class="profile-dropdown-item logout-item" data-action="hide">Убрать значок</div>
    `;

    menu.style.position = 'fixed';
    menu.style.zIndex = '12000';
    menu.style.left = '12px';
    menu.style.top = '12px';
    menu.style.right = 'auto';
    menu.style.transform = 'none';
    document.body.appendChild(menu);
    const rect = anchor.getBoundingClientRect();
    menu.style.top = (rect.bottom + 6) + 'px';
    menu.style.left = Math.max(12, Math.min(window.innerWidth - menu.offsetWidth - 12, rect.left + rect.width / 2 - menu.offsetWidth / 2)) + 'px';
    requestAnimationFrame(() => menu.classList.add('show'));

    menu.addEventListener('click', (event) => {
        const action = event.target?.closest('[data-action]')?.getAttribute('data-action');
        if (!action) return;

        if (action === 'hide') {
            setGoldBadgeVisible(false);
            if (editGoldBadgeVisibleInput) editGoldBadgeVisibleInput.checked = false;
        } else if (action === 'style-aurora') {
            setGoldBadgeStyle('aurora');
            setGoldBadgeVisible(true);
        } else if (action === 'style-crown') {
            setGoldBadgeStyle('crown');
            setGoldBadgeVisible(true);
        } else if (action === 'style-diamond') {
            setGoldBadgeStyle('diamond');
            setGoldBadgeVisible(true);
        }

        createUsernameDisplay();
        void syncCurrentUserProfileToSupabase();
        closeGoldBadgeActionMenu();
    });

    setTimeout(() => {
        const onOutside = (event) => {
            if (!menu.contains(event.target) && !anchor.contains(event.target)) {
                closeGoldBadgeActionMenu();
                document.removeEventListener('click', onOutside, true);
            }
        };
        document.addEventListener('click', onOutside, true);
    }, 0);

    goldBadgeActionMenuEl = menu;
}

document.addEventListener('DOMContentLoaded', initUserProfileHeaderMenu);
document.addEventListener('DOMContentLoaded', renderWalletData);
document.addEventListener('DOMContentLoaded', initWalletCurrencySwitch);
document.addEventListener('DOMContentLoaded', initWalletActionButtons);

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
    const savedDisplayName = localStorage.getItem('userDisplayName_' + currentUserEmail) || 'Пользователь';
    const nameText = document.createElement('span');
    nameText.className = 'nickname-gradient-target';
    nameText.textContent = savedDisplayName;
    applyGradientToNameElement(nameText, currentUserEmail);
    usernameDisplay.appendChild(nameText);

    if (isGoldBadgeVisible()) {
        const badge = document.createElement('button');
        badge.type = 'button';
        badge.className = 'profile-gold-badge';
        badge.dataset.style = getGoldBadgeStyle();
        badge.title = 'Margelet Boost';
        badge.setAttribute('aria-label', 'Margelet Boost');
        badge.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M6 10h12"></path><path d="m8 10 4-5 4 5"></path><path d="m9 10 3 9 3-9"></path></svg>';
        badge.addEventListener('click', (event) => {
            event.stopPropagation();
            openGoldBadgeActionMenu(badge);
        });
        usernameDisplay.appendChild(badge);
    }
    
    // Вставляем после аватарки
    const avatarWrapper = profileScreen.querySelector('.avatar-wrapper-glass');
    if (avatarWrapper) {
        avatarWrapper.insertAdjacentElement('afterend', usernameDisplay);
    }
}

// Функция для создания секции подробностей об аккаунте
function createAccountDetailsSection() {
        const lang = getCurrentLanguage();
        const t = {
            detailsTitle: lang === 'en' ? 'Account details' : 'Подробности об аккаунте',
            notSpecified: lang === 'en' ? 'Not specified' : 'Не указано',
            phoneNotSpecified: lang === 'en' ? 'Not specified' : 'Не указан',
            description: lang === 'en' ? 'Description' : 'Описание',
            phone: lang === 'en' ? 'Phone' : 'Телефон',
            stories: lang === 'en' ? 'Stories' : 'Истории',
            collection: lang === 'en' ? 'Collection' : 'Коллекция',
            collectionEmpty: lang === 'en' ? 'Collection is empty' : 'Коллекция пуста',
            storiesEmpty: lang === 'en' ? 'No stories yet' : 'Нет историй'
        };

    const profileScreen = document.getElementById('screen-profile');
    if (!profileScreen) return;

    const profileContent = profileScreen.querySelector('.profile-content-glass');
    if (!profileContent) return;
    
    // Скрываем старую сетку информации
    const oldInfoGrid = profileContent.querySelector('.info-grid-glass');
    if (oldInfoGrid) {
        oldInfoGrid.style.display = 'none';
    }
    
    // Сохраняем блок историй до удаления секции деталей,
    // иначе при повторной сборке можем потерять id списка.
    const existingStoriesSection = profileContent.querySelector('.profile-stories-section');

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
    title.textContent = t.detailsTitle;
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
    const displayUsername = savedUsername ? '@' + savedUsername : t.notSpecified;
    const storedPhoneRaw = localStorage.getItem('userPhone_' + currentUserEmail) || '';
    const savedPhone = formatStoredPhoneForDisplay(storedPhoneRaw, true) || t.phoneNotSpecified;
    const savedStatus = (localStorage.getItem('userStatus_' + currentUserEmail) || '').trim();

    // Элемент Описание показываем первым и только если пользователь его заполнил
    if (savedStatus) {
        const statusItem = createDetailItem('username', t.description, savedStatus, 'status');
        detailsSection.appendChild(statusItem);
    }
    
    // Элемент Username (логин) с @
    const usernameItem = createDetailItem('username', 'Username', displayUsername, 'username');
    detailsSection.appendChild(usernameItem);
    
    // Элемент Email
    const emailItem = createDetailItem('email', 'Email', currentUserEmail, 'email');
    detailsSection.appendChild(emailItem);
    
    // Элемент Телефон
    const phoneItem = createDetailItem('phone', t.phone, savedPhone, 'phone');
    detailsSection.appendChild(phoneItem);

    const mediaSwitcher = document.createElement('div');
    mediaSwitcher.className = 'profile-media-switcher';
    mediaSwitcher.innerHTML = `
        <div class="chat-submenu-inner profile-media-tabs-inner">
            <button class="submenu-btn" data-tab="stories" type="button">${t.stories}</button>
            <button class="submenu-btn" data-tab="collection" type="button">${t.collection}</button>
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
            <div class="collection-title">${t.collection}</div>
            <div class="collection-list" id="profile-collection-list">
                <div class="collection-empty">${t.collectionEmpty}</div>
            </div>
        </div>
    `;

    mediaPanels.appendChild(storiesPanel);
    mediaPanels.appendChild(collectionPanel);

    detailsSection.appendChild(mediaSwitcher);
    detailsSection.appendChild(mediaPanels);

    // Вставляем секцию историй в панель "Истории"
    if (existingStoriesSection) {
        storiesPanel.appendChild(existingStoriesSection);
    } else {
        storiesPanel.innerHTML = `
            <div class="profile-stories-section" id="profile-stories-wrapper">
                <div class="stories-title">${t.stories}</div>
                <div class="stories-list" id="profile-stories-list">
                    <div class="stories-empty">${t.storiesEmpty}</div>
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
    renderStoriesListForUser(currentUserEmail, 'profile-stories-list');
    renderCollectionListForUser(currentUserEmail, 'profile-collection-list', true);
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
        
        if (value !== 'Не указано' && value !== 'Не указана' && value !== 'Не указан' && value !== 'Not specified') {
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
        const settingsScreens = new Set([
            'screen-settings',
            'screen-notifications',
            'screen-privacy',
            'screen-devices',
            'screen-languages',
            'screen-gold',
            'screen-wallet',
            'screen-wallet-send',
            'screen-wallet-history',
            'screen-wallet-contact-picker',
            'screen-services',
            'screen-market'
        ]);
        const effectiveScreenId = screenId === 'screen-user-profile' || screenId === 'screen-community-profile'
            ? 'screen-main'
            : (settingsScreens.has(screenId) ? 'screen-settings' : screenId);

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
            if (searchModeActive && typeof window.closeSearchMode === 'function') {
                window.closeSearchMode();
            }
            syncMainSubmenuVisualState();
            requestAnimationFrame(refreshMainSubmenuIndicator);
            setTimeout(refreshMainSubmenuIndicator, 120);
            setTimeout(syncMainSubmenuVisualState, 280);
        }
    });
}

const backFromCommunityProfileBtn = document.getElementById('back-from-community-profile');
if (backFromCommunityProfileBtn) {
    backFromCommunityProfileBtn.addEventListener('click', () => {
        goToScreen('screen-main');
        syncMainSubmenuVisualState();
        requestAnimationFrame(refreshMainSubmenuIndicator);
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
        <div class="profile-dropdown-item" id="connect-business-from-menu" style="display:none;">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <rect x="2" y="7" width="20" height="14" rx="2" ry="2"/>
                <path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16"/>
            </svg>
            <span>Подключить Margelet Business</span>
        </div>
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

    const connectBusinessItem = dropdownMenu.querySelector('#connect-business-from-menu');
    if (connectBusinessItem) {
        connectBusinessItem.addEventListener('click', (e) => {
            e.stopPropagation();
            alert('Margelet Business уже доступен для этого аккаунта.');
            dropdownMenu.classList.remove('show');
        });
    }
    
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

    updateBusinessMenuVisibility();
}

// ===== РЕДАКТИРОВАНИЕ ПРОФИЛЯ =====

// Fallback: attach listeners to static profile menu elements if they exist
function attachStaticProfileMenuListeners() {
    const menuBtn = document.getElementById('profile-menu-btn');
    const dropdown = document.getElementById('profile-dropdown-menu');
    const connectBusinessItem = document.getElementById('connect-business-from-menu');
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

    if (connectBusinessItem && !connectBusinessItem.dataset.hasListener) {
        connectBusinessItem.addEventListener('click', (e) => {
            e.stopPropagation();
            alert('Margelet Business уже доступен для этого аккаунта.');
            if (dropdown) dropdown.classList.remove('show');
        });
        connectBusinessItem.dataset.hasListener = '1';
    }

    updateBusinessMenuVisibility();
}

document.addEventListener('DOMContentLoaded', attachStaticProfileMenuListeners);
// Also try immediately in case DOM is already loaded
attachStaticProfileMenuListeners();

// Выбор цвета свечения
const glowColorOptions = document.querySelectorAll('.glow-color-option');
const avatarGlow = document.getElementById('avatar-glow');
const glowExpandBtn = document.getElementById('glow-expand-btn');
const glowAnimExpandBtn = document.getElementById('glow-anim-expand-btn');
const glowAnimationOptionsEdit = document.getElementById('glow-animation-options-edit');
const editProfileScreen = document.getElementById('screen-edit-profile');

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
    
    const fogColorMap = {
        gradient: ['255, 94, 152', '139, 65, 223', '48, 161, 255'],
        pink: ['255, 94, 152', '255, 94, 152', '255, 94, 152'],
        purple: ['139, 65, 223', '139, 65, 223', '139, 65, 223'],
        blue: ['48, 161, 255', '48, 161, 255', '48, 161, 255'],
        green: ['0, 230, 118', '0, 230, 118', '0, 230, 118'],
        orange: ['255, 152, 0', '255, 152, 0', '255, 152, 0'],
        red: ['244, 67, 54', '244, 67, 54', '244, 67, 54'],
        cyan: ['0, 188, 212', '0, 188, 212', '0, 188, 212']
    };
    const fogPalette = fogColorMap[color] || fogColorMap.gradient;
    avatarGlow.style.setProperty('--fog-c1', fogPalette[0]);
    avatarGlow.style.setProperty('--fog-c2', fogPalette[1]);
    avatarGlow.style.setProperty('--fog-c3', fogPalette[2]);

    if (color === 'gradient') {
        avatarGlow.style.background = 'conic-gradient(from 0deg at 50% 50%, #ff5e98 0deg, #8b41df 120deg, #30a1ff 240deg, #ff5e98 360deg)';
    } else {
        avatarGlow.style.background = color;
    }
}

// Animation selection
const glowAnimMap = {
    'pulse': 'glowSyncPulse 4.4s cubic-bezier(0.3, 0.05, 0.2, 1) infinite',
    'spin': 'glowSyncSpin 3.8s linear infinite',
    'breathe': 'glowSyncBreathe 4.8s ease-in-out infinite',
    'wave': 'glowSyncWave 4.6s ease-in-out infinite',
    'flicker': 'glowSyncRift 3.0s cubic-bezier(0.25, 0.1, 0.2, 1) infinite',
    'nebula': 'glowSyncNebula 5.2s cubic-bezier(0.28, 0.04, 0.2, 1) infinite',
    'singularity': 'glowSyncSingularity 4.2s cubic-bezier(0.4, 0, 0.2, 1) infinite',
    'quasar': 'glowSyncQuasar 3.4s cubic-bezier(0.3, 0.08, 0.2, 1) infinite',
    'wormhole': 'glowSyncWormhole 4.8s cubic-bezier(0.42, 0, 0.2, 1) infinite',
    'supernova': 'glowSyncSupernova 3.8s cubic-bezier(0.22, 0.04, 0.2, 1) infinite',
    'none': 'none'
};

function loadGlowAnimation() {
    if (!currentUserEmail || !avatarGlow) return;
    const saved = normalizeGlowAnimation(localStorage.getItem('glowAnimation_' + currentUserEmail));
    setGlowAnimation(saved);
}

function setGlowAnimation(animType) {
    if (!avatarGlow) return;
    const normalizedAnim = normalizeGlowAnimation(animType);
    document.querySelectorAll('.glow-anim-option').forEach(o => o.classList.remove('selected'));
    const sel = document.querySelector(`.glow-anim-option[data-animation="${normalizedAnim}"]`);
    if (sel) sel.classList.add('selected');

    const animValue = glowAnimMap[normalizedAnim] || glowAnimMap['pulse'];
    avatarGlow.style.animation = animValue;
    avatarGlow.setAttribute('data-anim', normalizedAnim);
}

document.querySelectorAll('.glow-anim-option').forEach(option => {
    option.addEventListener('click', function() {
        const anim = normalizeGlowAnimation(this.getAttribute('data-animation'));
        setGlowAnimation(anim);
        if (currentUserEmail) {
            localStorage.setItem('glowAnimation_' + currentUserEmail, anim);

            const users = JSON.parse(localStorage.getItem('socialNetworkUsers')) || [];
            const userIndex = users.findIndex(user => normalizeEmail(user.email) === normalizeEmail(currentUserEmail));
            if (userIndex !== -1) {
                users[userIndex] = {
                    ...users[userIndex],
                    glowAnimation: anim
                };
                localStorage.setItem('socialNetworkUsers', JSON.stringify(users));
                invalidateUsersDirectoryCache();
            }
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

if (glowExpandBtn && editProfileScreen) {
    glowExpandBtn.addEventListener('click', () => {
        const expanded = editProfileScreen.classList.toggle('glow-colors-expanded');
        glowExpandBtn.textContent = expanded ? 'Свернуть' : 'Раскрыть';
    });

    glowExpandBtn.addEventListener('keydown', (event) => {
        if (event.key !== 'Enter' && event.key !== ' ') return;
        event.preventDefault();
        const expanded = editProfileScreen.classList.toggle('glow-colors-expanded');
        glowExpandBtn.textContent = expanded ? 'Свернуть' : 'Раскрыть';
    });
}

if (glowAnimExpandBtn && editProfileScreen) {
    glowAnimExpandBtn.addEventListener('click', () => {
        const expanded = editProfileScreen.classList.toggle('glow-animations-expanded');
        glowAnimExpandBtn.textContent = expanded ? 'Свернуть' : 'Раскрыть';
        if (glowAnimationOptionsEdit && expanded) {
            const centered = Math.max(0, (glowAnimationOptionsEdit.scrollWidth - glowAnimationOptionsEdit.clientWidth) / 2);
            glowAnimationOptionsEdit.scrollLeft = centered;
        }
    });

    glowAnimExpandBtn.addEventListener('keydown', (event) => {
        if (event.key !== 'Enter' && event.key !== ' ') return;
        event.preventDefault();
        const expanded = editProfileScreen.classList.toggle('glow-animations-expanded');
        glowAnimExpandBtn.textContent = expanded ? 'Свернуть' : 'Раскрыть';
        if (glowAnimationOptionsEdit && expanded) {
            const centered = Math.max(0, (glowAnimationOptionsEdit.scrollWidth - glowAnimationOptionsEdit.clientWidth) / 2);
            glowAnimationOptionsEdit.scrollLeft = centered;
        }
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
    editCountryPicker.addEventListener('click', (event) => {
        event.preventDefault();
        enforceEditCountryCode();
    });
}

if (editAvatarAnimationSelect) {
    editAvatarAnimationSelect.addEventListener('change', () => {
        if (!hasMargeletBoost(currentUserEmail)) {
            if (editAvatarAnimationEnabledInput) editAvatarAnimationEnabledInput.checked = false;
            applyAvatarAnimationEnabled(false);
            alert('Анимация за аватаром доступна только с подпиской Margelet Boost.');
            return;
        }
        applyAvatarParticleAnimationType(editAvatarAnimationSelect.value);

        // If animation was disabled earlier, enable it immediately for live preview.
        if (document.documentElement.classList.contains('avatar-animation-off')) {
            applyAvatarAnimationEnabled(true);
            if (editAvatarAnimationEnabledInput) {
                editAvatarAnimationEnabledInput.checked = true;
            }
            if (currentUserEmail) {
                localStorage.setItem('avatarAnimationEnabled_' + currentUserEmail, '1');
            }
        }
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

    const updateCodeVisibility = () => {
        const hasDigits = phoneInput.value.replace(/\D/g, '').length > 0;
        currentCodeElement.textContent = hasDigits ? '+7' : '';
    };

    phoneInput.addEventListener('input', updateCodeVisibility);
    updateCodeVisibility();
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

        const normalizedPhone = sanitizePhoneForStorage(phoneNumber);
        
        if (currentUserEmail) {
            localStorage.setItem('userPhone_' + currentUserEmail, normalizedPhone);

            const users = JSON.parse(localStorage.getItem('socialNetworkUsers')) || [];
            const userIndex = users.findIndex(user => user.email === currentUserEmail);
            if (userIndex !== -1) {
                users[userIndex] = {
                    ...users[userIndex],
                    phone: normalizedPhone
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

    touchCurrentDeviceSession(email);

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

function goToMarketScreen() {
    goToScreen('screen-market');
}

// Переход к настройкам
function goToSettingsScreen() {
    renderAccountsList();
    applyNicknameGradientEnabled(getNicknameGradientEnabled());
    applyNicknameGradientPalette(getNicknameGradientPalette());
    goToScreen('screen-settings');
}

function getCurrentDeviceId() {
    const key = 'margeletCurrentDeviceId';
    let value = localStorage.getItem(key);
    if (!value) {
        value = 'dev_' + Math.random().toString(36).slice(2, 10) + '_' + Date.now().toString(36);
        localStorage.setItem(key, value);
    }
    return value;
}

function getDeviceSessions() {
    try {
        const parsed = JSON.parse(localStorage.getItem('margeletDeviceSessions') || '[]');
        return Array.isArray(parsed) ? parsed : [];
    } catch (_e) {
        return [];
    }
}

function saveDeviceSessions(sessions) {
    localStorage.setItem('margeletDeviceSessions', JSON.stringify(sessions || []));
}

function detectOsNameFromUserAgent(ua = '', platform = '') {
    const uaValue = String(ua || '').toLowerCase();
    const platformValue = String(platform || '').toLowerCase();

    if (/windows nt 11\.0|windows nt 10\.0/i.test(ua)) return 'Windows';
    if (/windows/i.test(platformValue)) return 'Windows';
    if (/android/i.test(ua)) return 'Android';
    if (/iphone|ipad|ipod/i.test(ua) && !/windows|macintosh|linux|cros/i.test(ua)) return 'iOS';
    if (/mac os x|macintosh/i.test(ua)) return 'macOS';
    if (/mac/i.test(platformValue)) return 'macOS';
    if (/linux/i.test(ua) || /linux/i.test(platformValue)) return 'Linux';
    if (/cros/i.test(ua)) return 'ChromeOS';
    return String(platform || '').trim() || 'Unknown OS';
}

function detectBrowserNameFromUserAgent(ua = '') {
    const uaValue = String(ua || '');
    const uaLower = uaValue.toLowerCase();

    if (/edg\//i.test(uaValue)) return 'Edge';
    if (/opr\//i.test(uaValue) || /opera/i.test(uaValue)) return 'Opera';
    if (/firefox\//i.test(uaValue)) return 'Firefox';
    if (/crios\//i.test(uaValue)) return 'Chrome';
    if (/chrome\//i.test(uaValue) && !/edg\//i.test(uaValue) && !/opr\//i.test(uaValue)) return 'Chrome';
    if (/safari\//i.test(uaValue) && !/chrome\//i.test(uaValue) && !/crios\//i.test(uaValue)) return 'Safari';
    if (uaLower.includes('chromium')) return 'Chrome';
    return 'Browser';
}

function detectDeviceProfile() {
    const ua = navigator.userAgent || '';
    const platform = navigator.platform || '';

    let browser = detectBrowserNameFromUserAgent(ua);
    let os = detectOsNameFromUserAgent(ua, platform);

    const uaData = navigator.userAgentData;
    if (uaData) {
        const brands = Array.isArray(uaData.brands) ? uaData.brands.map(b => String(b?.brand || '').toLowerCase()) : [];
        const uaPlatform = String(uaData.platform || '').trim();

        if (brands.some(b => b.includes('google chrome'))) browser = 'Chrome';
        else if (brands.some(b => b.includes('microsoft edge'))) browser = 'Edge';
        else if (brands.some(b => b.includes('opera'))) browser = 'Opera';
        else if (brands.some(b => b.includes('chromium'))) browser = 'Chrome';

        if (uaPlatform) {
            if (/windows/i.test(uaPlatform)) os = 'Windows';
            else if (/mac/i.test(uaPlatform)) os = 'macOS';
            else if (/android/i.test(uaPlatform)) os = 'Android';
            else if (/ios/i.test(uaPlatform)) os = 'iOS';
            else if (/linux/i.test(uaPlatform)) os = 'Linux';
            else if (/chrome os/i.test(uaPlatform)) os = 'ChromeOS';
        }
    }

    const mobile = /Android|iPhone|iPad|iPod|Mobile/i.test(ua) || Boolean(uaData?.mobile);
    return { os, browser, mobile };
}

function detectDeviceName() {
    const lang = getCurrentLanguage();
    const profile = detectDeviceProfile();
    const mobile = profile.mobile;
    const deviceType = mobile
        ? (lang === 'en' ? 'Phone' : 'Телефон')
        : (lang === 'en' ? 'Computer' : 'Компьютер');
    const osName = profile.os;
    const browserName = profile.browser;
    return `${deviceType} • ${osName} • ${browserName}`;
}

function touchCurrentDeviceSession(email) {
    const normalized = normalizeEmail(email);
    if (!normalized) return;

    const deviceId = getCurrentDeviceId();
    const sessions = getDeviceSessions();
    const idx = sessions.findIndex(s => normalizeEmail(s.email) === normalized && s.deviceId === deviceId);

    const next = {
        sessionId: idx >= 0 ? sessions[idx].sessionId : ('sess_' + Math.random().toString(36).slice(2, 10)),
        email: normalized,
        deviceId,
        deviceName: detectDeviceName(),
        lastActiveAt: Date.now()
    };

    if (idx >= 0) {
        sessions[idx] = { ...sessions[idx], ...next };
    } else {
        sessions.push(next);
    }

    saveDeviceSessions(sessions);
}

function renderDevicesList() {
    if (!devicesList) return;
    if (currentUserEmail) {
        touchCurrentDeviceSession(currentUserEmail);
    }
    const lang = getCurrentLanguage();
    const t = {
        noLogin: lang === 'en' ? 'Sign in first' : 'Сначала войдите в аккаунт',
        noDevices: lang === 'en' ? 'No active devices' : 'Активных устройств нет',
        thisDevice: lang === 'en' ? 'This device' : 'Это устройство',
        session: lang === 'en' ? 'Session' : 'Сессия',
        device: lang === 'en' ? 'Device' : 'Устройство',
        kick: lang === 'en' ? 'Kick' : 'Выгнать'
    };

    const currentEmail = normalizeEmail(currentUserEmail || '');
    if (!currentEmail) {
        devicesList.innerHTML = `<div class="devices-empty">${t.noLogin}</div>`;
        return;
    }

    const currentDeviceId = getCurrentDeviceId();
    const sessions = getDeviceSessions()
        .filter(s => normalizeEmail(s.email) === currentEmail)
        .sort((a, b) => Number(b.lastActiveAt || 0) - Number(a.lastActiveAt || 0));

    if (!sessions.length) {
        devicesList.innerHTML = `<div class="devices-empty">${t.noDevices}</div>`;
        return;
    }

    devicesList.innerHTML = '';
    sessions.forEach((session) => {
        const isCurrent = session.deviceId === currentDeviceId;
        const row = document.createElement('div');
        row.className = 'device-item';
        const dateText = new Date(Number(session.lastActiveAt || Date.now())).toLocaleString(lang === 'en' ? 'en-US' : 'ru-RU');
        const rawDeviceName = String(session.deviceName || '').trim();
        let deviceName = rawDeviceName || t.device;
        if (/^Телефон\s*\(/i.test(rawDeviceName)) {
            deviceName = rawDeviceName.replace(/^Телефон/i, lang === 'en' ? 'Phone' : 'Телефон');
        } else if (/^Компьютер\s*\(/i.test(rawDeviceName)) {
            deviceName = rawDeviceName.replace(/^Компьютер/i, lang === 'en' ? 'Computer' : 'Компьютер');
        } else if (/^Phone\s*\(/i.test(rawDeviceName)) {
            deviceName = rawDeviceName.replace(/^Phone/i, lang === 'en' ? 'Phone' : 'Телефон');
        } else if (/^Computer\s*\(/i.test(rawDeviceName)) {
            deviceName = rawDeviceName.replace(/^Computer/i, lang === 'en' ? 'Computer' : 'Компьютер');
        }

        const actionButton = isCurrent
            ? '<span class="device-current-badge">Online</span>'
            : `<button type="button" class="device-kick-btn" data-session-id="${escapeHtml(session.sessionId || '')}">${t.kick}</button>`;

        row.innerHTML = `
            <div class="device-item-main">
                <div class="device-item-title">${escapeHtml(deviceName)}</div>
                <div class="device-item-meta">${isCurrent ? t.thisDevice : t.session} • ${escapeHtml(dateText)}</div>
            </div>
            ${actionButton}
        `;

        const kickBtn = row.querySelector('.device-kick-btn');
        if (kickBtn) {
            kickBtn.addEventListener('click', () => {
                const sid = kickBtn.getAttribute('data-session-id');
                const updated = getDeviceSessions().filter(s => s.sessionId !== sid);
                saveDeviceSessions(updated);

                renderDevicesList();
            });
        }

        devicesList.appendChild(row);
    });
}

function goToDevicesScreen() {
    renderDevicesList();
    goToScreen('screen-devices');
}

function goToLanguagesScreen() {
    goToScreen('screen-languages');
}

function goToWalletScreen() {
    const walletSettings = getWalletUiSettings();
    walletBalanceMasked = Boolean(walletSettings.hideBalanceOnOpen);
    renderWalletData();
    populateWalletSendContacts();
    walletContactSelectionMode = false;
    syncWalletFromOnline(currentUserEmail).then((onlineWallet) => {
        if (onlineWallet) renderWalletData();
    });
    goToScreen('screen-wallet');
}

function getWalletUiSettingsKey() {
    return 'margeletWalletUiSettings_' + normalizeEmail(currentUserEmail || 'guest');
}

function getWalletUiSettings() {
    const fallback = {
        hideBalanceOnOpen: false
    };
    try {
        const raw = JSON.parse(localStorage.getItem(getWalletUiSettingsKey()) || '{}');
        return {
            hideBalanceOnOpen: Boolean(raw.hideBalanceOnOpen)
        };
    } catch (_error) {
        return fallback;
    }
}

function saveWalletUiSettings(next) {
    const current = getWalletUiSettings();
    localStorage.setItem(getWalletUiSettingsKey(), JSON.stringify({ ...current, ...(next || {}) }));
}

function formatWalletAccountNumberInput(value = '') {
    const digits = String(value || '').replace(/\D+/g, '').slice(0, 9);
    if (!digits) return '';
    const p1 = digits.slice(0, 3);
    const p2 = digits.slice(3, 6);
    const p3 = digits.slice(6, 9);
    if (!p2) return p1;
    if (!p3) return `${p1}-${p2}`;
    return `${p1}-${p2}-${p3}`;
}

async function ensureWalletAccountOnline(email = currentUserEmail) {
    const client = getSupabaseClient();
    const normalizedEmail = normalizeEmail(email || '');
    if (!client || !normalizedEmail) return null;

    try {
        const { data, error } = await client.rpc('ensure_wallet_account', {
            p_owner_email: normalizedEmail
        });
        if (error) throw error;
        return data || null;
    } catch (error) {
        console.warn('Wallet online ensure failed:', error?.message || error);
        return null;
    }
}

async function syncWalletFromOnline(email = currentUserEmail) {
    const client = getSupabaseClient();
    const normalizedEmail = normalizeEmail(email || '');
    if (!client || !normalizedEmail) return null;

    const account = await ensureWalletAccountOnline(normalizedEmail);
    if (!account || !account.id) return null;

    try {
        const { data: transfers, error } = await client
            .from('wallet_transfers')
            .select('sender_account_id, recipient_account_id, amount, currency, kind, created_at, note')
            .or(`sender_account_id.eq.${account.id},recipient_account_id.eq.${account.id}`)
            .order('created_at', { ascending: false })
            .limit(100);

        if (error) throw error;

        const operations = (transfers || []).map((t) => {
            const outgoing = t.sender_account_id === account.id;
            const amount = outgoing ? -Math.abs(Number(t.amount || 0)) : Math.abs(Number(t.amount || 0));
            const currency = String(t.currency || 'RUB').toUpperCase() === 'USD' ? 'USD' : 'RUB';
            let title = outgoing ? 'Перевод по счету' : 'Входящий перевод';
            if (t.kind === 'exchange') title = 'Обмен валюты';
            return {
                title,
                amount,
                currency,
                createdAt: new Date(t.created_at || Date.now()).getTime()
            };
        });

        const nextLocal = {
            ...getWalletData(normalizedEmail),
            balanceRub: Number(account.balance_rub || 0),
            balanceUsd: Number(account.balance_usd || 0),
            accountNumber: String(account.account_number || ''),
            operations
        };
        saveWalletData(nextLocal, normalizedEmail);
        return nextLocal;
    } catch (error) {
        console.warn('Wallet online sync failed:', error?.message || error);
        return null;
    }
}

function getWalletAccountNumberByEmail(email) {
    const current = getWalletData(email);
    if (String(current.accountNumber || '').match(/^\d{3}-\d{3}-\d{3}$/)) {
        return current.accountNumber;
    }

    const users = getLocalUsersSafe();
    const usedNumbers = new Set();
    users.forEach((u) => {
        const wallet = getWalletData(normalizeEmail(u?.email || ''));
        if (String(wallet.accountNumber || '').match(/^\d{3}-\d{3}-\d{3}$/)) {
            usedNumbers.add(wallet.accountNumber);
        }
    });

    let accountNumber = '';
    for (let i = 0; i < 500; i += 1) {
        const digits = String(Math.floor(Math.random() * 1000000000)).padStart(9, '0');
        const candidate = `${digits.slice(0, 3)}-${digits.slice(3, 6)}-${digits.slice(6, 9)}`;
        if (!usedNumbers.has(candidate)) {
            accountNumber = candidate;
            break;
        }
    }
    if (!accountNumber) accountNumber = '000-000-000';

    saveWalletData({ ...current, accountNumber }, email);
    return accountNumber;
}

function getWalletStorageKey(email = currentUserEmail) {
    return 'margeletWalletData_' + normalizeEmail(email || 'guest');
}

function getWalletData(email = currentUserEmail) {
    const fallback = {
        balanceRub: 0,
        balanceUsd: 0,
        accountNumber: '',
        creditLimitRub: 0,
        operations: []
    };

    try {
        const raw = JSON.parse(localStorage.getItem(getWalletStorageKey(email)) || '{}');
        const balanceRub = Number(raw.balanceRub || 0);
        const balanceUsd = Number(raw.balanceUsd || 0);
        return {
            balanceRub,
            balanceUsd,
            accountNumber: String(raw.accountNumber || '').trim(),
            creditLimitRub: Number(raw.creditLimitRub || 0),
            operations: Array.isArray(raw.operations) ? raw.operations : []
        };
    } catch (_error) {
        return fallback;
    }
}

function saveWalletData(data, email = currentUserEmail) {
    try {
        localStorage.setItem(getWalletStorageKey(email), JSON.stringify(data || {}));
    } catch (_error) {
        // ignore
    }
}

function ensureWalletSeedData(email = currentUserEmail) {
    const current = getWalletData(email);
    const hasBalances = Number(current.balanceRub || 0) > 0 || Number(current.balanceUsd || 0) > 0;
    const hasOperations = Array.isArray(current.operations) && current.operations.length > 0;
    const hasCredit = Number(current.creditLimitRub || 0) > 0;

    const accountNumber = String(current.accountNumber || '').match(/^\d{3}-\d{3}-\d{3}$/)
        ? current.accountNumber
        : getWalletAccountNumberByEmail(email);

    if (hasBalances || hasOperations || hasCredit) {
        const normalized = { ...current, accountNumber };
        if (normalized.accountNumber !== current.accountNumber) {
            saveWalletData(normalized, email);
        }
        return normalized;
    }

    const seeded = {
        balanceRub: 0,
        balanceUsd: 0,
        accountNumber,
        creditLimitRub: 0,
        operations: []
    };
    saveWalletData(seeded, email);
    return seeded;
}

function getWalletUsdRate() {
    const balanceEl = document.getElementById('wallet-balance-amount');
    const rate = Number(balanceEl?.dataset?.usdRate || 92.4);
    return rate > 0 ? rate : 92.4;
}

function getPreferredTransferCurrency(data = ensureWalletSeedData()) {
    const rub = Math.max(0, Number(data.balanceRub || 0));
    const usd = Math.max(0, Number(data.balanceUsd || 0));
    const usdInRub = usd * getWalletUsdRate();
    return usdInRub > rub ? 'USD' : 'RUB';
}

function getOperationCurrency(op) {
    return String(op?.currency || 'RUB').toUpperCase() === 'USD' ? 'USD' : 'RUB';
}

function getOperationAmount(op) {
    if (Number.isFinite(Number(op?.amount))) return Number(op.amount);
    if (Number.isFinite(Number(op?.amountRub))) return Number(op.amountRub);
    return 0;
}

function operationToRub(op) {
    const amount = getOperationAmount(op);
    return getOperationCurrency(op) === 'USD' ? amount * getWalletUsdRate() : amount;
}

function formatAmountByCurrency(value, currency, withSign = false) {
    const numeric = Number(value || 0);
    const symbol = currency === 'USD' ? '$' : '₽';
    const locale = currency === 'USD' ? 'en-US' : 'ru-RU';
    const absFormatted = Math.abs(numeric).toLocaleString(locale, {
        minimumFractionDigits: currency === 'USD' ? 2 : 0,
        maximumFractionDigits: currency === 'USD' ? 2 : 0
    });
    if (withSign) {
        if (numeric > 0) return `+${absFormatted} ${symbol}`;
        if (numeric < 0) return `-${absFormatted} ${symbol}`;
    }
    return `${absFormatted} ${symbol}`;
}

function formatRubAmount(value, withSign = false) {
    const numberValue = Number(value || 0);
    const absFormatted = Math.abs(numberValue).toLocaleString('ru-RU', { maximumFractionDigits: 0 });
    if (withSign) {
        if (numberValue > 0) return `+${absFormatted} ₽`;
        if (numberValue < 0) return `-${absFormatted} ₽`;
    }
    return `${absFormatted} ₽`;
}

function renderWalletData() {
    const data = ensureWalletSeedData();
    const balanceEl = document.getElementById('wallet-balance-amount');
    const incomeEl = document.getElementById('wallet-stat-income');
    const expenseEl = document.getElementById('wallet-stat-expense');
    const cashbackEl = document.getElementById('wallet-stat-cashback');
    const limitEl = document.getElementById('wallet-stat-limit');
    const historyEl = document.getElementById('wallet-history-list');
    const historyPanelEl = document.getElementById('wallet-history-panel-list');

    if (balanceEl) {
        balanceEl.dataset.rub = String(Math.max(0, Number(data.balanceRub || 0)));
        balanceEl.dataset.usd = String(Math.max(0, Number(data.balanceUsd || 0)));
        const currentCurrency = walletMainCurrency === 'USD' ? 'USD' : 'RUB';
        const mainAmount = currentCurrency === 'USD' ? Number(data.balanceUsd || 0) : Number(data.balanceRub || 0);
        balanceEl.textContent = walletBalanceMasked ? '••••••' : formatAmountByCurrency(mainAmount, currentCurrency);
    }

    const operations = [...(data.operations || [])]
        .filter((item) => Number.isFinite(Number(item?.amount)) || Number.isFinite(Number(item?.amountRub)))
        .sort((a, b) => Number(b.createdAt || 0) - Number(a.createdAt || 0));

    const income = operations
        .filter((op) => operationToRub(op) > 0)
        .reduce((sum, op) => sum + operationToRub(op), 0);
    const expense = operations
        .filter((op) => operationToRub(op) < 0)
        .reduce((sum, op) => sum + Math.abs(operationToRub(op)), 0);
    const cashback = operations
        .filter((op) => op.isCashback)
        .reduce((sum, op) => sum + Math.max(0, operationToRub(op)), 0);

    if (incomeEl) incomeEl.textContent = formatRubAmount(income, true);
    if (expenseEl) expenseEl.textContent = `-${Math.abs(expense).toLocaleString('ru-RU', { maximumFractionDigits: 0 })} ₽`;
    if (cashbackEl) cashbackEl.textContent = formatRubAmount(cashback, true);
    if (limitEl) limitEl.textContent = data.creditLimitRub > 0 ? formatRubAmount(data.creditLimitRub) : '-';
    const sendBalanceHint = document.getElementById('wallet-send-balance-hint');
    if (sendBalanceHint) {
        const selectedCurrency = walletSendCurrency === 'USD' ? 'USD' : 'RUB';
        const amount = selectedCurrency === 'USD' ? Number(data.balanceUsd || 0) : Number(data.balanceRub || 0);
        sendBalanceHint.textContent = `${getCurrentLanguage() === 'en' ? 'Balance' : 'Баланс'}: ${formatAmountByCurrency(amount, selectedCurrency)}`;
    }

    const renderHistory = (container, limit) => {
        if (!container) return;
        if (!operations.length) {
            container.innerHTML = `<div class="wallet-history-empty">${getCurrentLanguage() === 'en' ? 'No transactions yet' : 'Операций пока нет'}</div>`;
            return;
        }

        container.innerHTML = operations.slice(0, limit).map((op) => {
            const opCurrency = getOperationCurrency(op);
            const amount = getOperationAmount(op);
            const amountClass = amount >= 0 ? 'positive' : 'negative';
            const amountText = formatAmountByCurrency(amount, opCurrency, true);
            const dateText = new Date(Number(op.createdAt || Date.now())).toLocaleString(
                getCurrentLanguage() === 'en' ? 'en-US' : 'ru-RU',
                { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }
            );

            return `
                <div class="wallet-history-row">
                    <div class="wallet-history-main">
                        <span class="wallet-history-title">${escapeHtml(String(op.title || 'Операция'))}</span>
                        <span class="wallet-history-meta">${escapeHtml(dateText)}</span>
                    </div>
                    <span class="wallet-history-amount ${amountClass}">${escapeHtml(amountText)}</span>
                </div>
            `;
        }).join('');
    };

    renderHistory(historyEl, 5);
    renderHistory(historyPanelEl, 20);
}

function initWalletCurrencySwitch() {
    const walletScreen = document.getElementById('screen-wallet');
    if (!walletScreen) return;
    const buttons = Array.from(walletScreen.querySelectorAll('.wallet-currency-btn'));
    if (!buttons.length) {
        renderWalletData();
        return;
    }

    const setCurrency = (currency) => {
        walletMainCurrency = currency === 'USD' ? 'USD' : 'RUB';
        buttons.forEach((btn) => {
            const active = btn.dataset.currency === walletMainCurrency;
            btn.classList.toggle('active', active);
        });
        renderWalletData();
    };

    buttons.forEach((btn) => {
        if (btn.dataset.bound === '1') return;
        btn.addEventListener('click', () => setCurrency(btn.dataset.currency));
        btn.dataset.bound = '1';
    });

    const activeBtn = walletScreen.querySelector('.wallet-currency-btn.active');
    setCurrency(activeBtn?.dataset?.currency || 'RUB');
}

function pushWalletOperation(titleRu, titleEn, amount, extra = {}, recipientEmail = null) {
    const data = ensureWalletSeedData();
    const operationCurrency = String(extra.currency || 'RUB').toUpperCase() === 'USD' ? 'USD' : 'RUB';
    const numericAmount = Number(amount || 0);
    const operation = {
        title: getCurrentLanguage() === 'en' ? titleEn : titleRu,
        amount: numericAmount,
        currency: operationCurrency,
        createdAt: Date.now(),
        ...extra
    };

    if (operationCurrency === 'USD') {
        data.balanceUsd = Math.max(0, Number(data.balanceUsd || 0) + numericAmount);
    } else {
        data.balanceRub = Math.max(0, Number(data.balanceRub || 0) + numericAmount);
    }
    data.operations = [operation, ...(Array.isArray(data.operations) ? data.operations : [])].slice(0, 100);
    saveWalletData(data);

    if (recipientEmail) {
        const recipientData = getWalletData(recipientEmail);
        if (operationCurrency === 'USD') {
            recipientData.balanceUsd = Math.max(0, Number(recipientData.balanceUsd || 0) + Math.abs(numericAmount));
        } else {
            recipientData.balanceRub = Math.max(0, Number(recipientData.balanceRub || 0) + Math.abs(numericAmount));
        }

        const incomingTitle = getCurrentLanguage() === 'en'
            ? `Incoming transfer from ${normalizeEmail(currentUserEmail || '')}`
            : `Входящий перевод от ${normalizeEmail(currentUserEmail || '')}`;
        recipientData.operations = [{
            title: incomingTitle,
            amount: Math.abs(numericAmount),
            currency: operationCurrency,
            createdAt: Date.now(),
            incoming: true
        }, ...(Array.isArray(recipientData.operations) ? recipientData.operations : [])].slice(0, 100);
        saveWalletData(recipientData, recipientEmail);
    }

    renderWalletData();
}

function parseWalletAmountInput(value) {
    const normalized = String(value || '').replace(',', '.').trim();
    const numeric = Number(normalized);
    if (!Number.isFinite(numeric) || numeric <= 0) return null;
    return Math.round(numeric * 100) / 100;
}

function initWalletMethodSelector(containerId) {
    const container = document.getElementById(containerId);
    if (!container || container.dataset.bound === '1') return;

    container.addEventListener('click', (event) => {
        const btn = event.target.closest('.wallet-method-btn');
        if (!btn) return;
        if (btn.disabled || btn.classList.contains('is-disabled')) return;
        container.querySelectorAll('.wallet-method-btn').forEach((item) => item.classList.remove('active'));
        btn.classList.add('active');
    });

    container.dataset.bound = '1';
}

function getActiveWalletMethod(containerId, fallback = '') {
    const active = document.querySelector(`#${containerId} .wallet-method-btn.active`);
    return String(active?.dataset?.method || fallback || '').trim();
}

function populateWalletSendContacts() {
    const hiddenInput = document.getElementById('wallet-send-contact');
    const button = document.getElementById('wallet-send-contact-btn');
    if (!hiddenInput || !button) return;

    const selected = normalizeEmail(selectedWalletSendContact || hiddenInput.value || '');
    const users = getLocalUsersSafe();
    const usersMap = new Map(users.map((u) => [normalizeEmail(u?.email), u]));
    const contacts = getCurrentUserContacts();

    if (!selected || !contacts.includes(selected)) {
        hiddenInput.value = '';
        selectedWalletSendContact = '';
        button.textContent = getCurrentLanguage() === 'en' ? 'Select contact' : 'Выберите контакт';
        return;
    }

    const user = usersMap.get(selected);
    const title = (user?.name || user?.displayName || '').trim();
    const showEmail = canCurrentUserSeeEmailOf(selected);
    hiddenInput.value = selected;
    selectedWalletSendContact = selected;
    if (showEmail) {
        button.textContent = title ? `${title} (${selected})` : selected;
    } else {
        button.textContent = title || (getCurrentLanguage() === 'en' ? 'Selected contact' : 'Контакт выбран');
    }
}

async function resolveRecipientNameByWalletAccountNumber(accountNumber) {
    const normalizedInput = String(accountNumber || '').replace(/\D+/g, '');
    if (normalizedInput.length !== 9) return '';

    const users = getLocalUsersSafe();
    for (const user of users) {
        const email = normalizeEmail(user?.email || '');
        if (!email) continue;
        const candidate = String(getWalletAccountNumberByEmail(email) || '').replace(/\D+/g, '');
        if (candidate === normalizedInput) {
            return getDisplayNameByEmail(email) || email;
        }
    }

    if (!isSupabaseEnabled()) return '';

    try {
        const client = getSupabaseClient();
        const formatted = formatWalletAccountNumberInput(accountNumber);
        const { data: accountRow, error: accountError } = await client
            .from('wallet_accounts')
            .select('owner_email')
            .eq('account_number', formatted)
            .maybeSingle();

        if (accountError || !accountRow?.owner_email) return '';

        const ownerEmail = normalizeEmail(accountRow.owner_email);
        const { data: profileRow } = await client
            .from('profiles')
            .select('display_name')
            .eq('email', ownerEmail)
            .maybeSingle();

        return String(profileRow?.display_name || getDisplayNameByEmail(ownerEmail) || ownerEmail).trim();
    } catch (_error) {
        return '';
    }
}

function setWalletRecipientPreview(text, isError = false) {
    const preview = document.getElementById('wallet-send-recipient-preview');
    if (!preview) return;
    preview.textContent = text || '';
    preview.hidden = !text;
    preview.classList.toggle('is-error', Boolean(isError));
}

async function updateWalletRecipientPreview() {
    const mode = getActiveWalletMethod('wallet-send-methods', '');
    if (mode !== 'wallet') {
        setWalletRecipientPreview('');
        return;
    }

    const walletInput = document.getElementById('wallet-send-wallet');
    const formatted = formatWalletAccountNumberInput(walletInput?.value || '');
    const digits = formatted.replace(/\D+/g, '');

    if (digits.length < 9) {
        setWalletRecipientPreview('');
        return;
    }

    const token = ++walletRecipientLookupToken;
    setWalletRecipientPreview(getCurrentLanguage() === 'en' ? 'Searching recipient...' : 'Поиск получателя...');
    const recipientName = await resolveRecipientNameByWalletAccountNumber(formatted);
    if (token !== walletRecipientLookupToken) return;

    if (recipientName) {
        const label = getCurrentLanguage() === 'en' ? 'Recipient' : 'Получатель';
        setWalletRecipientPreview(`${label}: ${recipientName}`);
        return;
    }

    setWalletRecipientPreview(getCurrentLanguage() === 'en' ? 'Recipient not found' : 'Получатель не найден', true);
}

function renderWalletContactPickerList() {
    const list = document.getElementById('wallet-contact-picker-list');
    if (!list) return;

    const users = getLocalUsersSafe();
    const usersMap = new Map(users.map((u) => [normalizeEmail(u?.email), u]));
    const contacts = getCurrentUserContacts().filter((email) => normalizeEmail(email) !== normalizeEmail(currentUserEmail));

    if (!contacts.length) {
        list.innerHTML = `<div class="wallet-history-empty">${getCurrentLanguage() === 'en' ? 'No contacts yet' : 'Контакты пока пусты'}</div>`;
        return;
    }

    list.innerHTML = '';
    contacts.forEach((email) => {
        const normalized = normalizeEmail(email);
        const user = usersMap.get(normalized);
        const title = (user?.name || user?.displayName || '').trim() || normalized;
        const showEmail = canCurrentUserSeeEmailOf(normalized);
        const row = document.createElement('button');
        row.type = 'button';
        row.className = 'wallet-contact-picker-item';
        row.innerHTML = `
            <span class="wallet-contact-picker-item-title">${escapeHtml(title)}</span>
            <span class="wallet-contact-picker-item-subtitle">${escapeHtml(showEmail ? normalized : (getCurrentLanguage() === 'en' ? 'Email hidden' : 'Почта скрыта'))}</span>
        `;
        row.addEventListener('click', () => {
            selectedWalletSendContact = normalized;
            populateWalletSendContacts();
            const sendMethods = document.getElementById('wallet-send-methods');
            if (sendMethods) {
                sendMethods.querySelectorAll('.wallet-method-btn').forEach((item) => {
                    item.classList.toggle('active', item.dataset.method === 'contacts');
                });
                sendMethods.dispatchEvent(new Event('click'));
            }
            goToScreen('screen-wallet-send');
        });
        list.appendChild(row);
    });
}

function submitWalletTopupForm(event) {
    event.preventDefault();
    const amountInput = document.getElementById('wallet-topup-amount');
    const amount = parseWalletAmountInput(amountInput?.value || '');
    if (!amount) return;

    const method = getActiveWalletMethod('wallet-topup-methods', 'card');
    const methodLabel = {
        card: getCurrentLanguage() === 'en' ? 'Card' : 'Карта',
        sbp: getCurrentLanguage() === 'en' ? 'SBP' : 'СБП',
        crypto: 'USDT'
    }[method] || method;

    pushWalletOperation(`Пополнение (${methodLabel})`, `Top up (${methodLabel})`, amount);
    if (amountInput) amountInput.value = '';
}

function submitWalletWithdrawForm(event) {
    event.preventDefault();
    const destinationInput = document.getElementById('wallet-withdraw-destination');
    const amountInput = document.getElementById('wallet-withdraw-amount');
    const destination = String(destinationInput?.value || '').trim();
    const amount = parseWalletAmountInput(amountInput?.value || '');
    if (!destination || !amount) return;

    const data = ensureWalletSeedData();
    if (amount > Number(data.balanceRub || 0)) {
        window.alert(getCurrentLanguage() === 'en' ? 'Not enough balance.' : 'Недостаточно средств.');
        return;
    }

    const method = getActiveWalletMethod('wallet-withdraw-methods', 'card');
    const methodLabel = method === 'wallet'
        ? (getCurrentLanguage() === 'en' ? 'Wallet' : 'Кошелек')
        : (getCurrentLanguage() === 'en' ? 'Card' : 'Карта');

    pushWalletOperation(`Вывод (${methodLabel})`, `Withdraw (${methodLabel})`, -amount);
    if (destinationInput) destinationInput.value = '';
    if (amountInput) amountInput.value = '';
}

async function submitWalletSendForm(event) {
    event.preventDefault();
    const contactInput = document.getElementById('wallet-send-contact');
    const walletInput = document.getElementById('wallet-send-wallet');
    const amountInput = document.getElementById('wallet-send-amount');
    const sendMethod = getActiveWalletMethod('wallet-send-methods', contactInput?.value ? 'contacts' : '');
    if (!sendMethod) return;

    const sendCurrency = walletSendCurrency === 'USD' ? 'USD' : 'RUB';

    const contact = normalizeEmail(contactInput?.value || '');
    const walletNumber = formatWalletAccountNumberInput(String(walletInput?.value || '').trim());
    if (walletInput) walletInput.value = walletNumber;
    const amount = parseWalletAmountInput(amountInput?.value || '');

    if (sendMethod === 'contacts' && !contact) {
        window.alert(getCurrentLanguage() === 'en' ? 'Select contact.' : 'Выберите контакт.');
        return;
    }
    if (sendMethod === 'wallet' && !walletNumber) {
        window.alert(getCurrentLanguage() === 'en' ? 'Enter wallet number.' : 'Укажите номер кошелька.');
        return;
    }
    if (!amount) return;

    const data = ensureWalletSeedData();
    const currentAccountBalance = sendCurrency === 'USD' ? Number(data.balanceUsd || 0) : Number(data.balanceRub || 0);
    if (amount > currentAccountBalance) {
        window.alert(getCurrentLanguage() === 'en' ? 'Not enough balance.' : 'Недостаточно средств.');
        return;
    }

    if (isSupabaseEnabled()) {
        let recipientAccountNumber = '';
        if (sendMethod === 'contacts') {
            const recipientAccount = await ensureWalletAccountOnline(contact);
            recipientAccountNumber = String(recipientAccount?.account_number || '');
        } else {
            recipientAccountNumber = walletNumber;
        }

        if (!recipientAccountNumber) {
            window.alert(getCurrentLanguage() === 'en' ? 'Recipient wallet not found.' : 'Кошелек получателя не найден.');
            return;
        }

        const client = getSupabaseClient();
        const { data, error } = await client.rpc('transfer_wallet_funds', {
            p_sender_email: normalizeEmail(currentUserEmail || ''),
            p_recipient_account_number: recipientAccountNumber,
            p_amount: amount,
            p_currency: sendCurrency,
            p_note: sendMethod === 'contacts' ? `to:${contact}` : `to:${recipientAccountNumber}`
        });

        if (error || !data?.ok) {
            window.alert(getCurrentLanguage() === 'en' ? 'Transfer failed.' : 'Перевод не выполнен.');
            return;
        }

        await syncWalletFromOnline(currentUserEmail);
        renderWalletData();
    } else {
        const resolveWalletNumberToEmail = (numberRaw) => {
            const normalizedNumber = String(numberRaw || '').replace(/\D+/g, '');
            const users = getLocalUsersSafe();
            for (const user of users) {
                const email = normalizeEmail(user?.email || '');
                if (!email) continue;
                const generated = getWalletAccountNumberByEmail(email).replace(/\D+/g, '');
                if (generated === normalizedNumber) return email;
            }
            return '';
        };

        const recipientEmail = sendMethod === 'contacts' ? contact : resolveWalletNumberToEmail(walletNumber);
        if (!recipientEmail) {
            window.alert(getCurrentLanguage() === 'en' ? 'Recipient wallet not found.' : 'Кошелек получателя не найден.');
            return;
        }
        if (normalizeEmail(recipientEmail) === normalizeEmail(currentUserEmail || '')) {
            window.alert(getCurrentLanguage() === 'en' ? 'Cannot transfer to your own wallet.' : 'Нельзя переводить на свой же кошелек.');
            return;
        }

        const receiverLabel = sendMethod === 'contacts' ? recipientEmail : walletNumber;
        pushWalletOperation(
            `Перевод: ${receiverLabel}`,
            `Transfer: ${receiverLabel}`,
            -amount,
            { currency: sendCurrency, recipientEmail },
            recipientEmail
        );
    }
    if (walletInput && sendMethod === 'wallet') walletInput.value = '';
    if (amountInput) amountInput.value = '';
}

function initWalletActionButtons() {
    const sendBtn = document.getElementById('wallet-action-send');
    const historyBtn = document.getElementById('wallet-action-history');
    const scanBtn = document.getElementById('wallet-action-scan');

    if (sendBtn && sendBtn.dataset.bound !== '1') {
        sendBtn.addEventListener('click', () => {
            const sendMethods = document.getElementById('wallet-send-methods');
            if (sendMethods) {
                sendMethods.querySelectorAll('.wallet-method-btn').forEach((item) => item.classList.remove('active'));
            }
            walletSendCurrency = getPreferredTransferCurrency();
            populateWalletSendContacts();
            goToScreen('screen-wallet-send');
        });
        sendBtn.dataset.bound = '1';
    }

    if (historyBtn && historyBtn.dataset.bound !== '1') {
        historyBtn.addEventListener('click', () => {
            goToScreen('screen-wallet-history');
        });
        historyBtn.dataset.bound = '1';
    }

    if (scanBtn && scanBtn.dataset.bound !== '1') {
        scanBtn.dataset.bound = '1';
    }

    initWalletMethodSelector('wallet-send-methods');
    populateWalletSendContacts();

    const contactSelectButton = document.getElementById('wallet-send-contact-btn');
    if (contactSelectButton && contactSelectButton.dataset.bound !== '1') {
        contactSelectButton.addEventListener('click', () => {
            walletContactSelectionMode = true;
            goToScreen('screen-main');
            const contactsTab = document.querySelector('#screen-main .chat-submenu-inner .submenu-btn[data-tab="contacts"]');
            if (contactsTab) {
                contactsTab.click();
            } else {
                activeMainSubmenuTab = 'contacts';
                scheduleChatAreaUpdate({ skipRemoteRefresh: true });
            }
        });
        contactSelectButton.dataset.bound = '1';
    }

    const sendMethods = document.getElementById('wallet-send-methods');
    const methodTitle = document.getElementById('wallet-send-method-title');
    const methodCard = document.getElementById('wallet-send-method-card');
    const sendBalanceHint = document.getElementById('wallet-send-balance-hint');
    const contactRow = document.getElementById('wallet-contact-row');
    const walletInput = document.getElementById('wallet-send-wallet');
    const qrWrap = document.getElementById('wallet-send-qr-wrap');
    const amountWrap = document.getElementById('wallet-send-amount-wrap');
    const submitBtn = document.getElementById('wallet-send-submit-btn');
    const amountInput = document.getElementById('wallet-send-amount');
    const currencyToggle = document.getElementById('wallet-send-currency-toggle');

    if (walletInput && walletInput.dataset.boundFormat !== '1') {
        walletInput.addEventListener('input', () => {
            walletInput.value = formatWalletAccountNumberInput(walletInput.value || '');
            updateWalletRecipientPreview();
        });
        walletInput.dataset.boundFormat = '1';
    }

    const setSendCurrency = (currency) => {
        walletSendCurrency = currency === 'USD' ? 'USD' : 'RUB';
        if (currencyToggle) currencyToggle.textContent = walletSendCurrency === 'USD' ? '$' : '₽';
        renderWalletData();
    };

    if (currencyToggle && currencyToggle.dataset.bound !== '1') {
        currencyToggle.addEventListener('click', () => {
            setSendCurrency(walletSendCurrency === 'USD' ? 'RUB' : 'USD');
        });
        currencyToggle.dataset.bound = '1';
    }

    setSendCurrency(getPreferredTransferCurrency());

    if (sendMethods && sendMethods.dataset.modeBound !== '1') {
        const syncSendMethodFields = () => {
            const mode = getActiveWalletMethod('wallet-send-methods', '');
            const hasMethod = mode === 'contacts' || mode === 'wallet';
            if (methodCard) methodCard.hidden = !hasMethod;
            if (sendBalanceHint) sendBalanceHint.hidden = !hasMethod;
            if (methodTitle) {
                methodTitle.textContent = mode === 'contacts'
                    ? (getCurrentLanguage() === 'en' ? 'Transfer by contacts' : 'Перевод через контакты')
                    : mode === 'wallet'
                        ? (getCurrentLanguage() === 'en' ? 'Transfer by wallet number' : 'Перевод по номеру кошелька')
                        : (getCurrentLanguage() === 'en' ? 'Choose transfer method' : 'Выберите способ перевода');
            }
            if (contactRow) contactRow.hidden = mode !== 'contacts' || !hasMethod;
            if (contactRow) {
                contactRow.style.display = mode === 'contacts' && hasMethod ? '' : 'none';
            }
            if (walletInput) {
                walletInput.hidden = mode !== 'wallet' || !hasMethod;
                if (mode !== 'wallet') {
                    walletInput.value = '';
                    walletRecipientLookupToken += 1;
                    setWalletRecipientPreview('');
                } else {
                    updateWalletRecipientPreview();
                }
            }
            if (qrWrap) qrWrap.hidden = true;
            if (amountWrap) amountWrap.hidden = !hasMethod;
            if (submitBtn) submitBtn.hidden = !hasMethod;
            if (amountInput) amountInput.required = hasMethod;
            if (currencyToggle) currencyToggle.hidden = !hasMethod;
            renderWalletData();
        };
        sendMethods.addEventListener('click', syncSendMethodFields);
        syncSendMethodFields();
        sendMethods.dataset.modeBound = '1';
    }

    const exchangeToggle = document.getElementById('wallet-exchange-toggle');
    const exchangePair = document.getElementById('wallet-exchange-pair');
    const exchangePreview = document.getElementById('wallet-exchange-preview');
    const exchangeAmount = document.getElementById('wallet-exchange-amount');
    const exchangeForm = document.getElementById('wallet-exchange-form');
    let exchangeFromCurrency = 'RUB';

    const renderExchangePreview = () => {
        if (!exchangePair || !exchangePreview) return;
        const rate = getWalletUsdRate();
        const amount = parseWalletAmountInput(exchangeAmount?.value || '') || 0;
        const feeAdjusted = amount * 0.95;
        const receive = exchangeFromCurrency === 'RUB' ? (feeAdjusted / rate) : (feeAdjusted * rate);
        const receiveCurrency = exchangeFromCurrency === 'RUB' ? 'USD' : 'RUB';
        exchangePair.textContent = exchangeFromCurrency === 'RUB' ? 'RUB → USD' : 'USD → RUB';
        exchangePreview.textContent = `${getCurrentLanguage() === 'en' ? 'You will receive' : 'К зачислению'}: ${formatAmountByCurrency(receive, receiveCurrency)}`;
    };

    if (exchangeToggle && exchangeToggle.dataset.bound !== '1') {
        exchangeToggle.addEventListener('click', () => {
            exchangeFromCurrency = exchangeFromCurrency === 'RUB' ? 'USD' : 'RUB';
            renderExchangePreview();
        });
        exchangeToggle.dataset.bound = '1';
    }

    if (exchangeAmount && exchangeAmount.dataset.bound !== '1') {
        exchangeAmount.addEventListener('input', renderExchangePreview);
        exchangeAmount.dataset.bound = '1';
    }

    if (exchangeForm && exchangeForm.dataset.bound !== '1') {
        exchangeForm.addEventListener('submit', async (event) => {
            event.preventDefault();
            const amount = parseWalletAmountInput(exchangeAmount?.value || '');
            if (!amount) return;

            if (isSupabaseEnabled()) {
                const client = getSupabaseClient();
                const { data, error } = await client.rpc('exchange_wallet_currency', {
                    p_owner_email: normalizeEmail(currentUserEmail || ''),
                    p_amount: amount,
                    p_from_currency: exchangeFromCurrency,
                    p_fee_percent: 5,
                    p_usd_rate: getWalletUsdRate()
                });

                if (error || !data?.ok) {
                    window.alert(getCurrentLanguage() === 'en' ? 'Exchange failed.' : 'Обмен не выполнен.');
                    return;
                }

                await syncWalletFromOnline(currentUserEmail);
            } else {
                const data = ensureWalletSeedData();
                const fromBalance = exchangeFromCurrency === 'RUB' ? Number(data.balanceRub || 0) : Number(data.balanceUsd || 0);
                if (amount > fromBalance) {
                    window.alert(getCurrentLanguage() === 'en' ? 'Not enough balance.' : 'Недостаточно средств.');
                    return;
                }

                const rate = getWalletUsdRate();
                const feeAdjusted = amount * 0.95;
                const toCurrency = exchangeFromCurrency === 'RUB' ? 'USD' : 'RUB';
                const receiveAmount = exchangeFromCurrency === 'RUB' ? (feeAdjusted / rate) : (feeAdjusted * rate);

                if (exchangeFromCurrency === 'RUB') {
                    data.balanceRub = Math.max(0, Number(data.balanceRub || 0) - amount);
                    data.balanceUsd = Math.max(0, Number(data.balanceUsd || 0) + receiveAmount);
                } else {
                    data.balanceUsd = Math.max(0, Number(data.balanceUsd || 0) - amount);
                    data.balanceRub = Math.max(0, Number(data.balanceRub || 0) + receiveAmount);
                }

                data.operations = [{
                    title: exchangeFromCurrency === 'RUB'
                        ? (getCurrentLanguage() === 'en' ? 'Currency exchange RUB to USD' : 'Обмен RUB на USD')
                        : (getCurrentLanguage() === 'en' ? 'Currency exchange USD to RUB' : 'Обмен USD на RUB'),
                    amount: -amount,
                    currency: exchangeFromCurrency,
                    createdAt: Date.now()
                }, {
                    title: exchangeFromCurrency === 'RUB'
                        ? (getCurrentLanguage() === 'en' ? 'Currency exchange receipt USD' : 'Зачисление обмена USD')
                        : (getCurrentLanguage() === 'en' ? 'Currency exchange receipt RUB' : 'Зачисление обмена RUB'),
                    amount: receiveAmount,
                    currency: toCurrency,
                    createdAt: Date.now()
                }, ...(Array.isArray(data.operations) ? data.operations : [])].slice(0, 100);

                saveWalletData(data);
            }

            if (exchangeAmount) exchangeAmount.value = '';
            renderExchangePreview();
            renderWalletData();
        });
        exchangeForm.dataset.bound = '1';
    }

    renderExchangePreview();

    const walletSettingsOpenBtn = document.getElementById('wallet-open-settings');
    if (walletSettingsOpenBtn && walletSettingsOpenBtn.dataset.bound !== '1') {
        walletSettingsOpenBtn.addEventListener('click', () => {
            const hideOnOpenInput = document.getElementById('wallet-hide-balance-on-open');
            const accountNumberEl = document.getElementById('wallet-account-number');
            const settings = getWalletUiSettings();
            if (hideOnOpenInput) hideOnOpenInput.checked = Boolean(settings.hideBalanceOnOpen);
            if (accountNumberEl) {
                const number = getWalletAccountNumberByEmail(currentUserEmail || '');
                accountNumberEl.dataset.full = String(number || '');
                accountNumberEl.dataset.masked = '1';
                accountNumberEl.textContent = String(number || '').replace(/\d/g, '•');
            }
            goToScreen('screen-wallet-settings');
        });
        walletSettingsOpenBtn.dataset.bound = '1';
    }

    const hideOnOpenInput = document.getElementById('wallet-hide-balance-on-open');
    if (hideOnOpenInput && hideOnOpenInput.dataset.bound !== '1') {
        hideOnOpenInput.addEventListener('change', () => {
            saveWalletUiSettings({ hideBalanceOnOpen: Boolean(hideOnOpenInput.checked) });
            walletBalanceMasked = Boolean(hideOnOpenInput.checked);
            renderWalletData();
        });
        hideOnOpenInput.dataset.bound = '1';
    }

    const walletBalanceEl = document.getElementById('wallet-balance-amount');
    if (walletBalanceEl && walletBalanceEl.dataset.boundReveal !== '1') {
        walletBalanceEl.addEventListener('click', () => {
            walletBalanceMasked = !walletBalanceMasked;
            renderWalletData();
        });
        walletBalanceEl.dataset.boundReveal = '1';
    }

    const walletAccountNumberEl = document.getElementById('wallet-account-number');
    if (walletAccountNumberEl && walletAccountNumberEl.dataset.boundReveal !== '1') {
        walletAccountNumberEl.addEventListener('click', () => {
            const fullNumber = String(walletAccountNumberEl.dataset.full || getWalletAccountNumberByEmail(currentUserEmail || '') || '').trim();
            if (!fullNumber) return;
            walletAccountNumberEl.textContent = fullNumber;
            walletAccountNumberEl.dataset.masked = '0';
            copyToClipboard(fullNumber);
        });
        walletAccountNumberEl.dataset.boundReveal = '1';
    }

    const sendForm = document.getElementById('wallet-send-form');
    if (sendForm && sendForm.dataset.bound !== '1') {
        sendForm.addEventListener('submit', submitWalletSendForm);
        sendForm.dataset.bound = '1';
    }

    document.querySelectorAll('[data-back-wallet]').forEach((button) => {
        if (button.dataset.bound === '1') return;
        button.addEventListener('click', () => goToScreen('screen-wallet'));
        button.dataset.bound = '1';
    });

}

function getCurrentLanguage() {
    const saved = localStorage.getItem('appLanguage') || 'ru';
    return saved === 'en' ? 'en' : 'ru';
}

function applyLanguage(lang) {
    const nextLang = lang === 'en' ? 'en' : 'ru';
    localStorage.setItem('appLanguage', nextLang);
    document.documentElement.lang = nextLang;

    const tr = {
        ru: {
            settingsNotifications: 'Уведомления',
            settingsPrivacy: 'Конфиденциальность',
            settingsDevices: 'Устройства',
            settingsTheme: 'Тема',
            settingsLanguage: 'Язык',
            settingsWallet: 'Кошелек',
            settingsServices: 'Сервисы',
            settingsMarket: 'Маркет',
            settingsNotificationsDesc: 'Настройка звуков и оповещений',
            settingsPrivacyDesc: 'Пароль, почта и безопасность',
            settingsDevicesDesc: 'Управление привязанными устройствами',
            settingsThemeDesc: 'Переключение тёмной и светлой темы',
            settingsLanguageDesc: 'Выбор языка интерфейса',
            settingsWalletDesc: 'Баланс и история транзакций',
            settingsServicesDesc: 'Дополнительные возможности',
            settingsMarketDesc: 'Покупки и предложения',
            notificationsTitle: 'Уведомления',
            privacyTitle: 'Конфиденциальность',
            privacyChangePassword: 'Изменить пароль',
            privacyChangeEmail: 'Изменить почту',
            privacyPasswordTitle: 'Смена пароля',
            privacyOldPassword: 'Старый пароль',
            privacyNewPassword: 'Новый пароль',
            privacySavePassword: 'Сохранить новый пароль',
            notifSend: 'Звук отправки',
            notifIncoming: 'Звук входящих',
            notifPush: 'Push-уведомления',
            notifVibration: 'Вибрация',
            notifSendDesc: 'Проигрывать звук при отправке сообщения',
            notifIncomingDesc: 'Звук при новых сообщениях',
            notifPushDesc: 'Показывать системные уведомления',
            notifVibrationDesc: 'Вибро-отклик на мобильных',
            notifConnectBtn: 'Подключить уведомления',
            notifStatusLabel: 'Статус',
            notifStatusGranted: 'разрешены',
            notifStatusDenied: 'запрещены',
            notifStatusDefault: 'не запрошено',
            notifStatusUnsupported: 'не поддерживается',
            devicesTitle: 'Устройства в аккаунте',
            languageTitle: 'Язык',
            walletTitle: 'Кошелек',
            walletSubtitle: 'Тестовый баланс',
            walletSend: 'Отправить',
            walletTopup: 'Пополнить',
            walletWithdraw: 'Вывести',
            walletHistory: 'Обмен',
            walletScanQr: 'Скан QR',
            servicesTitle: 'Наши сервисы',
            marketTitle: 'Маркет',
            marketSoon: 'Предметы коллекции',
            navChats: 'Чаты',
            navProfile: 'Профиль',
            navSettings: 'Настройки',
            profileStories: 'Истории',
            profileNoStories: 'Нет историй',
            profileDescription: 'Описание',
            profileBirthDate: 'Дата рождения',
            profileNotSpecified: 'Не указан',
            profileNotSpecifiedFemale: 'Не указана',
            profileCollection: 'Коллекция',
            profileCollectionEmpty: 'Коллекция пуста',
            walletStatsTitle: 'Статистика',
            walletIncome: 'Доход',
            walletExpense: 'Расход',
            walletCashback: 'Кэшбек',
            walletLimit: 'Лимит',
            walletRecentOps: 'Последние операции',
            walletOpTopup: 'Пополнение карты',
            walletOpSubscription: 'Оплата подписки',
            walletOpTransferFromContact: 'Перевод от контакта',
            walletToday: 'Сегодня, 12:41',
            walletYesterdayOne: 'Вчера, 19:12',
            walletYesterdayTwo: 'Вчера, 14:03',
            accountSection: 'Аккаунты',
            userProfileNameFallback: 'Пользователь',
            profileMenuLogout: 'Выйти из аккаунта',
            profileAddToContacts: 'Добавить в контакты',
            profileInContacts: 'В контактах',
            profileBlockUser: 'Заблокировать пользователя',
            profileUnblockUser: 'Разблокировать пользователя',
            userProfileNoStories: 'Нет историй'
        },
        en: {
            settingsNotifications: 'Notifications',
            settingsPrivacy: 'Privacy',
            settingsDevices: 'Devices',
            settingsTheme: 'Theme',
            settingsLanguage: 'Language',
            settingsWallet: 'Wallet',
            settingsServices: 'Services',
            settingsMarket: 'Market',
            settingsNotificationsDesc: 'Manage sounds and alerts',
            settingsPrivacyDesc: 'Password, email and security',
            settingsDevicesDesc: 'Manage signed-in devices',
            settingsThemeDesc: 'Switch between dark and light theme',
            settingsLanguageDesc: 'Choose app language',
            settingsWalletDesc: 'Balance and transaction history',
            settingsServicesDesc: 'Additional features',
            settingsMarketDesc: 'Shopping and offers',
            notificationsTitle: 'Notifications',
            privacyTitle: 'Privacy',
            privacyChangePassword: 'Change password',
            privacyChangeEmail: 'Change email',
            privacyPasswordTitle: 'Change password',
            privacyOldPassword: 'Current password',
            privacyNewPassword: 'New password',
            privacySavePassword: 'Save new password',
            notifSend: 'Send sound',
            notifIncoming: 'Incoming sound',
            notifPush: 'Push notifications',
            notifVibration: 'Vibration',
            notifSendDesc: 'Play a sound when sending a message',
            notifIncomingDesc: 'Play a sound for new messages',
            notifPushDesc: 'Show system notifications',
            notifVibrationDesc: 'Vibration feedback on mobile',
            notifConnectBtn: 'Enable notifications',
            notifStatusLabel: 'Status',
            notifStatusGranted: 'allowed',
            notifStatusDenied: 'blocked',
            notifStatusDefault: 'not requested',
            notifStatusUnsupported: 'unsupported',
            devicesTitle: 'Signed-in devices',
            languageTitle: 'Language',
            walletTitle: 'Wallet',
            walletSubtitle: 'Test balance',
            walletSend: 'Send',
            walletTopup: 'Top up',
            walletWithdraw: 'Withdraw',
            walletHistory: 'Exchange',
            walletScanQr: 'Scan QR',
            servicesTitle: 'Our services',
            marketTitle: 'Market',
            marketSoon: 'Collection items',
            navChats: 'Chats',
            navProfile: 'Profile',
            navSettings: 'Settings',
            profileStories: 'Stories',
            profileNoStories: 'No stories yet',
            profileDescription: 'Description',
            profileBirthDate: 'Birth date',
            profileNotSpecified: 'Not specified',
            profileNotSpecifiedFemale: 'Not specified',
            profileCollection: 'Collection',
            profileCollectionEmpty: 'Collection is empty',
            walletStatsTitle: 'Statistics',
            walletIncome: 'Income',
            walletExpense: 'Expenses',
            walletCashback: 'Cashback',
            walletLimit: 'Limit',
            walletRecentOps: 'Recent activity',
            walletOpTopup: 'Card top up',
            walletOpSubscription: 'Subscription payment',
            walletOpTransferFromContact: 'Transfer from contact',
            walletToday: 'Today, 12:41',
            walletYesterdayOne: 'Yesterday, 19:12',
            walletYesterdayTwo: 'Yesterday, 14:03',
            accountSection: 'Accounts',
            userProfileNameFallback: 'User',
            profileMenuLogout: 'Log out',
            profileAddToContacts: 'Add to contacts',
            profileInContacts: 'In contacts',
            profileBlockUser: 'Block user',
            profileUnblockUser: 'Unblock user',
            userProfileNoStories: 'No stories yet'
        }
    }[nextLang];

    const setText = (selector, text) => {
        const el = document.querySelector(selector);
        if (el && typeof text === 'string') el.textContent = text;
    };
    const setPlaceholder = (selector, text) => {
        const el = document.querySelector(selector);
        if (el && typeof text === 'string') el.setAttribute('placeholder', text);
    };

    setText('#action-notifications .action-button-text span:first-child', tr.settingsNotifications);
    setText('#action-privacy .action-button-text span:first-child', tr.settingsPrivacy);
    setText('#action-devices .action-button-text span:first-child', tr.settingsDevices);
    setText('#action-theme-settings .action-button-text span:first-child', tr.settingsTheme);
    setText('#action-language .action-button-text span:first-child', tr.settingsLanguage);
    setText('#action-wallet .action-button-text span:first-child', tr.settingsWallet);
    setText('#services-btn .action-button-text span:first-child', tr.settingsServices);
    setText('#market-btn .action-button-text span:first-child', tr.settingsMarket);

    setText('#action-notifications .action-button-desc', tr.settingsNotificationsDesc);
    setText('#action-privacy .action-button-desc', tr.settingsPrivacyDesc);
    setText('#action-devices .action-button-desc', tr.settingsDevicesDesc);
    setText('#action-theme-settings .action-button-desc', tr.settingsThemeDesc);
    setText('#action-language .action-button-desc', tr.settingsLanguageDesc);
    setText('#action-wallet .action-button-desc', tr.settingsWalletDesc);
    setText('#services-btn .action-button-desc', tr.settingsServicesDesc);
    setText('#market-btn .action-button-desc', tr.settingsMarketDesc);
    setText('label[for="setting-nickname-gradient"] .notification-toggle-text span:first-child', nextLang === 'en' ? 'Gradient nickname' : 'Градиентный ник');
    setText('label[for="setting-nickname-gradient"] .action-button-desc', nextLang === 'en' ? 'Animated gradient flow for nicknames' : 'Переливание ника градиентом');

    setText('#screen-notifications .section-title', tr.notificationsTitle);
    setText('#screen-privacy .section-title', tr.privacyTitle);
    setText('#privacy-change-password-btn .language-label', tr.privacyChangePassword);
    setText('#privacy-change-email-btn .language-label', tr.privacyChangeEmail);
    setText('#privacy-password-panel .privacy-password-title', tr.privacyPasswordTitle);
    setPlaceholder('#privacy-old-password', tr.privacyOldPassword);
    setPlaceholder('#privacy-new-password', tr.privacyNewPassword);
    setText('#privacy-password-form .privacy-submit-btn', tr.privacySavePassword);
    setText('label[for="notif-send-sound"] .notification-toggle-text span:first-child', tr.notifSend);
    setText('label[for="notif-incoming-sound"] .notification-toggle-text span:first-child', tr.notifIncoming);
    setText('label[for="notif-push-enabled"] .notification-toggle-text span:first-child', tr.notifPush);
    setText('label[for="notif-vibration-enabled"] .notification-toggle-text span:first-child', tr.notifVibration);
    setText('label[for="notif-send-sound"] .action-button-desc', tr.notifSendDesc);
    setText('label[for="notif-incoming-sound"] .action-button-desc', tr.notifIncomingDesc);
    setText('label[for="notif-push-enabled"] .action-button-desc', tr.notifPushDesc);
    setText('label[for="notif-vibration-enabled"] .action-button-desc', tr.notifVibrationDesc);
    setText('#notif-connect-btn', tr.notifConnectBtn);

    setText('#screen-devices .section-title', tr.devicesTitle);
    setText('#screen-languages .section-title', tr.languageTitle);
    setText('#screen-wallet .section-title', tr.walletTitle);
    setText('#screen-wallet .wallet-subtitle', tr.walletSubtitle);
    setText('#wallet-action-send .wallet-action-label', tr.walletSend);
    setText('#wallet-action-topup .wallet-action-label', tr.walletTopup);
    setText('#wallet-action-withdraw .wallet-action-label', tr.walletWithdraw);
    setText('#wallet-action-history .wallet-action-label', tr.walletHistory);
    const scanBtn = document.getElementById('wallet-action-scan');
    if (scanBtn) {
        scanBtn.setAttribute('aria-label', tr.walletScanQr);
        scanBtn.setAttribute('title', tr.walletScanQr);
    }
    setText('#screen-wallet .wallet-stats-card .section-title', tr.walletStatsTitle);
    setText('#screen-wallet .wallet-stat-item:nth-child(1) .wallet-stat-label', tr.walletIncome);
    setText('#screen-wallet .wallet-stat-item:nth-child(2) .wallet-stat-label', tr.walletExpense);
    setText('#screen-wallet .wallet-stat-item:nth-child(3) .wallet-stat-label', tr.walletCashback);
    setText('#screen-wallet .wallet-stat-item:nth-child(4) .wallet-stat-label', tr.walletLimit);
    setText('#screen-wallet .wallet-history-card .section-title', tr.walletRecentOps);
    renderWalletData();
    setText('#screen-services .services-header', tr.servicesTitle);
    setText('#screen-market .services-header', tr.marketTitle);
    setText('#market-collection-title', tr.marketSoon);
    renderMarketCollectionItems();
    setText('.bottom-nav-glass .nav-item[data-screen="screen-main"] span', tr.navChats);
    setText('.bottom-nav-glass .nav-item[data-screen="screen-profile"] span', tr.navProfile);
    setText('.bottom-nav-glass .nav-item[data-screen="screen-settings"] span', tr.navSettings);
    setText('#screen-profile .stories-title', tr.profileStories);
    setText('#screen-profile .stories-empty', tr.profileNoStories);
    setText('#screen-profile .details-title', nextLang === 'en' ? 'Account details' : 'Подробности об аккаунте');
    setText('#screen-profile .profile-media-tabs-inner .submenu-btn[data-tab="stories"]', tr.profileStories);
    setText('#screen-profile .profile-media-tabs-inner .submenu-btn[data-tab="collection"]', tr.profileCollection);
    setText('#screen-profile .profile-collection-section .collection-title', tr.profileCollection);
    setText('#screen-profile .profile-collection-section .collection-empty', tr.profileCollectionEmpty);
    setText('#logout-from-menu span', tr.profileMenuLogout);
    setText('#user-profile-open-chat-action span', nextLang === 'en' ? 'Open chat' : 'Открыть чат');
    setText('#user-profile-add-contact-action span', tr.profileAddToContacts);
    setText('#user-profile-block-action span', tr.profileBlockUser);
    setText('#user-profile-stories-list .stories-empty', tr.userProfileNoStories);
    setText('#screen-user-profile .detail-item-static:nth-child(1) .detail-item-static-label', tr.profileDescription);
    setText('#screen-user-profile .detail-item-static:nth-child(3) .detail-item-static-label', tr.profileBirthDate);
    setText('#user-profile-status', tr.profileNotSpecified);
    setText('#user-profile-username', tr.profileNotSpecified);
    setText('#user-profile-birthday', tr.profileNotSpecifiedFemale);
    setText('#user-profile-media-tabs .submenu-btn[data-tab="stories"]', tr.profileStories);
    setText('#user-profile-media-tabs .submenu-btn[data-tab="collection"]', tr.profileCollection);
    setText('#screen-user-profile .collection-title', tr.profileCollection);
    setText('#screen-user-profile .collection-empty', tr.profileCollectionEmpty);
    setText('#screen-settings .settings-section .section-title', tr.accountSection);
    setText('label[for="edit-email-visibility"]', nextLang === 'en' ? 'Who can see my email' : 'Кто видит мою почту');
    setText('#edit-email-visibility-switch .edit-visibility-option[data-value="contacts"]', nextLang === 'en' ? 'Contacts only' : 'Только контакты');
    setText('#edit-email-visibility-switch .edit-visibility-option[data-value="nobody"]', nextLang === 'en' ? 'Nobody' : 'Никто');
    setText('#nav-add-story-btn span', nextLang === 'en' ? 'Story' : 'История');
    const addStoryBtn = document.getElementById('nav-add-story-btn');
    if (addStoryBtn) {
        addStoryBtn.setAttribute('title', nextLang === 'en' ? 'Add story' : 'Добавить историю');
        addStoryBtn.setAttribute('aria-label', nextLang === 'en' ? 'Add story' : 'Добавить историю');
    }
    updateMembershipUI();
    updateUnreadUiIndicators();

    if (nextLang === 'en') {
        setText('#screen-login h2', 'Welcome back!');
        setText('#screen-login .subtitle', 'Glad to see you again');
        setText('#login-form .btn-primary', 'Sign in');
        setText('#screen-register h2', 'Create account');
        setText('#screen-register .subtitle', 'Join Marglet');
        setText('#register-form .btn-primary', 'Sign up');
        setText('#screen-name h2', 'What is your name?');
        setText('#screen-name .subtitle', 'Enter a name visible to other users');
        setText('#name-form .btn-primary', 'Continue');
        setText('#screen-phone h2', 'Security');
        setText('#screen-phone .subtitle', 'Link a phone number to protect your account');
        setText('#phone-form .btn-primary', 'Finish registration');
        setText('.header-title', 'Chats');
        setText('#screen-main .chat-submenu-inner .submenu-btn[data-tab="chats"]', 'Chats');
        setText('#screen-main .chat-submenu-inner .submenu-btn[data-tab="conversations"]', 'Conversations');
        setText('#screen-main .chat-submenu-inner .submenu-btn[data-tab="communities"]', 'Communities');
        setText('#screen-main .chat-submenu-inner .submenu-btn[data-tab="contacts"]', 'Contacts');
        setText('#screen-edit-profile .edit-bottom-btn.secondary', 'Cancel');
        setText('#screen-edit-profile .edit-bottom-btn.primary', 'Save profile');
        setText('label[for="edit-display-name"]', 'Display name');
        setText('label[for="edit-phone"]', 'Phone number');
        setText('label[for="edit-birthday"]', 'Birth date');
        setText('label[for="edit-status"]', 'About me');
        setText('label[for="glow-color-options-edit"]', 'Glow color');
        setPlaceholder('#chat-search', 'Search...');
        setPlaceholder('#chat-message-input', 'Message...');
        setPlaceholder('#edit-display-name', 'Your name');
        setPlaceholder('#edit-status', 'Tell something about yourself...');
        const birthdayInput = document.getElementById('edit-birthday');
        if (birthdayInput) birthdayInput.setAttribute('lang', 'en-US');
    } else {
        setText('#screen-login h2', 'С возвращением!');
        setText('#screen-login .subtitle', 'Рады видеть вас снова');
        setText('#login-form .btn-primary', 'Войти');
        setText('#screen-register h2', 'Создать аккаунт');
        setText('#screen-register .subtitle', 'Присоединяйся в Marglet');
        setText('#register-form .btn-primary', 'Зарегистрироваться');
        setText('#screen-name h2', 'Как вас зовут?');
        setText('#screen-name .subtitle', 'Введите имя, которое будут видеть другие пользователи');
        setText('#name-form .btn-primary', 'Продолжить');
        setText('#screen-phone h2', 'Безопасность');
        setText('#screen-phone .subtitle', 'Привяжите номер телефона для защиты аккаунта');
        setText('#phone-form .btn-primary', 'Завершить регистрацию');
        setText('.header-title', 'Чаты');
        setText('#screen-main .chat-submenu-inner .submenu-btn[data-tab="chats"]', 'Чаты');
        setText('#screen-main .chat-submenu-inner .submenu-btn[data-tab="conversations"]', 'Беседы');
        setText('#screen-main .chat-submenu-inner .submenu-btn[data-tab="communities"]', 'Сообщества');
        setText('#screen-main .chat-submenu-inner .submenu-btn[data-tab="contacts"]', 'Контакты');
        setText('#screen-edit-profile .edit-bottom-btn.secondary', 'Отмена');
        setText('#screen-edit-profile .edit-bottom-btn.primary', 'Сохранить профиль');
        setText('label[for="edit-display-name"]', 'Отображаемое имя');
        setText('label[for="edit-phone"]', 'Номер телефона');
        setText('label[for="edit-birthday"]', 'Дата рождения');
        setText('label[for="edit-status"]', 'О себе');
        setText('label[for="glow-color-options-edit"]', 'Цвет свечения');
        setPlaceholder('#chat-search', 'Поиск...');
        setPlaceholder('#chat-message-input', 'Сообщение...');
        setPlaceholder('#edit-display-name', 'Как вас зовут');
        setPlaceholder('#edit-status', 'Расскажите о себе...');
        const birthdayInput = document.getElementById('edit-birthday');
        if (birthdayInput) birthdayInput.setAttribute('lang', 'ru-RU');
    }

    const ruLabel = langRuBtn ? langRuBtn.querySelector('.language-label') : null;
    const enLabel = langEnBtn ? langEnBtn.querySelector('.language-label') : null;
    if (ruLabel) ruLabel.textContent = nextLang === 'en' ? 'Russian' : 'Русский';
    if (enLabel) enLabel.textContent = 'English';

    updateUserProfileContactAction();
    updateUserProfileBlockButton();
    renderDevicesList();
    updateChatArea({ skipRemoteRefresh: true });
}

function loadNotificationSettingsUI() {
    const settings = getNotificationSettings();
    if (notifSendSoundInput) notifSendSoundInput.checked = Boolean(settings.sendSound);
    if (notifIncomingSoundInput) notifIncomingSoundInput.checked = Boolean(settings.incomingSound);
    if (notifPushEnabledInput) notifPushEnabledInput.checked = Boolean(settings.pushEnabled);
    if (notifVibrationEnabledInput) notifVibrationEnabledInput.checked = Boolean(settings.vibrationEnabled);
    updateNotificationPermissionStatus();
    if (settings.pushEnabled) {
        void syncWebPushSubscriptionWithSupabase();
    }
}

function updateNotificationPermissionStatus() {
    if (!notifPermissionStatus) return;

    const lang = getCurrentLanguage();
    const isRu = lang !== 'en';
    let statusText = isRu ? 'не поддерживается' : 'unsupported';

    if (typeof window !== 'undefined' && typeof window.Notification !== 'undefined') {
        if (Notification.permission === 'granted') {
            statusText = isRu ? 'разрешены' : 'allowed';
        } else if (Notification.permission === 'denied') {
            statusText = isRu ? 'запрещены' : 'blocked';
        } else {
            statusText = isRu ? 'не запрошено' : 'not requested';
        }
    }

    notifPermissionStatus.textContent = (isRu ? 'Статус: ' : 'Status: ') + statusText;
}

function bindNotificationPermissionButton() {
    if (!notifConnectBtn || notifConnectBtn.dataset.bound === '1') return;

    notifConnectBtn.addEventListener('click', async () => {
        const permission = await requestNotificationPermissionIfNeeded(true);

        if (permission === 'granted') {
            await ensureNotificationServiceWorkerReady();
            await syncWebPushSubscriptionWithSupabase();
            if (notifPushEnabledInput) notifPushEnabledInput.checked = true;
            saveNotificationSettings({
                sendSound: Boolean(notifSendSoundInput?.checked),
                incomingSound: Boolean(notifIncomingSoundInput?.checked),
                pushEnabled: true,
                vibrationEnabled: Boolean(notifVibrationEnabledInput?.checked)
            });
        } else if (permission === 'insecure-context') {
            alert('Откройте сайт по HTTPS, иначе системные уведомления в браузере не работают.');
        } else if (permission !== 'unsupported') {
            alert('Разрешите уведомления в браузере для этого сайта, чтобы получать push о новых сообщениях.');
        }

        updateNotificationPermissionStatus();
    });

    notifConnectBtn.dataset.bound = '1';
}

function bindNotificationSettingsHandlers() {
    const inputs = [notifSendSoundInput, notifIncomingSoundInput, notifPushEnabledInput, notifVibrationEnabledInput].filter(Boolean);
    if (!inputs.length) return;
    inputs.forEach(input => {
        if (input.dataset.bound === '1') return;
        input.addEventListener('change', async () => {
            if (input === notifPushEnabledInput && notifPushEnabledInput?.checked) {
                const permission = await requestNotificationPermissionIfNeeded(true);
                if (permission !== 'granted') {
                    notifPushEnabledInput.checked = false;
                    alert('Разрешите системные уведомления в браузере, чтобы получать push о новых сообщениях.');
                } else {
                    await ensureNotificationServiceWorkerReady();
                    await syncWebPushSubscriptionWithSupabase();
                }
            } else if (input === notifPushEnabledInput && !notifPushEnabledInput?.checked) {
                await disableWebPushSubscription();
            }

            saveNotificationSettings({
                sendSound: Boolean(notifSendSoundInput?.checked),
                incomingSound: Boolean(notifIncomingSoundInput?.checked),
                pushEnabled: Boolean(notifPushEnabledInput?.checked),
                vibrationEnabled: Boolean(notifVibrationEnabledInput?.checked)
            });
        });
        input.dataset.bound = '1';
    });
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
    const modalImg = document.getElementById('image-modal-img');
    const modalVideo = document.getElementById('image-modal-video');
    const closeBtn = document.getElementById('image-modal-close');
    const downloadBtn = document.getElementById('image-modal-download');
    
    if (!modal) return;

    const closeModal = () => {
        modal.classList.remove('active');
        if (modalVideo) {
            modalVideo.pause();
            modalVideo.removeAttribute('src');
            modalVideo.classList.remove('active');
        }
        if (modalImg) {
            modalImg.removeAttribute('src');
            modalImg.classList.remove('active');
        }
        modal.removeAttribute('data-type');
    };
    
    // Закрыть при клике на крестик
    if (closeBtn) {
        closeBtn.addEventListener('click', closeModal);
    }
    
    // Закрыть при клике на backdrop (вне контента)
    modal.addEventListener('click', (e) => {
        if (e.target === modal) {
            closeModal();
        }
    });
    
    // Закрыть при нажатии Escape
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && modal.classList.contains('active')) {
            closeModal();
        }
    });
    
    // Обработчик для кнопки скачивания в модали
    if (downloadBtn) {
        downloadBtn.addEventListener('click', (event) => {
            event.stopPropagation();
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

if (premiumCard) {
    premiumCard.addEventListener('click', () => {
        goToScreen('screen-gold');
    });
}

if (goldBackBtn) {
    goldBackBtn.addEventListener('click', () => {
        goToScreen('screen-settings');
    });
}

if (goldBuyBtn) {
    goldBuyBtn.addEventListener('click', () => {
        const next = getMembershipState();
        next.gold = true;
        saveMembershipState(next);
        updateMembershipUI();
        alert('Margelet Boost подключен. Списано 199 руб.');
    });
}

if (businessCard) {
    businessCard.addEventListener('click', () => {
        const next = getMembershipState();
        next.business = !Boolean(next.business);
        saveMembershipState(next);
        updateMembershipUI();
        alert(next.business ? 'Margelet Business подключен.' : 'Margelet Business отключен.');
    });
}

if (actionNotificationsBtn) {
    actionNotificationsBtn.addEventListener('click', () => {
        loadNotificationSettingsUI();
        bindNotificationSettingsHandlers();
        bindNotificationPermissionButton();
        goToScreen('screen-notifications');
    });
}

if (actionPrivacyBtn) {
    actionPrivacyBtn.addEventListener('click', () => {
        bindPrivacyVisibilityHandlers();
        loadPrivacySettingsUI();
        if (privacyPasswordPanel) privacyPasswordPanel.style.display = 'none';
        if (privacyEmailPanel) privacyEmailPanel.style.display = 'none';
        if (privacyPinPanel) privacyPinPanel.style.display = 'none';
        goToScreen('screen-privacy');
    });
}

if (actionDevicesBtn) {
    actionDevicesBtn.addEventListener('click', () => {
        goToDevicesScreen();
    });
}

if (actionLanguageBtn) {
    actionLanguageBtn.addEventListener('click', () => {
        goToLanguagesScreen();
    });
}

if (actionWalletBtn) {
    actionWalletBtn.addEventListener('click', () => {
        goToWalletScreen();
    });
}

bindNicknameGradientSettings();

if (langRuBtn) {
    langRuBtn.addEventListener('click', () => applyLanguage('ru'));
}

if (langEnBtn) {
    langEnBtn.addEventListener('click', () => applyLanguage('en'));
}

if (privacyChangePasswordBtn) {
    privacyChangePasswordBtn.addEventListener('click', () => {
        if (!privacyPasswordPanel) return;
        const isHidden = privacyPasswordPanel.style.display === 'none' || !privacyPasswordPanel.style.display;
        if (privacyEmailPanel) privacyEmailPanel.style.display = 'none';
        if (privacyPinPanel) privacyPinPanel.style.display = 'none';
        privacyPasswordPanel.style.display = isHidden ? 'block' : 'none';
        if (isHidden && privacyOldPasswordInput) {
            privacyOldPasswordInput.focus();
        }
    });
}

if (privacyChangeEmailBtn) {
    privacyChangeEmailBtn.addEventListener('click', () => {
        if (!privacyEmailPanel) return;
        const isHidden = privacyEmailPanel.style.display === 'none' || !privacyEmailPanel.style.display;
        if (privacyPasswordPanel) privacyPasswordPanel.style.display = 'none';
        if (privacyPinPanel) privacyPinPanel.style.display = 'none';
        privacyEmailPanel.style.display = isHidden ? 'block' : 'none';
        if (isHidden && privacyNewEmailInput) {
            privacyNewEmailInput.value = currentUserEmail || '';
            privacyNewEmailInput.focus();
        }
    });
}

if (privacyChangePinBtn) {
    privacyChangePinBtn.addEventListener('click', () => {
        if (!privacyPinPanel) return;
        const isHidden = privacyPinPanel.style.display === 'none' || !privacyPinPanel.style.display;
        if (privacyPasswordPanel) privacyPasswordPanel.style.display = 'none';
        if (privacyEmailPanel) privacyEmailPanel.style.display = 'none';
        privacyPinPanel.style.display = isHidden ? 'block' : 'none';
        if (isHidden && privacyLoginPinInput) privacyLoginPinInput.focus();
    });
}

if (privacyPasswordForm) {
    privacyPasswordForm.addEventListener('submit', async (event) => {
        event.preventDefault();
        await changePasswordInPrivacy(privacyOldPasswordInput?.value || '', privacyNewPasswordInput?.value || '');
    });
}

if (privacyEmailForm) {
    privacyEmailForm.addEventListener('submit', async (event) => {
        event.preventDefault();
        await changeEmailInPrivacy(privacyNewEmailInput?.value || '');
    });
}

if (privacyPinForm) {
    privacyPinForm.addEventListener('submit', async (event) => {
        event.preventDefault();
        await saveLoginPinInPrivacy(privacyLoginPinInput?.value || '');
    });
}

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
                <button class="submenu-btn" data-tab="products" type="button">Товары</button>
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
