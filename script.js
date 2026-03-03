// Функция переключения экранов
function goToScreen(screenId) {
    document.querySelectorAll('.screen').forEach(screen => {
        screen.classList.remove('active');
    });
    document.getElementById(screenId).classList.add('active');
    
    // Если перешли на экран кода, автоматически ставим курсор в первую ячейку
    if(screenId === 'screen-code') {
        setTimeout(() => {
            document.querySelector('.code-input').focus();
        }, 100);
    }
}

// Обработка регистрации (Сохранение данных)
document.getElementById('register-form').addEventListener('submit', function(e) {
    e.preventDefault(); 
    
    const inputs = e.target.querySelectorAll('input');
    const email = inputs[0].value;
    const password = inputs[1].value;

    // Получаем текущую базу пользователей или создаем новую
    let users = JSON.parse(localStorage.getItem('socialNetworkUsers')) || [];

    // Проверяем, есть ли такой пользователь
    const userExists = users.some(u => u.email === email);

    if (userExists) {
        alert('Пользователь с такой почтой уже существует!');
    } else {
        // Сохраняем нового пользователя
        users.push({ email: email, password: password });
        localStorage.setItem('socialNetworkUsers', JSON.stringify(users));
        
        // Переходим к следующему шагу (как было в оригинале)
        goToScreen('screen-code');
    }
});

// Обработка входа (Проверка данных)
document.getElementById('login-form').addEventListener('submit', function(e) {
    e.preventDefault();
    
    const inputs = e.target.querySelectorAll('input');
    const email = inputs[0].value;
    const password = inputs[1].value;

    // Получаем базу пользователей
    let users = JSON.parse(localStorage.getItem('socialNetworkUsers')) || [];
    
    // Ищем совпадение
    const user = users.find(u => u.email === email && u.password === password);

    if (user) {
        alert('Успешный вход! Добро пожаловать, ' + user.email);
        // Здесь можно добавить переход на главную страницу, когда она будет готова
    } else {
        alert('Ошибка: Неверная почта или пароль');
    }
});

document.getElementById('phone-form').addEventListener('submit', function(e) {
    e.preventDefault();
    alert('Номер успешно привязан! (Заглушка)');
});

// Логика ячеек для кода
const codeInputs = document.querySelectorAll('.code-input');

codeInputs.forEach((input, index) => {
    // Ввод цифр
    input.addEventListener('input', (e) => {
        e.target.value = e.target.value.replace(/[^0-9]/g, ''); // Только цифры
        
        if (e.target.value !== '') {
            if (index < codeInputs.length - 1) {
                codeInputs[index + 1].focus(); // Прыжок вперед
            }
            checkCodeComplete();
        }
    });

    // Обработка Backspace (Удаление и прыжок назад)
    input.addEventListener('keydown', (e) => {
        if (e.key === 'Backspace') {
            if (e.target.value === '' && index > 0) {
                codeInputs[index - 1].focus();
                codeInputs[index - 1].value = ''; // Сразу очищаем предыдущую ячейку
            }
        }
    });

    // Поддержка вставки кода целиком (Ctrl+V)
    input.addEventListener('paste', (e) => {
        e.preventDefault();
        const pastedData = e.clipboardData.getData('text').replace(/[^0-9]/g, '').slice(0, codeInputs.length);
        
        pastedData.split('').forEach((char, i) => {
            if (index + i < codeInputs.length) {
                codeInputs[index + i].value = char;
            }
        });
        
        const nextFocusIndex = Math.min(index + pastedData.length, codeInputs.length - 1);
        codeInputs[nextFocusIndex].focus();
        checkCodeComplete();
    });
});

// Проверка: все ли ячейки заполнены
function checkCodeComplete() {
    const isComplete = Array.from(codeInputs).every(input => input.value !== '');

    if (isComplete) {
        codeInputs.forEach(input => input.blur()); // Убираем фокус
        
        setTimeout(() => {
            // Анимация успеха
            codeInputs.forEach(input => input.classList.add('success'));
            
            setTimeout(() => {
                // Сброс и переход дальше
                codeInputs.forEach(input => {
                    input.classList.remove('success');
                    input.value = '';
                });
                goToScreen('screen-phone');
            }, 1000); // Висит зеленой 1 секунду
        }, 300);
    }
}
// База стран (можно расширять)
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

// Рендер списка стран
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

// Открытие/закрытие списка
countryPickerTrigger.onclick = (e) => {
    e.stopPropagation();
    countryDropdown.classList.toggle('show');
    if (countryDropdown.classList.contains('show')) {
        countrySearch.focus();
    }
};

// Поиск
countrySearch.oninput = (e) => {
    renderCountries(e.target.value);
};

// Закрытие при клике вне меню
document.addEventListener('click', () => {
    countryDropdown.classList.remove('show');
});

// Инициализация
renderCountries();
