// ==UserScript==
// @name         Pretty ENP
// @namespace    http://tampermonkey.net/
// @version      2.5.2
// @description  Раскрашивает таблицу ЭНП по условиям,
// @author       https://t.me/SawGoD
// @match        http://seal-admin.newprod.sopt/devices/item/*/telemetry*
// @icon         https://www.google.com/s2/favicons?sz=64&domain=crcp.ru
// @homepageURL    https://github.com/SawGoD/takethehelm
// @updateURL      https://raw.githubusercontent.com/SawGoD/takethehelm/main/pretty_enp.user.js
// @downloadURL    https://raw.githubusercontent.com/SawGoD/takethehelm/main/pretty_enp.user.js
// ==/UserScript==

;(function () {
    'use strict'

    const setColor = (el, color) => {
        if (el) el.style.color = color
    }

    const replaceWithIcon = (el, isValid) => {
        if (!el) return
        el.innerHTML = isValid || el.innerHTML === '🟢' ? '🟢' : '🔴'
        el.style.fontSize = '1.5em'
        el.style.textAlign = 'center'
    }

    const formatDate = (date) => {
        return date.toISOString().split('T')[0]
    }

    const makeSerialNumberClickable = () => {
        const subtitle = document.querySelector('.page-h1__subtitle')
        if (!subtitle) return

        const text = subtitle.textContent
        const snMatch = text.match(/Серийный номер: (\d+)/)
        if (!snMatch) return

        const serialNumber = snMatch[1]
        const cleanInput = serialNumber

        const now = new Date()
        const startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)
        const endDate = new Date(now.getTime() + 24 * 60 * 60 * 1000)

        const url = `http://oper.crcp.ru/vyg21.php?sn=${cleanInput}&sdt=1&d1=${formatDate(startDate)}&d2=${formatDate(endDate)}`

        // Сохраняем оригинальную структуру с переносами строк
        const originalHTML = subtitle.innerHTML
        const newHTML = originalHTML.replace(
            /(Серийный номер: )(\d+)/,
            `$1<a href="#" style="text-decoration: underline; color: #0066cc; cursor: pointer;">$2</a>`
        )

        subtitle.innerHTML = newHTML

        // Добавляем обработчик клика
        const link = subtitle.querySelector('a')
        if (link) {
            link.addEventListener('click', (e) => {
                e.preventDefault()
                window.open(url, '_blank')
            })
        }
    }

    const processTable = () => {
        const table = document.querySelector('.grid-table')
        if (!table) return
        const headers = Array.from(table.querySelectorAll('thead th')).map((th) => th.textContent.trim())
        const colIdx = {
            valid: headers.findIndex((h) => h.includes('Валидность')),
            alarm: headers.findIndex((h) => h.includes('Тревога')),
            pinOut: headers.findIndex((h) => h.includes('Штырь извлечен')),
            pinHack: headers.findIndex((h) => h.includes('Штырь взломан')),
            pinSet: headers.findIndex((h) => h.includes('Штырь установлен')),
            caseOpen: headers.findIndex((h) => h.includes('Вскрытие корпуса')),
            lockFail: headers.findIndex((h) => h.includes('Неисправен замок')),
            caseHack: headers.findIndex((h) => h.includes('Попытка взлома корпуса')),
            lockStatus: headers.findIndex((h) => h.includes('Статус замка')),
            acceleration: headers.findIndex((h) => h.includes('Ускорение')),
            temperature: headers.findIndex((h) => h.includes('Датчики температуры')),
            signal: headers.findIndex((h) => h.includes('Качество сигнала')),
            satellites: headers.findIndex((h) => h.includes('Количество спутников')),
            battery: headers.findIndex((h) => h.includes('% заряда батареи')),
            status: headers.findIndex((h) => h.includes('Статус ЭНП')),
            lat: headers.findIndex((h) => h.includes('Широта')),
            lon: headers.findIndex((h) => h.includes('Долгота')),
            latlon: headers.findIndex((h) => h.includes('Широта/Долгота')),
        }
        // Скрываем столбцы "Ускорение", "Штырь извлечён" и "Датчики температуры"
        const hideCols = [colIdx.acceleration, colIdx.pinOut, colIdx.temperature].filter((idx) => idx >= 0)
        if (hideCols.length) {
            // Скрыть заголовки
            const ths = table.querySelectorAll('thead th')
            hideCols.forEach((idx) => {
                if (ths[idx]) ths[idx].style.display = 'none'
            })
            // Скрыть все ячейки этих столбцов
            table.querySelectorAll('tbody tr').forEach((row) => {
                const tds = row.querySelectorAll('td')
                hideCols.forEach((idx) => {
                    if (tds[idx]) tds[idx].style.display = 'none'
                })
            })
        }
        table.querySelectorAll('tbody tr').forEach((row) => {
            const cells = row.querySelectorAll('td')
            if (colIdx.valid >= 0) {
                const el = cells[colIdx.valid].querySelector('span')
                if (el) replaceWithIcon(el, el.textContent.includes('Валидная'))
            }
            ;[
                { idx: colIdx.alarm, yes: 'Да', no: 'Нет' },
                { idx: colIdx.pinHack, yes: 'Да', no: 'Нет' },
                { idx: colIdx.caseOpen, yes: 'Да', no: 'Нет' },
                { idx: colIdx.lockFail, yes: 'Да', no: 'Нет' },
                { idx: colIdx.caseHack, yes: 'Да', no: 'Нет' },
            ].forEach(({ idx, yes, no }) => {
                if (idx >= 0) {
                    const el = cells[idx].querySelector('span')
                    if (el) setColor(el, el.textContent.trim() === yes ? 'red' : 'green')
                }
            })
            if (colIdx.pinSet >= 0) {
                const el = cells[colIdx.pinSet].querySelector('span')
                if (el) setColor(el, el.textContent.trim() === 'Нет' ? 'red' : 'green')
            }
            if (colIdx.lockStatus >= 0) {
                const el = cells[colIdx.lockStatus].querySelector('i')
                if (el) {
                    if (el.classList.contains('el-icon-unlock')) {
                        setColor(el, 'red')
                    } else if (el.classList.contains('el-icon-lock')) {
                        setColor(el, 'green')
                    }
                }
            }
            // Качество сигнала и Количество спутников
            if (colIdx.signal >= 0) {
                const el = cells[colIdx.signal].querySelector('div')
                if (el) {
                    const val = parseInt(el.textContent.trim(), 10)
                    el.style.color = val === 0 ? 'red' : val > 0 ? 'green' : ''
                }
            }
            if (colIdx.satellites >= 0) {
                const el = cells[colIdx.satellites].querySelector('div')
                if (el) {
                    const val = parseInt(el.textContent.trim(), 10)
                    el.style.color = val === 0 ? 'red' : val > 0 ? 'green' : ''
                }
            }
            // Заряд батареи
            if (colIdx.battery >= 0) {
                const el = cells[colIdx.battery].querySelector('div')
                if (el) {
                    const val = parseInt(el.textContent.trim(), 10)
                    el.style.color = val < 25 ? 'red' : val < 50 ? 'orange' : val <= 100 ? 'green' : ''
                }
            }
            // Статус ЭНП
            if (colIdx.status >= 0) {
                const el = cells[colIdx.status].querySelector('span')
                if (el) {
                    const txt = el.textContent.trim()
                    if (txt === 'Под охраной') el.textContent = 'Охрана'
                    el.style.color = txt === 'Под охраной' || txt === 'Охрана' ? 'green' : txt === 'Сон' ? 'red' : ''
                }
            }
            // Координаты: широта и долгота — 6 знаков после точки (две строки в одной ячейке)
            if (colIdx.latlon >= 0) {
                // В каждой строке ищем div с data-title="Широта" и "Долгота"
                const latDiv = cells[colIdx.latlon].querySelector('div[data-title="Широта"] span')
                if (latDiv) {
                    const num = parseFloat(latDiv.textContent.replace(',', '.'))
                    if (!isNaN(num)) {
                        const formatted = num === 0 ? '0' : num.toFixed(5)
                        latDiv.textContent = formatted.endsWith('.00000') ? formatted.slice(0, -4) : formatted
                    }
                }
                const lonDiv = cells[colIdx.latlon].querySelector('div[data-title="Долгота"] span')
                if (lonDiv) {
                    const num = parseFloat(lonDiv.textContent.replace(',', '.'))
                    if (!isNaN(num)) {
                        const formatted = num === 0 ? '0' : num.toFixed(5)
                        lonDiv.textContent = formatted.endsWith('.00000') ? formatted.slice(0, -4) : formatted
                    }
                }

                // Создаем ссылку на Яндекс.Карты
                const latSpan = cells[colIdx.latlon].querySelector('div[data-title="Широта"] span')
                const lonSpan = cells[colIdx.latlon].querySelector('div[data-title="Долгота"] span')

                if (latSpan && lonSpan) {
                    const lat = parseFloat(latSpan.textContent.replace(',', '.'))
                    const lon = parseFloat(lonSpan.textContent.replace(',', '.'))

                    if (!isNaN(lat) && !isNaN(lon) && lat !== 0 && lon !== 0) {
                        const mapUrl = `https://www.google.com/maps/embed/v1/place?key=AIzaSyBFw0Qbyq9zTFTd-tUY6dZWTgaQzuU17R8&q=${lat},${lon}&zoom=15`

                        // Создаем ссылку для широты
                        const latLink = document.createElement('a')
                        latLink.href = '#'
                        latLink.style.textDecoration = 'underline'
                        latLink.style.color = '#0066cc'
                        latLink.textContent = latSpan.textContent

                        // Создаем ссылку для долготы
                        const lonLink = document.createElement('a')
                        lonLink.href = '#'
                        lonLink.style.textDecoration = 'underline'
                        lonLink.style.color = '#0066cc'
                        lonLink.textContent = lonSpan.textContent

                        // Добавляем обработчики клика для открытия в модальном окне
                        const openInModal = (e) => {
                            e.preventDefault()

                            // Проверяем, есть ли уже карта под таблицей
                            let existingMap = document.getElementById('coordinates-map')
                            if (existingMap) {
                                // Если карта уже есть, обновляем iframe с новыми координатами
                                const iframe = existingMap.querySelector('iframe')
                                if (iframe) {
                                    iframe.src = mapUrl
                                }
                                return
                            }

                            // Создаем контейнер для карты под таблицей
                            const mapContainer = document.createElement('div')
                            mapContainer.id = 'coordinates-map'
                            mapContainer.style.cssText = `
                                width: 100%;
                                height: 400px;
                                margin-top: 20px;
                                border: 2px solid #ddd;
                                border-radius: 8px;
                                position: relative;
                                background: white;
                            `

                            // Создаем кнопку закрытия
                            const closeBtn = document.createElement('button')
                            closeBtn.textContent = '✕'
                            closeBtn.style.cssText = `
                                position: absolute;
                                top: 10px;
                                right: 10px;
                                background: #ff4444;
                                color: white;
                                border: none;
                                border-radius: 50%;
                                width: 30px;
                                height: 30px;
                                cursor: pointer;
                                font-size: 16px;
                                z-index: 10001;
                            `

                            // Создаем iframe
                            const iframe = document.createElement('iframe')
                            iframe.src = mapUrl
                            iframe.style.cssText = `
                                width: 100%;
                                height: 100%;
                                border: none;
                                border-radius: 8px;
                            `

                            // Собираем контейнер карты
                            mapContainer.appendChild(closeBtn)
                            mapContainer.appendChild(iframe)

                            // Вставляем карту после таблицы
                            const table = document.querySelector('.grid-table')
                            if (table) {
                                table.parentNode.insertBefore(mapContainer, table.nextSibling)
                            }

                            // Обработчик закрытия
                            const closeMap = () => {
                                const mapToClose = document.getElementById('coordinates-map')
                                if (mapToClose) {
                                    mapToClose.remove()
                                }
                            }

                            closeBtn.addEventListener('click', closeMap)
                        }

                        latLink.addEventListener('click', openInModal)
                        lonLink.addEventListener('click', openInModal)

                        // Заменяем содержимое
                        latSpan.innerHTML = ''
                        latSpan.appendChild(latLink)

                        lonSpan.innerHTML = ''
                        lonSpan.appendChild(lonLink)
                    }
                }
            }
        })

        // Добавляем кнопку для показа/скрытия датчиков температуры
        if (colIdx.temperature >= 0 && !document.getElementById('toggle-temp-btn')) {
            const toggleBtn = document.createElement('button')
            toggleBtn.id = 'toggle-temp-btn'
            toggleBtn.textContent = 'Показать датчики температуры'
            toggleBtn.style.cssText = `
                position: fixed;
                top: 20px;
                left: 20px;
                background: #007bff;
                color: white;
                border: none;
                border-radius: 5px;
                padding: 10px 15px;
                cursor: pointer;
                z-index: 1000;
                font-size: 14px;
            `

            toggleBtn.addEventListener('click', () => {
                const ths = table.querySelectorAll('thead th')
                const rows = table.querySelectorAll('tbody tr')
                const isVisible = ths[colIdx.temperature].style.display !== 'none'

                if (isVisible) {
                    // Скрываем
                    ths[colIdx.temperature].style.display = 'none'
                    rows.forEach((row) => {
                        const tds = row.querySelectorAll('td')
                        if (tds[colIdx.temperature]) tds[colIdx.temperature].style.display = 'none'
                    })
                    toggleBtn.textContent = 'Показать датчики температуры'
                    toggleBtn.dataset.tempVisible = 'false'
                } else {
                    // Показываем
                    ths[colIdx.temperature].style.display = ''
                    rows.forEach((row) => {
                        const tds = row.querySelectorAll('td')
                        if (tds[colIdx.temperature]) tds[colIdx.temperature].style.display = ''
                    })
                    toggleBtn.textContent = 'Скрыть датчики температуры'
                    toggleBtn.dataset.tempVisible = 'true'
                }
            })

            document.body.appendChild(toggleBtn)
        }

        // Проверяем состояние кнопки и применяем его
        const toggleBtn = document.getElementById('toggle-temp-btn')
        if (toggleBtn && colIdx.temperature >= 0) {
            const isVisible = toggleBtn.dataset.tempVisible === 'true'
            const ths = table.querySelectorAll('thead th')
            const rows = table.querySelectorAll('tbody tr')

            if (isVisible) {
                ths[colIdx.temperature].style.display = ''
                rows.forEach((row) => {
                    const tds = row.querySelectorAll('td')
                    if (tds[colIdx.temperature]) tds[colIdx.temperature].style.display = ''
                })
            } else {
                ths[colIdx.temperature].style.display = 'none'
                rows.forEach((row) => {
                    const tds = row.querySelectorAll('td')
                    if (tds[colIdx.temperature]) tds[colIdx.temperature].style.display = 'none'
                })
            }
        }
    }

    document.addEventListener('DOMContentLoaded', processTable)
    setTimeout(processTable, 500)
    setTimeout(makeSerialNumberClickable, 700)

    // Возвращаем интервал вместо MutationObserver
    const intervalId = setInterval(processTable, 200)
})()
