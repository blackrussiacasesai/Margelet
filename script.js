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

// При загрузке страницы проверяем, не был ли пользователь уже авторизован
window.addEventListener('DOMContentLoaded', () => {
    const stored = localStorage.getItem('currentUserEmail');
    if (stored) {
        currentUserEmail = stored;
        goToMainScreen();
    }
    
    // Скрываем поле ввода имени под аватаркой
    const usernameContainer = document.querySelector('.username-container');
    if (usernameContainer) {
        usernameContainer.style.display = 'none';
    }
    
    // Инициализируем навигацию
    initNavigation();
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

    if(screenId === 'screen-code') {
        setTimeout(() => document.querySelector('.code-input').focus(), 100);
    }
    if(screenId === 'screen-reset-code') {
        setTimeout(() => document.querySelector('.reset-code-input').focus(), 100);
    }
    
    // Обновляем активный пункт навигации
    updateActiveNavItem(screenId);
}

// Функция перехода на главный экран
function goToMainScreen() {
    if (currentUserEmail) {
        const emailDisplay = document.getElementById('display-email');
        if (emailDisplay) emailDisplay.textContent = currentUserEmail;
        
        const joinDateDisplay = document.getElementById('display-join-date');
        if (joinDateDisplay) {
            const today = new Date();
            const options = { year: 'numeric', month: 'long', day: 'numeric' };
            joinDateDisplay.textContent = today.toLocaleDateString('ru-RU', options);
        }
        
        const savedAvatar = localStorage.getItem('userAvatar');
        const avatarBtn = document.getElementById('avatar-btn');
        if (savedAvatar && avatarBtn) {
            avatarBtn.style.backgroundImage = `url(${savedAvatar})`;
            avatarBtn.style.backgroundSize = 'cover';
            avatarBtn.style.backgroundPosition = 'center';
            avatarBtn.style.backgroundColor = 'transparent';
        } else if (avatarBtn) {
            avatarBtn.style.backgroundImage = 'none';
            avatarBtn.style.backgroundColor = 'rgba(255,255,255,0.1)';
        }

        goToScreen('screen-main');
        
        // Обновляем профиль при переходе на главный экран
        setTimeout(() => {
            createUsernameDisplay();
            createAccountDetailsSection();
        }, 100);
    } else {
        goToScreen('screen-login');
    }
}

// Функция выхода
function logout() {
    currentUserEmail = null;
    localStorage.removeItem('currentUserEmail');
    document.documentElement.classList.remove('logged-in');
    
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
    
    goToScreen('screen-login');
}

// Поиск чатов
const chatSearch = document.getElementById('chat-search');
if (chatSearch) {
    chatSearch.addEventListener('input', () => {
        console.log('Поиск:', chatSearch.value);
    });
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
const editDisplayName = document.getElementById('edit-display-name'); // Имя под аватаркой
const editUsername = document.getElementById('edit-username'); // Username (логин)
const editPhone = document.getElementById('edit-phone');
const editBirthday = document.getElementById('edit-birthday');
const editStatus = document.getElementById('edit-status');

// Элементы для редактирования аватара
const editAvatarDisplay = document.getElementById('edit-avatar-display');
const editChangeAvatarBtn = document.getElementById('edit-change-avatar-btn');
const editCountryPicker = document.getElementById('edit-country-picker');
const editCurrentFlag = document.getElementById('edit-current-flag');
const editCurrentCode = document.getElementById('edit-current-code');

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
    const savedAvatar = localStorage.getItem('userAvatar');
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
    if (editUsername) localStorage.setItem('userName_' + currentUserEmail, editUsername.value);
    if (editPhone) localStorage.setItem('userPhone_' + currentUserEmail, editPhone.value);
    if (editBirthday) localStorage.setItem('userBirthday_' + currentUserEmail, editBirthday.value);
    if (editStatus) localStorage.setItem('userStatus_' + currentUserEmail, editStatus.value);
    
    // Сохраняем цвет свечения
    const selectedColor = document.querySelector('.glow-color-option.selected');
    if (selectedColor) {
        const color = selectedColor.getAttribute('data-color');
        localStorage.setItem('glowColor_' + currentUserEmail, color);
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
        
        const stored = localStorage.getItem('userAvatar');
        if (stored) {
            profileAvatarDisplay.style.backgroundImage = `url(${stored})`;
            profileAvatarDisplay.style.backgroundSize = 'cover';
            profileAvatarDisplay.style.backgroundPosition = 'center';
            profileAvatarDisplay.style.backgroundColor = 'transparent';
        } else {
            profileAvatarDisplay.style.backgroundImage = 'none';
            profileAvatarDisplay.style.backgroundColor = 'rgba(255,255,255,0.1)';
        }
        
        // Создаем отображение имени
        createUsernameDisplay();
        
        // Создаем секцию с деталями
        createAccountDetailsSection();
        
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

// Обработчик кнопки выхода
if (logoutBtnProfile) {
    logoutBtnProfile.addEventListener('click', () => {
        logout();
    });
}

// Обработчик кнопки "Сервисы"
if (servicesBtn) {
    servicesBtn.addEventListener('click', () => {
        alert('Сервисы в разработке');
    });
}

// Смена аватарки
if (changeAvatarBtn && avatarUpload) {
    changeAvatarBtn.addEventListener('click', () => {
        avatarUpload.click();
    });
    
    avatarUpload.addEventListener('change', (e) => {
        const file = e.target.files[0];
        if (file) {
            const reader = new FileReader();
            reader.onload = (event) => {
                localStorage.setItem('userAvatar', event.target.result);
                
                avatarBtn.style.backgroundImage = `url(${event.target.result})`;
                avatarBtn.style.backgroundSize = 'cover';
                avatarBtn.style.backgroundPosition = 'center';
                avatarBtn.style.backgroundColor = 'transparent';
                
                profileAvatarDisplay.style.backgroundImage = `url(${event.target.result})`;
                profileAvatarDisplay.style.backgroundSize = 'cover';
                profileAvatarDisplay.style.backgroundPosition = 'center';
                profileAvatarDisplay.style.backgroundColor = 'transparent';
                
                if (editAvatarDisplay) {
                    editAvatarDisplay.style.backgroundImage = `url(${event.target.result})`;
                    editAvatarDisplay.style.backgroundSize = 'cover';
                    editAvatarDisplay.style.backgroundPosition = 'center';
                    editAvatarDisplay.style.backgroundColor = 'transparent';
                }
            };
            reader.readAsDataURL(file);
        }
    });
}

// Обработка регистрации
document.getElementById('register-form').addEventListener('submit', function(e) {
    e.preventDefault(); 
    
    const inputs = e.target.querySelectorAll('input');
    const email = inputs[0].value;
    const password = inputs[1].value;
    
    let users = JSON.parse(localStorage.getItem('socialNetworkUsers')) || [];
    const userExists = users.some(u => u.email === email);

    if (userExists) {
        alert('Пользователь с такой почтой уже существует!');
    } else {
        users.push({ email: email, password: password });
        localStorage.setItem('socialNetworkUsers', JSON.stringify(users));
        
        currentUserEmail = email;
        goToScreen('screen-code');
    }
});

// Обработка входа
document.getElementById('login-form').addEventListener('submit', function(e) {
    e.preventDefault();
    
    const inputs = e.target.querySelectorAll('input');
    const email = inputs[0].value;
    const password = inputs[1].value;
    
    let users = JSON.parse(localStorage.getItem('socialNetworkUsers')) || [];
    const user = users.find(u => u.email === email && u.password === password);
    
    if (user) {
        currentUserEmail = user.email;
        localStorage.setItem('currentUserEmail', currentUserEmail);
        document.documentElement.classList.add('logged-in');
        goToMainScreen();
    } else {
        alert('Ошибка: Неверная почта или пароль');
    }
});

// Обработка телефона
document.getElementById('phone-form').addEventListener('submit', function(e) {
    e.preventDefault();
    
    const phoneInput = document.getElementById('phone-field');
    const phoneNumber = phoneInput.value;
    
    if (currentUserEmail) {
        localStorage.setItem('userPhone_' + currentUserEmail, phoneNumber);
    }
    
    localStorage.setItem('currentUserEmail', currentUserEmail);
    document.documentElement.classList.add('logged-in');
    goToMainScreen();
});

// Логика кода
const codeInputs = document.querySelectorAll('.code-input');

codeInputs.forEach((input, index) => {
    input.addEventListener('input', (e) => {
        e.target.value = e.target.value.replace(/[^0-9]/g, ''); 
        if (e.target.value !== '') {
            if (index < codeInputs.length - 1) codeInputs[index + 1].focus();
            checkCodeComplete();
        }
    });

    input.addEventListener('keydown', (e) => {
        if (e.key === 'Backspace' && e.target.value === '' && index > 0) {
            codeInputs[index - 1].focus();
            codeInputs[index - 1].value = '';
        }
    });

    input.addEventListener('paste', (e) => {
        e.preventDefault();
        const pastedData = e.clipboardData.getData('text').replace(/[^0-9]/g, '').slice(0, codeInputs.length);
        pastedData.split('').forEach((char, i) => {
            if (index + i < codeInputs.length) codeInputs[index + i].value = char;
        });
        const nextFocusIndex = Math.min(index + pastedData.length, codeInputs.length - 1);
        codeInputs[nextFocusIndex].focus();
        checkCodeComplete();
    });
});

function checkCodeComplete() {
    const isComplete = Array.from(codeInputs).every(input => input.value !== '');
    if (isComplete) {
        codeInputs.forEach(input => input.blur());
        setTimeout(() => {
            codeInputs.forEach(input => input.classList.add('success'));
            setTimeout(() => {
                codeInputs.forEach(input => {
                    input.classList.remove('success');
                    input.value = '';
                });
                goToScreen('screen-phone');
            }, 1000);
        }, 300);
    }
}

// База стран
const countries = [
    { name: "Россия", code: "+7", flag: "🇷🇺" },
    { name: "Украина", code: "+380", flag: "🇺🇦" },
    { name: "Беларусь", code: "+375", flag: "🇧🇾" },
    { name: "Казахстан", code: "+7", flag: "🇰🇿" },
    { name: "Узбекистан", code: "+998", flag: "🇺🇿" },
    { name: "США", code: "+1", flag: "🇺🇸" },
    { name: "Германия", code: "+49", flag: "🇩🇪" },
    { name: "Франция", code: "+33", flag: "🇫🇷" },
    { name: "Великобритания", code: "+44", flag: "🇬🇧" },
    { name: "Турция", code: "+90", flag: "🇹🇷" }
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

countryPickerTrigger.onclick = (e) => {
    e.stopPropagation();
    countryDropdown.classList.toggle('show');
    if (countryDropdown.classList.contains('show')) countrySearch.focus();
};

countrySearch.oninput = (e) => renderCountries(e.target.value);
document.addEventListener('click', () => countryDropdown.classList.remove('show'));
renderCountries();

// Сброс пароля
function startPasswordReset() {
    const loginEmailInput = document.getElementById('login-email');
    const resetEmailInput = document.getElementById('reset-email-input');
    
    if (loginEmailInput.value) {
        resetEmailInput.value = loginEmailInput.value;
    }
    goToScreen('screen-reset-email');
}

document.getElementById('reset-email-form').addEventListener('submit', function(e) {
    e.preventDefault();
    const email = document.getElementById('reset-email-input').value;
    let users = JSON.parse(localStorage.getItem('socialNetworkUsers')) || [];
    
    const userExists = users.some(u => u.email === email);
    
    if (!userExists) {
        alert('Аккаунт с такой почтой не найден!');
    } else {
        resetEmailTarget = email;
        goToScreen('screen-reset-code');
    }
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

document.getElementById('new-password-form').addEventListener('submit', function(e) {
    e.preventDefault();
    const newPassword = document.getElementById('new-password-input').value;
    let users = JSON.parse(localStorage.getItem('socialNetworkUsers')) || [];
    
    const userIndex = users.findIndex(u => u.email === resetEmailTarget);
    if(userIndex !== -1) {
        users[userIndex].password = newPassword;
        localStorage.setItem('socialNetworkUsers', JSON.stringify(users));
        
        currentUserEmail = resetEmailTarget;
        document.documentElement.classList.add('logged-in');
        goToMainScreen();
    }
});

// Мессенджер
document.getElementById('chat-form').addEventListener('submit', function(e) {
    e.preventDefault();
    const input = document.getElementById('chat-message-input');
    const messageText = input.value.trim();
    
    if (messageText) {
        addMessageToChat(messageText, 'outgoing');
        saveMessage(messageText, 'outgoing');
        input.value = '';
        
        setTimeout(() => {
            const reply = "Вы написали: " + messageText;
            addMessageToChat(reply, 'incoming');
            saveMessage(reply, 'incoming');
        }, 1000);
    }
});

function addMessageToChat(text, type) {
    const chatArea = document.getElementById('chat-area');
    const msgDiv = document.createElement('div');
    msgDiv.className = `message ${type}`;
    msgDiv.textContent = text;
    chatArea.appendChild(msgDiv);
    chatArea.scrollTop = chatArea.scrollHeight;
}

function saveMessage(text, type) {
    if (!currentUserEmail) return;
    const chatKey = 'chat_' + currentUserEmail;
    let history = JSON.parse(localStorage.getItem(chatKey)) || [];
    history.push({ text, type });
    localStorage.setItem(chatKey, JSON.stringify(history));
}

// НОВЫЕ ФУНКЦИИ ДЛЯ ПРОФИЛЯ

// Функция для создания текстового отображения имени пользователя
function createUsernameDisplay() {
    const avatarSection = document.querySelector('.avatar-section-glass');
    if (!avatarSection) return;
    
    // Удаляем существующий контейнер с именем, если есть
    const existingDisplay = document.querySelector('.profile-username-display');
    if (existingDisplay) existingDisplay.remove();
    
    // Создаем новый элемент для отображения имени
    const usernameDisplay = document.createElement('div');
    usernameDisplay.className = 'profile-username-display';
    
    // Получаем сохраненное имя пользователя (display name)
    const savedDisplayName = localStorage.getItem('userDisplayName_' + currentUserEmail);
    usernameDisplay.textContent = savedDisplayName || 'Пользователь';
    
    // Вставляем после аватарки
    const avatarWrapper = document.querySelector('.avatar-wrapper-glass');
    if (avatarWrapper) {
        avatarWrapper.insertAdjacentElement('afterend', usernameDisplay);
    }
}

// Функция для создания секции подробностей об аккаунте
function createAccountDetailsSection() {
    const profileContent = document.querySelector('.profile-content-glass');
    if (!profileContent) return;
    
    // Скрываем старую сетку информации
    const oldInfoGrid = document.querySelector('.info-grid-glass');
    if (oldInfoGrid) {
        oldInfoGrid.style.display = 'none';
    }
    
    // Удаляем существующую секцию, если есть
    const existingSection = document.querySelector('.account-details-section');
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
    const savedUsername = localStorage.getItem('userName_' + currentUserEmail) || 'Не указано';
    const savedPhone = localStorage.getItem('userPhone_' + currentUserEmail) || 'Не указан';
    
    // Элемент Username (логин)
    const usernameItem = createDetailItem('👤', 'Username', savedUsername, 'username');
    detailsSection.appendChild(usernameItem);
    
    // Элемент Email
    const emailItem = createDetailItem('📧', 'Email', currentUserEmail, 'email');
    detailsSection.appendChild(emailItem);
    
    // Элемент Телефон
    const phoneItem = createDetailItem('📱', 'Телефон', savedPhone, 'phone');
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
    const servicesSection = document.querySelector('.services-section');
    if (servicesSection) {
        profileContent.insertBefore(detailsSection, servicesSection);
    } else {
        profileContent.appendChild(detailsSection);
    }
}

// Функция создания элемента детали
function createDetailItem(icon, label, value, type) {
    const item = document.createElement('div');
    item.className = 'detail-item';
    item.setAttribute('data-copy-type', type);
    
    const iconDiv = document.createElement('div');
    iconDiv.className = 'detail-icon';
    iconDiv.textContent = icon;
    
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
            // Специальная обработка для разных типов
            if (type === 'birthday') {
                textToCopy = localStorage.getItem('userBirthday_' + currentUserEmail) || value;
            } else if (type === 'email') {
                textToCopy = currentUserEmail;
            } else if (type === 'username') {
                textToCopy = localStorage.getItem('userName_' + currentUserEmail) || value;
            } else if (type === 'phone') {
                textToCopy = localStorage.getItem('userPhone_' + currentUserEmail) || value;
            }
            
            copyToClipboard(textToCopy);
            
            // Визуальный эффект
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
    
    // Функция обновления активного пункта меню
    window.updateActiveNavItem = function(screenId) {
        navItems.forEach(item => {
            item.classList.remove('active');
            if (item.getAttribute('data-screen') === screenId) {
                item.classList.add('active');
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
                if (avatarBtn) {
                    const stored = localStorage.getItem('userAvatar');
                    if (stored) {
                        profileAvatarDisplay.style.backgroundImage = `url(${stored})`;
                        profileAvatarDisplay.style.backgroundSize = 'cover';
                        profileAvatarDisplay.style.backgroundPosition = 'center';
                        profileAvatarDisplay.style.backgroundColor = 'transparent';
                    }
                    createUsernameDisplay();
                    createAccountDetailsSection();
                    updateDisplayData();
                }
                goToScreen('screen-profile');
            } else if (screenId === 'screen-settings') {
                alert('Настройки будут доступны в следующем обновлении');
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

// Убедимся, что навигация инициализируется после загрузки
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initNavigation);
} else {
    initNavigation();
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
    
    // Убираем выделение со всех опций
    glowColorOptions.forEach(opt => opt.classList.remove('selected'));
    
    // Выделяем текущую опцию
    const selectedOption = document.querySelector(`.glow-color-option[data-color="${color}"]`);
    if (selectedOption) {
        selectedOption.classList.add('selected');
    }
    
    // Устанавливаем цвет свечения
    if (color === 'gradient') {
        avatarGlow.style.background = 'linear-gradient(135deg, #ff5e98, #8b41df, #30a1ff)';
    } else {
        avatarGlow.style.background = color;
    }
}

// Обработчики для выбора цвета
glowColorOptions.forEach(option => {
    option.addEventListener('click', function() {
        const color = this.getAttribute('data-color');
        setGlowColor(color);
        if (currentUserEmail) {
            localStorage.setItem('glowColor_' + currentUserEmail, color);
        }
    });
});

// Обработчик для смены аватарки в редакторе
if (editChangeAvatarBtn && avatarUpload) {
    editChangeAvatarBtn.addEventListener('click', () => {
        avatarUpload.click();
    });
}

// Обработчик для выбора страны в редакторе
if (editCountryPicker) {
    editCountryPicker.addEventListener('click', () => {
        // Здесь можно добавить выбор страны
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
