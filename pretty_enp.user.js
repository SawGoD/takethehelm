// ==UserScript==
// @name         Pretty ENP
// @namespace    http://tampermonkey.net/
// @version      0.9.3
// @description  Раздел ЭНП становится прекраснее
// @author       https://t.me/SawGoD
// @match        http://seal-admin.newprod.sopt/devices*
// @icon         https://www.google.com/s2/favicons?sz=64&domain=crcp.ru
// @homepageURL    https://github.com/SawGoD/takethehelm
// @updateURL      https://raw.githubusercontent.com/SawGoD/takethehelm/main/pretty_enp.user.js
// @downloadURL    https://raw.githubusercontent.com/SawGoD/takethehelm/main/pretty_enp.user.js
// ==/UserScript==

;(function () {
    'use strict'

    let visualEnabled = true // Глобальная переменная для отслеживания состояния визуала
    let autoRefreshEnabled = true // Автообновление включено по умолчанию
    let autoRefreshInterval = null // Хранит ID интервала автообновления
    let countdownInterval = null // Хранит ID интервала отсчета
    let timeLeft = 50 // Время до обновления в секундах

    const setColor = (el, color) => {
        if (el && visualEnabled) el.style.color = color
    }

    const replaceWithIcon = (el, isValid) => {
        if (!el) return
        if (visualEnabled) {
            el.innerHTML = isValid || el.innerHTML === '🟢' ? '🟢' : '🔴'
            el.style.fontSize = '1.5em'
            el.style.textAlign = 'center'
        }
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

    // Функция для открытия карты
    const openMap = (mapUrl) => {
        let existingMap = document.getElementById('coordinates-map')
        if (existingMap) {
            // Обновляем существующий iframe
            const iframe = existingMap.querySelector('iframe')
            if (iframe) {
                iframe.src = mapUrl
            }
            return
        }

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
            display: flex;
            align-items: center;
            justify-content: center;
            padding: 0;
        `

        closeBtn.addEventListener('click', () => {
            mapContainer.remove()
        })

        const iframe = document.createElement('iframe')
        iframe.src = mapUrl
        iframe.style.cssText = `
            width: 100%;
            height: 100%;
            border: none;
            border-radius: 8px;
        `

        mapContainer.appendChild(closeBtn)
        mapContainer.appendChild(iframe)

        const table = document.querySelector('.grid-table')
        if (table) {
            table.parentNode.insertBefore(mapContainer, table.nextSibling)
        }
    }

    const processTable = () => {
        const table = document.querySelector('.grid-table')
        if (!table) return

        if (!visualEnabled) return // Если визуал отключен, не обрабатываем таблицу

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
                    if (visualEnabled && txt === 'Под охраной') {
                        el.innerHTML = 'Охрана'
                    }
                    el.style.color = txt === 'Под охраной' || txt === 'Охрана' ? 'green' : txt === 'Сон' ? 'red' : ''
                }
            }
            // Координаты: обрабатываем объединенный столбец "Широта/Долгота"
            if (colIdx.latlon >= 0) {
                const coordCell = cells[colIdx.latlon]
                const latDiv = coordCell.querySelector('div[data-title="Широта"]')
                const lonDiv = coordCell.querySelector('div[data-title="Долгота"]')

                if (latDiv && lonDiv && visualEnabled) {
                    const latSpan = latDiv.querySelector('span')
                    const lonSpan = lonDiv.querySelector('span')

                    if (latSpan && lonSpan) {
                        const latText = latSpan.textContent.trim()
                        const lonText = lonSpan.textContent.trim()

                        const lat = parseFloat(latText.replace(',', '.'))
                        const lon = parseFloat(lonText.replace(',', '.'))

                        // Обрабатываем широту
                        if (!isNaN(lat) && lat !== 0) {
                            const latFormatted = lat.toFixed(5)
                            latSpan.textContent = latFormatted.endsWith('.00000') ? latFormatted.slice(0, -4) : latFormatted
                            latSpan.style.color = '#0066cc'
                            latSpan.style.cursor = 'pointer'

                            // Убираем отступы и делаем в одну строку
                            latDiv.style.display = 'inline'
                            latDiv.style.marginRight = '10px'

                            // Добавляем обработчик клика для широты
                            latSpan.onclick = () => {
                                if (!isNaN(lon) && lon !== 0) {
                                    const mapUrl = `https://www.google.com/maps/embed/v1/place?key=AIzaSyBFw0Qbyq9zTFTd-tUY6dZWTgaQzuU17R8&q=${lat},${lon}&zoom=15`
                                    openMap(mapUrl)
                                }
                            }
                        }

                        // Обрабатываем долготу
                        if (!isNaN(lon) && lon !== 0) {
                            const lonFormatted = lon.toFixed(5)
                            lonSpan.textContent = lonFormatted.endsWith('.00000') ? lonFormatted.slice(0, -4) : lonFormatted
                            lonSpan.style.color = '#0066cc'
                            lonSpan.style.cursor = 'pointer'

                            // Убираем отступы и делаем в одну строку
                            lonDiv.style.display = 'inline'

                            // Добавляем обработчик клика для долготы
                            lonSpan.onclick = () => {
                                if (!isNaN(lat) && lat !== 0) {
                                    const mapUrl = `https://www.google.com/maps/embed/v1/place?key=AIzaSyBFw0Qbyq9zTFTd-tUY6dZWTgaQzuU17R8&q=${lat},${lon}&zoom=15`
                                    openMap(mapUrl)
                                }
                            }
                        }
                    }
                }
            }
        })

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

        // Применяем стили к таблице при включенном визуале
        if (visualEnabled) {
            // Добавляем отступы для всех ячеек
            table.querySelectorAll('td, th').forEach((cell) => {
                cell.style.padding = '4px 12px'
            })

            // Увеличиваем отступ для столбца с координатами
            if (colIdx.latlon >= 0) {
                const coordCells = table.querySelectorAll(`td:nth-child(${colIdx.latlon + 1}), th:nth-child(${colIdx.latlon + 1})`)
                coordCells.forEach((cell) => {
                    cell.style.paddingRight = '75px' // Больше отступа справа от координат
                })
            }

            // Увеличиваем отступ для столбца с валидностью (слева)
            if (colIdx.valid >= 0) {
                const validCells = table.querySelectorAll(`td:nth-child(${colIdx.valid + 1}), th:nth-child(${colIdx.valid + 1})`)
                validCells.forEach((cell) => {
                    cell.style.paddingLeft = '20px' // Больше отступа слева от валидности
                })
            }
        }
    }

    // Функция для обновления отображения кнопки
    const updateRefreshButton = () => {
        const refreshBtn = document.getElementById('auto-refresh-btn')
        if (!refreshBtn) return

        if (autoRefreshEnabled) {
            refreshBtn.innerHTML = timeLeft
            refreshBtn.style.fontSize = '12px'
            refreshBtn.style.fontWeight = 'bold'
        } else {
            refreshBtn.innerHTML = `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
<path d="M4.06189 13C4.02104 12.6724 4 12.3387 4 12C4 7.58172 7.58172 4 12 4C14.5006 4 16.7332 5.14727 18.2002 6.94416M19.9381 11C19.979 11.3276 20 11.6613 20 12C20 16.4183 16.4183 20 12 20C9.61061 20 7.46589 18.9525 6 17.2916M9 17H6V17.2916M18.2002 4V6.94416M18.2002 6.94416V6.99993L15.2002 7M6 17.2916V20H9" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
</svg>`
            refreshBtn.style.fontSize = '14px'
            refreshBtn.style.fontWeight = 'normal'
        }
    }

    // Функция для автообновления страницы
    const setupAutoRefresh = () => {
        // Очищаем существующие интервалы
        if (autoRefreshInterval) {
            clearInterval(autoRefreshInterval)
            autoRefreshInterval = null
        }
        if (countdownInterval) {
            clearInterval(countdownInterval)
            countdownInterval = null
        }

        if (autoRefreshEnabled) {
            timeLeft = 50 // Сбрасываем счетчик

            // Интервал для обновления страницы
            autoRefreshInterval = setInterval(() => {
                window.location.reload()
            }, 50000) // 50000 мс = 50 секунд

            // Интервал для отсчета времени
            countdownInterval = setInterval(() => {
                timeLeft--
                updateRefreshButton()

                if (timeLeft <= 0) {
                    timeLeft = 50 // Сбрасываем для следующего цикла
                }
            }, 1000) // Обновляем каждую секунду

            updateRefreshButton()
        } else {
            updateRefreshButton()
        }
    }

    // Функция для создания всех кнопок управления
    const createControlButtons = () => {
        const table = document.querySelector('.grid-table')
        if (!table) return

        // Проверяем, что body существует
        if (!document.body) return

        const headers = Array.from(table.querySelectorAll('thead th')).map((th) => th.textContent.trim())
        const tempColIdx = headers.findIndex((h) => h.includes('Датчики температуры'))

        // Создаем кнопку переключения визуала
        if (!document.getElementById('toggle-visual-btn')) {
            const visualBtn = document.createElement('button')
            visualBtn.id = 'toggle-visual-btn'
            visualBtn.textContent = 'Отключить'
            visualBtn.style.cssText = `
                position: fixed;
                top: 20px;
                left: 20px;
                background: #dc3545;
                color: white;
                border: none;
                border-radius: 5px;
                padding: 10px 15px;
                cursor: pointer;
                z-index: 1000;
                font-size: 14px;
            `

            visualBtn.addEventListener('click', () => {
                visualEnabled = !visualEnabled
                visualBtn.textContent = visualEnabled ? 'Отключить' : 'Включить'
                visualBtn.style.background = visualEnabled ? '#dc3545' : '#28a745'

                // Перезапускаем обработку таблицы
                if (!visualEnabled) {
                    // Сбрасываем все стили
                    table.querySelectorAll('td span, td div, td i').forEach((el) => {
                        el.style.color = ''
                        if (el.tagName.toLowerCase() === 'span') {
                            if (el.innerHTML === '🟢' || el.innerHTML === '🔴') {
                                el.innerHTML = el.innerHTML === '🟢' ? 'Валидная' : 'Невалидная'
                                el.style.fontSize = ''
                                el.style.textAlign = ''
                            }
                            // Возвращаем оригинальный текст статуса
                            if (el.innerHTML === 'Охрана') {
                                el.innerHTML = 'Под охраной'
                            }
                        }
                    })

                    // Сбрасываем стили координат
                    table.querySelectorAll('td span').forEach((span) => {
                        span.style.cursor = ''
                        span.removeEventListener('click', () => {}) // Убираем обработчики
                    })

                    // Сбрасываем стили таблицы
                    table.querySelectorAll('td, th').forEach((el) => {
                        el.style.padding = ''
                        el.style.paddingLeft = ''
                        el.style.paddingRight = ''
                        el.style.minWidth = ''
                    })

                    // Показываем скрытые столбцы
                    const ths = table.querySelectorAll('thead th')
                    const rows = table.querySelectorAll('tbody tr')
                    const hideCols = [
                        headers.findIndex((h) => h.includes('Ускорение')),
                        headers.findIndex((h) => h.includes('Штырь извлечен')),
                        tempColIdx,
                    ].filter((idx) => idx >= 0)
                    hideCols.forEach((idx) => {
                        if (idx >= 0) {
                            if (ths[idx]) ths[idx].style.display = ''
                            rows.forEach((row) => {
                                const tds = row.querySelectorAll('td')
                                if (tds[idx]) tds[idx].style.display = ''
                            })
                        }
                    })

                    // Удаляем карту если она открыта
                    const mapContainer = document.getElementById('coordinates-map')
                    if (mapContainer) mapContainer.remove()

                    // Скрываем кнопку датчиков температуры
                    const tempBtn = document.getElementById('toggle-temp-btn')
                    if (tempBtn) tempBtn.style.display = 'none'

                    // Скрываем и отключаем кнопку автообновления
                    const refreshBtn = document.getElementById('auto-refresh-btn')
                    if (refreshBtn) {
                        refreshBtn.style.display = 'none'
                        // Отключаем автообновление
                        if (autoRefreshEnabled) {
                            autoRefreshEnabled = false
                            setupAutoRefresh() // Это очистит интервалы
                        }
                    }
                } else {
                    // Показываем кнопку датчиков температуры
                    const tempBtn = document.getElementById('toggle-temp-btn')
                    if (tempBtn) tempBtn.style.display = ''

                    // Показываем и включаем кнопку автообновления
                    const refreshBtn = document.getElementById('auto-refresh-btn')
                    if (refreshBtn) {
                        refreshBtn.style.display = ''
                        // Включаем автообновление обратно
                        if (!autoRefreshEnabled) {
                            autoRefreshEnabled = true
                            refreshBtn.style.background = '#dc3545'
                            refreshBtn.title = 'Отключить автообновление (50с)'
                            setupAutoRefresh()
                        }
                    }

                    processTable() // Применяем визуал заново
                }
            })

            document.body.appendChild(visualBtn)
        }

        // Создаем кнопку автообновления
        if (!document.getElementById('auto-refresh-btn')) {
            const refreshBtn = document.createElement('button')
            refreshBtn.id = 'auto-refresh-btn'
            refreshBtn.title = autoRefreshEnabled ? 'Отключить автообновление (50с)' : 'Включить автообновление (50с)'
            refreshBtn.style.cssText = `
                position: fixed;
                top: 20px;
                left: 150px;
                background: ${autoRefreshEnabled ? '#dc3545' : '#28a745'};
                color: white;
                border: none;
                border-radius: 5px;
                padding: 10px 15px;
                cursor: pointer;
                z-index: 1000;
                font-size: 14px;
                display: flex;
                align-items: center;
                justify-content: center;
                min-width: 50px;
            `

            refreshBtn.addEventListener('click', () => {
                autoRefreshEnabled = !autoRefreshEnabled
                refreshBtn.style.background = autoRefreshEnabled ? '#dc3545' : '#28a745'
                refreshBtn.title = autoRefreshEnabled ? 'Отключить автообновление (50с)' : 'Включить автообновление (50с)'
                setupAutoRefresh()
            })

            document.body.appendChild(refreshBtn)

            // Запускаем автообновление сразу, если оно включено
            if (autoRefreshEnabled) {
                setupAutoRefresh()
            } else {
                updateRefreshButton()
            }
        }

        // Создаем кнопку датчиков температуры
        if (tempColIdx >= 0 && !document.getElementById('toggle-temp-btn')) {
            const toggleBtn = document.createElement('button')
            toggleBtn.id = 'toggle-temp-btn'
            toggleBtn.textContent = 'Показать датчики температуры'
            toggleBtn.style.cssText = `
                position: fixed;
                top: 20px;
                left: 220px;
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
                const isVisible = ths[tempColIdx].style.display !== 'none'

                if (isVisible) {
                    // Скрываем
                    ths[tempColIdx].style.display = 'none'
                    rows.forEach((row) => {
                        const tds = row.querySelectorAll('td')
                        if (tds[tempColIdx]) tds[tempColIdx].style.display = 'none'
                    })
                    toggleBtn.textContent = 'Показать датчики температуры'
                    toggleBtn.dataset.tempVisible = 'false'
                } else {
                    // Показываем
                    ths[tempColIdx].style.display = ''
                    rows.forEach((row) => {
                        const tds = row.querySelectorAll('td')
                        if (tds[tempColIdx]) tds[tempColIdx].style.display = ''
                    })
                    toggleBtn.textContent = 'Скрыть датчики температуры'
                    toggleBtn.dataset.tempVisible = 'true'
                }
            })

            document.body.appendChild(toggleBtn)
        }
    }

    // Функция для надежной инициализации
    const initializeScript = () => {
        // Проверяем готовность страницы
        if (!document.body || !document.querySelector('.grid-table')) {
            return false
        }

        createControlButtons()
        processTable()
        makeSerialNumberClickable()
        return true
    }

    // Множественные попытки инициализации для надежности
    document.addEventListener('DOMContentLoaded', initializeScript)

    // Дополнительные попытки с разными интервалами
    setTimeout(() => {
        if (!initializeScript()) {
            setTimeout(initializeScript, 200)
        }
    }, 100)

    setTimeout(() => {
        if (!initializeScript()) {
            setTimeout(initializeScript, 300)
        }
    }, 500)

    setTimeout(initializeScript, 1000)
    setTimeout(initializeScript, 2000)

    // MutationObserver для отслеживания изменений DOM
    const observer = new MutationObserver((mutations) => {
        let shouldInit = false
        mutations.forEach((mutation) => {
            if (mutation.type === 'childList' && mutation.addedNodes.length > 0) {
                // Проверяем, добавилась ли таблица или важные элементы
                mutation.addedNodes.forEach((node) => {
                    if (node.nodeType === 1 && (node.classList?.contains('grid-table') || node.querySelector?.('.grid-table'))) {
                        shouldInit = true
                    }
                })
            }
        })

        if (shouldInit) {
            setTimeout(initializeScript, 100)
        }
    })

    // Начинаем наблюдение
    if (document.body) {
        observer.observe(document.body, {
            childList: true,
            subtree: true,
        })
    } else {
        // Если body еще нет, ждем его появления
        const bodyObserver = new MutationObserver(() => {
            if (document.body) {
                bodyObserver.disconnect()
                observer.observe(document.body, {
                    childList: true,
                    subtree: true,
                })
                initializeScript()
            }
        })
        bodyObserver.observe(document.documentElement, {
            childList: true,
        })
    }

    // Возвращаем интервал вместо MutationObserver
    const intervalId = setInterval(() => {
        processTable()
        // Проверяем и пересоздаем кнопки если они пропали
        if (
            !document.getElementById('toggle-visual-btn') ||
            !document.getElementById('auto-refresh-btn') ||
            !document.getElementById('toggle-temp-btn')
        ) {
            createControlButtons()
        }
    }, 200)
})()
