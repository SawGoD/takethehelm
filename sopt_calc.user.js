// ==UserScript==
// @name         Санкционные - Calc
// @namespace    http://tampermonkey.net/
// @version      2.9.5
// @description  Считает кол-во цифр в блоках с номерами ТД.
// @author       https://t.me/SawGoD
// @match        https://sa.transit.crcp.ru/orders/active*
// @match        https://sa.transit.crcp.ru/orders/archive*
// @icon         https://telegra.ph/file/99807e90eb71a7ca3ba43.jpg
// @homepageURL    https://github.com/SawGoD/takethehelm
// @updateURL      https://raw.githubusercontent.com/SawGoD/takethehelm/main/sopt_calc.user.js
// @downloadURL    https://raw.githubusercontent.com/SawGoD/takethehelm/main/sopt_calc.user.js
// ==/UserScript==

;(function () {
    // if (window.location.href.startsWith('https://sa.transit.crcp.ru/orders/a'))
    console.log('start')
    setInterval(() => {
        const divs = document.querySelectorAll('div[data-title="Номер таможенной декларации"], div[data-title="Номер ТД"]');

        divs.forEach((div) => {
            const existingParagraph = div.querySelector('p')
            existingParagraph?.remove()
            const digitCount = div.textContent?.trim().replace(/\D/g, '').length || 0
            const paragraph = document.createElement('p')
            paragraph.textContent = `Количество: ${digitCount}`
            div.appendChild(paragraph)
            div.setAttribute('style', `color: ${digitCount >= 21 ? 'green' : digitCount >= 8 ? 'orange' : 'red'}`)
        })
    }, 1000)
})()

document.addEventListener('keydown', function (event) {
    if (event.ctrlKey && (event.key === 'o' || event.key === 'щ')) {
        // Получаем текущий timestamp в миллисекундах
        event.preventDefault() // Отменяем действие по умолчанию
        const currentTimestamp = Date.now()
        const currentDate = new Date(currentTimestamp)

        // Обработка текущей даты до 00:00:00
        const processedDate = new Date(currentDate)
        processedDate.setHours(0, 0, 0, 0) // Устанавливаем время на 00:00:00
        const processedDateTimestamp = Math.floor(processedDate.getTime() / 1000) // Таймстамп обработанной даты в секундах

        // Создаем переменную для предыдущего дня с временем 09:30
        const previousDay = new Date(processedDate)
        previousDay.setDate(previousDay.getDate() - 1) // Уменьшаем на 1 день
        previousDay.setHours(9, 30, 0, 0) // Устанавливаем 9:30
        const previousDayTimestamp = Math.floor(previousDay.getTime() / 1000) // Таймстамп предыдущего дня в секундах

        // Создаем переменную для текущего дня с временем 09:30
        const currentDay = new Date(processedDate)
        currentDay.setHours(9, 30, 0, 0) // Устанавливаем 9:30
        const currentDayTimestamp = Math.floor(currentDay.getTime() / 1000) // Таймстамп текущего дня в секундах

        //get current url
        const currentUrl = window.location.href
        if (currentUrl.startsWith('https://sa.transit.crcp.ru/orders/active')) {
            window.location.href = `https://sa.transit.crcp.ru/orders/active/?active_transition_date=${previousDayTimestamp}&active_transition_date=${currentDayTimestamp}`
        } else if (currentUrl.startsWith('https://sa.transit.crcp.ru/orders/archive')) {
            window.location.href = `https://sa.transit.crcp.ru/orders/archive/?active_transition_date=${previousDayTimestamp}&active_transition_date=${currentDayTimestamp}`
        }
    }
})
