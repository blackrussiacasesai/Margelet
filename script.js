// Функция переключения экранов
function goToScreen(screenId) {
    document.querySelectorAll('.screen').forEach(screen => screen.classList.remove('active'));
    const target = document.getElementById(screenId);
    if(target) {
        target.classList.add('active');
    }
    
    if(screenId === 'screen-code') {
        setTimeout(() => document.querySelector('.code-input').focus(), 100);
    }
}

// Вход в профиль
function enterApp(email) {
    const userEmail = email || localStorage.getItem('currentUser');
    document.getElementById('auth-container').style.display = 'none';
    document.getElementById('screen-app').classList.add('active');
    document.getElementById('display-user-email').textContent = userEmail || "Пользователь";
}

// Выход
function logout() {
    localStorage.removeItem('currentUser');
    document.getElementById('auth-container').style.display = 'block';
    document.getElementById('screen-app').classList.remove('active');
    goToScreen('screen-login');
}

// Регистрация
document.getElementById('register-form').addEventListener('submit', function(e) {
    e.preventDefault();
    const email = document.getElementById('reg-email').value;
    const password = document.getElementById('reg-password').value;
    
    let users = JSON.parse(localStorage.getItem('marglet_users')) || [];
    
    if (users.find(u => u.email === email)) {
        alert('Пользователь с такой почтой уже зарегистрирован!');
        return;
    }
    
    users.push({ email, password });
    localStorage.setItem('marglet_users', JSON.stringify(users));
    localStorage.setItem('currentUser', email);
    
    goToScreen('screen-code');
});

// Вход
document.getElementById('login-form').addEventListener('submit', function(e) {
    e.preventDefault();
    const email = document.getElementById('login-email').value;
    const password = document.getElementById('login-password').value;
    
    let users = JSON.parse(localStorage.getItem('marglet_users')) || [];
    const user = users.find(u => u.email === email && u.password === password);
    
    if (user) {
        localStorage.setItem('currentUser', email);
        enterApp(email);
    } else {
        alert('Ошибка: Неверная почта или пароль');
    }
});

// Логика "Забыли пароль"
function openForgotScreen() {
    const loginEmail = document.getElementById('login-email').value;
    document.getElementById('forgot-email').value = loginEmail;
    goToScreen('screen-forgot');
}

document.getElementById('forgot-form').addEventListener('submit', function(e) {
    e.preventDefault();
    const email = document.getElementById('forgot-email').value;
    let users = JSON.parse(localStorage.getItem('marglet_users')) || [];
    
    if (users.find(u => u.email === email)) {
        localStorage.setItem('currentUser', email);
        goToScreen('screen-code');
    } else {
        alert('На данную почту не зарегистрирован аккаунт');
    }
});

// Телефон
document.getElementById('phone-form').addEventListener('submit', (e) => {
    e.preventDefault();
    enterApp();
});

// ЛОГИКА КОДА (прыжки по ячейкам)
const codeInputs = document.querySelectorAll('.code-input');
codeInputs.forEach((input, index) => {
    input.addEventListener('input', (e) => {
        e.target.value = e.target.value.replace(/[^0-9]/g, '');
        if (e.target.value !== '' && index < codeInputs.length - 1) {
            codeInputs[index + 1].focus();
        }
        checkCode();
    });
    input.addEventListener('keydown', (e) => {
        if (e.key === 'Backspace' && e.target.value === '' && index > 0) {
            codeInputs[index - 1].focus();
        }
    });
});

function checkCode() {
    const code = Array.from(codeInputs).map(i => i.value).join('');
    if (code.length === 4) {
        codeInputs.forEach(i => i.classList.add('success'));
        setTimeout(() => {
            codeInputs.forEach(i => { i.classList.remove('success'); i.value = ''; });
            // Если мы из восстановления - идем в приложение, иначе на телефон
            const isForgot = document.getElementById('screen-forgot').classList.contains('active');
            isForgot ? enterApp() : goToScreen('screen-phone');
        }, 1000);
    }
}

// СПИСОК СТРАН
const countries = [
    { name: "Россия", code: "+7", flag: "🇷🇺" },
    { name: "Украина", code: "+380", flag: "🇺🇦" },
    { name: "Беларусь", code: "+375", flag: "🇧🇾" },
    { name: "Казахстан", code: "+7", flag: "🇰🇿" },
    { name: "Узбекистан", code: "+998", flag: "🇺🇿" },
    { name: "США", code: "+1", flag: "🇺🇸" }
];

const countryTrigger = document.getElementById('country-picker-trigger');
const countryDropdown = document.getElementById('country-dropdown');
const countryList = document.getElementById('country-list');
const countrySearch = document.getElementById('country-search');

function renderCountries(filter = '') {
    countryList.innerHTML = '';
    countries.filter(c => c.name.toLowerCase().includes(filter.toLowerCase())).forEach(c => {
        const li = document.createElement('li');
        li.className = 'country-item';
        li.innerHTML = `<span>${c.flag}</span> <span>${c.name}</span> <span style="margin-left:auto; opacity:0.5">${c.code}</span>`;
        li.onclick = () => {
            document.getElementById('current-flag').textContent = c.flag;
            document.getElementById('current-code').textContent = c.code;
            countryDropdown.classList.remove('show');
        };
        countryList.appendChild(li);
    });
}

countryTrigger.onclick = (e) => { e.stopPropagation(); countryDropdown.classList.toggle('show'); };
countrySearch.oninput = (e) => renderCountries(e.target.value);
document.addEventListener('click', () => countryDropdown.classList.remove('show'));
renderCountries();

// Проверка сессии при загрузке страницы
window.onload = () => {
    const savedUser = localStorage.getItem('currentUser');
    if (savedUser) {
        enterApp(savedUser);
    }
};
