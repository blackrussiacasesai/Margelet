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

    if(screenId === 'screen-code') {
        setTimeout(() => document.querySelector('.code-input').focus(), 100);
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
        
        // Рисуем круг с случайным цветом
        ctx.beginPath();
        ctx.arc(100, 100, 100, 0, 2 * Math.PI);
        ctx.fillStyle = randomColor;
        ctx.fill();
        
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
    currentUserEmail = null;
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
    
    // Обновляем имя в аватаре, если нет загруженного аватара
    const savedAvatar = localStorage.getItem('userAvatar_' + currentUserEmail);
    if (!savedAvatar) {
        loadUserAvatar(); // Перегенерируем аватар с новой первой буквой
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
    const email = inputs[0].value;
    const password = inputs[1].value;
    
    let users = JSON.parse(localStorage.getItem('socialNetworkUsers')) || [];
    const userExists = users.some(u => u.email === email);

    if (userExists) {
        alert('Пользователь с такой почтой уже существует!');
    } else {
        // Сохраняем данные для следующего шага
        currentRegistrationEmail = email;
        currentRegistrationPassword = password;
        
        // Переходим на экран ввода имени
        goToScreen('screen-name');
    }
});

// Обработка ввода имени
const nameForm = document.getElementById('name-form');
if (nameForm) {
    nameForm.addEventListener('submit', function(e) {
        e.preventDefault();
        const nameInput = document.getElementById('register-name');
        const name = nameInput.value.trim();
        
        if (name) {
            currentRegistrationName = name;
            goToScreen('screen-code');
        } else {
            alert('Введите имя пользователя');
        }
    });
}

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
        addAccountToLoggedList(currentUserEmail); // Добавляем в список аккаунтов
        goToMainScreen();
    } else {
        alert('Ошибка: Неверная почта или пароль');
    }
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
                
                // После подтверждения кода создаем пользователя
                if (currentRegistrationEmail && currentRegistrationPassword && currentRegistrationName) {
                    let users = JSON.parse(localStorage.getItem('socialNetworkUsers')) || [];
                    users.push({ 
                        email: currentRegistrationEmail, 
                        password: currentRegistrationPassword,
                        name: currentRegistrationName
                    });
                    localStorage.setItem('socialNetworkUsers', JSON.stringify(users));
                    
                    currentUserEmail = currentRegistrationEmail;
                    // !!! Важно: сохраняем в localStorage для перезагрузки страницы
                    localStorage.setItem('currentUserEmail', currentUserEmail);
                    
                    localStorage.setItem('userDisplayName_' + currentUserEmail, currentRegistrationName);
                    
                    // Добавляем в список аккаунтов
                    addAccountToLoggedList(currentUserEmail);
                    
                    // Генерируем аватар с первой буквой
                    setTimeout(() => {
                        loadUserAvatar();
                    }, 100);
                    
                    goToScreen('screen-phone');
                    
                    // Очищаем временные данные
                    currentRegistrationEmail = null;
                    currentRegistrationPassword = null;
                    currentRegistrationName = null;
                }
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

// Обновляем отображение чата - только надпись, без функционала
function updateChatArea() {
    const chatArea = document.getElementById('chat-area');
    if (chatArea) {
        chatArea.innerHTML = '<div class="no-chats-message">На данный момент у вас нет чатов</div>';
    }
    
    // Отключаем отправку сообщений
    const chatForm = document.getElementById('chat-form');
    if (chatForm) {
        chatForm.addEventListener('submit', function(e) {
            e.preventDefault();
            // Ничего не делаем
        });
    }
}

// Вызываем при загрузке
document.addEventListener('DOMContentLoaded', function() {
    updateChatArea();
});

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
    const savedUsername = localStorage.getItem('userName_' + currentUserEmail) || '';
    const displayUsername = savedUsername ? '@' + savedUsername : 'Не указано';
    const savedPhone = localStorage.getItem('userPhone_' + currentUserEmail) || 'Не указан';
    
    // Элемент Username (логин) с @
    const usernameItem = createDetailItem('👤', 'Username', displayUsername, 'username');
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
        navItems.forEach(item => {
            if (item.getAttribute('data-screen') === screenId) {
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
        }
        
        localStorage.setItem('currentUserEmail', currentUserEmail);
        document.documentElement.classList.add('logged-in');
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
    let accounts = getLoggedInAccounts();
    if (!accounts.some(acc => acc.email === email)) {
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
    let accounts = getLoggedInAccounts().filter(acc => acc.email !== email);
    saveLoggedInAccounts(accounts);
    // Если открыт экран настроек, обновить список
    if (document.getElementById('screen-settings').classList.contains('active')) {
        renderAccountsList();
    }
}

// Переключиться на другой аккаунт
function switchToAccount(email) {
    if (email === currentUserEmail) return;
    let users = JSON.parse(localStorage.getItem('socialNetworkUsers')) || [];
    let user = users.find(u => u.email === email);
    if (user) {
        currentUserEmail = null;
        localStorage.removeItem('currentUserEmail');
        currentUserEmail = user.email;
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
        const serviceId = card.getAttribute('data-service');

        if (serviceId === 'wmusic') {
            window.location.href = 'https://getadminbr.github.io/WMusic/';
            return;
        }

        alert('Сервис в разработке');
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
    setTimeout(fixNavigationPosition, 50); // Небольшая задержка
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
        }
    });

    // Скрыть по нажатию Escape
    searchInput.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
            searchInput.classList.remove('active');
        }
    });
}