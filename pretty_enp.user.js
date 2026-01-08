// ==UserScript==
// @name         Pretty ENP
// @namespace    http://tampermonkey.net/
// @version      2.0.4
// @description  Раздел с телеметрией ЭНП становится прекраснее
// @author       https://t.me/SawGoD
// @match        http://seal-admin.newprod.sopt/devices*
// @icon         https://www.google.com/s2/favicons?sz=64&domain=crcp.ru
// @homepageURL    https://github.com/SawGoD/takethehelm
// @updateURL      https://raw.githubusercontent.com/SawGoD/takethehelm/main/pretty_enp.user.js
// @downloadURL    https://raw.githubusercontent.com/SawGoD/takethehelm/main/pretty_enp.user.js
// ==/UserScript==

;(function () {
    'use strict'

    // ========================================
    // Утилиты и хелперы
    // ========================================

    const Utils = {
        parseDateTime(dateStr) {
            if (!dateStr) return null
            const match = dateStr.trim().match(/(\d{2})\.(\d{2})\.(\d{4})\s+(\d{2}):(\d{2}):(\d{2})/)
            if (!match) return null
            const [, day, month, year, hour, minute, second] = match
            return new Date(year, month - 1, day, hour, minute, second)
        },

        parseCommandDateTime(dateStr) {
            if (!dateStr || dateStr.trim() === '-') return null
            const match = dateStr.trim().match(/(\d{2})\.(\d{2})\.(\d{4}),\s+(\d{2}):(\d{2})/)
            if (!match) return null
            const [, day, month, year, hour, minute] = match
            return new Date(year, month - 1, day, hour, minute, 0)
        },

        getRowColorByTime(dateStr, isCommandFormat = false) {
            const recordDate = isCommandFormat ? this.parseCommandDateTime(dateStr) : this.parseDateTime(dateStr)
            if (!recordDate) return ''

            const now = new Date()
            const diffMinutes = (now - recordDate) / (1000 * 60)

            if (diffMinutes < 0) return ''
            if (diffMinutes <= 60) return 'rgba(144, 238, 144, 0.11)'
            if (diffMinutes <= 240) return 'rgba(255, 165, 0, 0.10)'
            return 'rgba(255, 99, 71, 0.08)'
        },

        getCommandStatusColor(statusText) {
            if (!statusText) return ''
            const text = statusText.toLowerCase()
            if (text.includes('выполнена')) return 'rgba(144, 238, 144, 0.4)'
            if (text.includes('ожидает') || text.includes('связ')) return 'rgba(255, 165, 0, 0.3)'
            if (text.includes('отменена')) return 'rgba(255, 99, 71, 0.3)'
            return ''
        },

        formatDate(date) {
            return date.toISOString().split('T')[0]
        },
    }

    // ========================================
    // Детектор типа таблицы
    // ========================================

    class TableDetector {
        detect(table) {
            if (!table) return 'unknown'

            const headers = Array.from(table.querySelectorAll('thead th')).map((th) => th.textContent.trim())

            // Определяем по наличию специфичных заголовков
            const hasTelemetryHeaders = headers.some((h) => h.includes('Дата и время приема сервером'))
            const hasCommandHeaders = headers.some((h) => h.includes('Время формирования') || h.includes('Время плановой отправки'))

            if (hasCommandHeaders) return 'commands'
            if (hasTelemetryHeaders) return 'telemetry'
            return 'unknown'
        }

        getHeaders(table) {
            return Array.from(table.querySelectorAll('thead th')).map((th) => th.textContent.trim())
        }

        getColumnIndexes(headers, type) {
            const baseIndexes = {
                acceleration: headers.findIndex((h) => h.includes('Ускорение')),
                pinOut: headers.findIndex((h) => h.includes('Штырь извлечен')),
            }

            if (type === 'telemetry') {
                return {
                    ...baseIndexes,
                    dateTime: headers.findIndex((h) => h.includes('Дата и время приема сервером')),
                    valid: headers.findIndex((h) => h.includes('Валидность')),
                    alarm: headers.findIndex((h) => h.includes('Тревога')),
                    pinHack: headers.findIndex((h) => h.includes('Штырь взломан')),
                    pinSet: headers.findIndex((h) => h.includes('Штырь установлен')),
                    caseOpen: headers.findIndex((h) => h.includes('Вскрытие корпуса')),
                    lockFail: headers.findIndex((h) => h.includes('Неисправен замок')),
                    caseHack: headers.findIndex((h) => h.includes('Попытка взлома корпуса')),
                    lockStatus: headers.findIndex((h) => h.includes('Статус замка')),
                    temperature: headers.findIndex((h) => h.includes('Датчики температуры')),
                    signal: headers.findIndex((h) => h.includes('Качество сигнала')),
                    satellites: headers.findIndex((h) => h.includes('Количество спутников')),
                    battery: headers.findIndex((h) => h.includes('% заряда батареи')),
                    status: headers.findIndex((h) => h.includes('Статус ЭНП')),
                    latlon: headers.findIndex((h) => h.includes('Широта/Долгота')),
                }
            } else if (type === 'commands') {
                return {
                    ...baseIndexes,
                    commandTime: headers.findIndex((h) => h.includes('Время фактической отправки')),
                    commandStatus: headers.findIndex((h) => h === 'Статус'),
                }
            }

            return baseIndexes
        }
    }

    // ========================================
    // Базовый процессор таблиц
    // ========================================

    class BaseTableProcessor {
        constructor(state) {
            this.state = state
        }

        setColor(el, color) {
            if (el && this.state.visualEnabled) el.style.color = color
        }

        replaceWithIcon(el, isValid) {
            if (!el || !this.state.visualEnabled) return
            el.innerHTML = isValid || el.innerHTML === '🟢' ? '🟢' : '🔴'
            el.style.fontSize = '1.5em'
            el.style.textAlign = 'center'
        }

        hideColumns(table, colIndexes) {
            const hideCols = [colIndexes.acceleration, colIndexes.pinOut].filter((idx) => idx >= 0)
            if (!hideCols.length) return

            const ths = table.querySelectorAll('thead th')
            hideCols.forEach((idx) => {
                if (ths[idx]) ths[idx].style.display = 'none'
            })

            table.querySelectorAll('tbody tr').forEach((row) => {
                const tds = row.querySelectorAll('td')
                hideCols.forEach((idx) => {
                    if (tds[idx]) tds[idx].style.display = 'none'
                })
            })
        }

        applyTableStyles(table, colIdx) {
            table.querySelectorAll('td, th').forEach((cell) => {
                cell.style.padding = '4px 12px'
            })

            if (colIdx.latlon >= 0) {
                const coordCells = table.querySelectorAll(`td:nth-child(${colIdx.latlon + 1}), th:nth-child(${colIdx.latlon + 1})`)
                coordCells.forEach((cell) => {
                    cell.style.paddingRight = '75px'
                })
            }

            if (colIdx.valid >= 0) {
                const validCells = table.querySelectorAll(`td:nth-child(${colIdx.valid + 1}), th:nth-child(${colIdx.valid + 1})`)
                validCells.forEach((cell) => {
                    cell.style.paddingLeft = '20px'
                })
            }
        }
    }

    // ========================================
    // Процессор телеметрии
    // ========================================

    class TelemetryProcessor extends BaseTableProcessor {
        process(table) {
            if (!this.state.visualEnabled) return

            const detector = new TableDetector()
            const headers = detector.getHeaders(table)
            const colIdx = detector.getColumnIndexes(headers, 'telemetry')

            this.hideColumns(table, colIdx)
            this.processRows(table, colIdx)
            this.applyTableStyles(table, colIdx)
        }

        processRows(table, colIdx) {
            table.querySelectorAll('tbody tr').forEach((row) => {
                const cells = row.querySelectorAll('td')

                // Подсветка строки по времени
                if (colIdx.dateTime >= 0) {
                    const dateCell = cells[colIdx.dateTime]?.querySelector('div')
                    if (dateCell) {
                        const dateStr = dateCell.textContent.trim()
                        const backgroundColor = Utils.getRowColorByTime(dateStr)
                        if (backgroundColor) {
                            row.style.backgroundColor = backgroundColor
                        }
                    }
                }

                this.processValidation(cells, colIdx)
                this.processAlarms(cells, colIdx)
                this.processLockStatus(cells, colIdx)
                this.processSignals(cells, colIdx)
                this.processBattery(cells, colIdx)
                this.processStatus(cells, colIdx)
                this.processTemperature(cells, colIdx)
                this.processCoordinates(cells, colIdx)
            })
        }

        processValidation(cells, colIdx) {
            if (colIdx.valid >= 0) {
                const el = cells[colIdx.valid].querySelector('span')
                if (el) this.replaceWithIcon(el, el.textContent.includes('Валидная'))
            }
        }

        processAlarms(cells, colIdx) {
            ;[
                { idx: colIdx.alarm, yes: 'Да', no: 'Нет' },
                { idx: colIdx.pinHack, yes: 'Да', no: 'Нет' },
                { idx: colIdx.caseOpen, yes: 'Да', no: 'Нет' },
                { idx: colIdx.lockFail, yes: 'Да', no: 'Нет' },
                { idx: colIdx.caseHack, yes: 'Да', no: 'Нет' },
            ].forEach(({ idx, yes, no }) => {
                if (idx >= 0) {
                    const el = cells[idx].querySelector('span')
                    if (el) this.setColor(el, el.textContent.trim() === yes ? 'red' : 'green')
                }
            })

            if (colIdx.pinSet >= 0) {
                const el = cells[colIdx.pinSet].querySelector('span')
                if (el) this.setColor(el, el.textContent.trim() === 'Нет' ? 'red' : 'green')
            }
        }

        processLockStatus(cells, colIdx) {
            if (colIdx.lockStatus >= 0) {
                const el = cells[colIdx.lockStatus].querySelector('i')
                if (el) {
                    if (el.classList.contains('el-icon-unlock')) {
                        this.setColor(el, 'red')
                    } else if (el.classList.contains('el-icon-lock')) {
                        this.setColor(el, 'green')
                    }
                }
            }
        }

        processSignals(cells, colIdx) {
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
        }

        processBattery(cells, colIdx) {
            if (colIdx.battery >= 0) {
                const el = cells[colIdx.battery].querySelector('div')
                if (el) {
                    const val = parseInt(el.textContent.trim(), 10)
                    el.style.color = val < 25 ? 'red' : val < 50 ? 'orange' : val <= 100 ? 'green' : ''
                }
            }
        }

        processStatus(cells, colIdx) {
            if (colIdx.status >= 0) {
                const el = cells[colIdx.status].querySelector('span')
                if (el) {
                    const txt = el.textContent.trim()
                    if (this.state.visualEnabled && txt === 'Под охраной') {
                        el.innerHTML = 'Охрана'
                    }
                    el.style.color = txt === 'Под охраной' || txt === 'Охрана' ? 'green' : txt === 'Сон' ? 'red' : ''
                }
            }
        }

        processTemperature(cells, colIdx) {
            if (colIdx.temperature < 0) return

            const tempCell = cells[colIdx.temperature]
            if (!tempCell) return

            const tempBtn = document.getElementById('toggle-temp-btn')
            const showAllSensors = tempBtn && tempBtn.dataset.tempVisible === 'true'
            const alreadyProcessed = tempCell.dataset.processed === 'true'

            if (!alreadyProcessed) {
                const innerSensorDiv = tempCell.querySelector('div[data-title="Внутренний датчик"]')
                if (innerSensorDiv) {
                    const tempValue = innerSensorDiv.textContent.match(/[-−]?\d+/)?.[0]
                    if (tempValue) {
                        if (!tempCell.dataset.originalContent) {
                            tempCell.dataset.originalContent = tempCell.innerHTML
                        }

                        if (!showAllSensors) {
                            const simplifiedDiv = document.createElement('div')
                            simplifiedDiv.className = 'el-tooltip bold simplified-temp'
                            simplifiedDiv.style.cssText = 'padding: 4px 8px;'
                            simplifiedDiv.textContent = `${tempValue}°`

                            tempCell.innerHTML = ''
                            tempCell.appendChild(simplifiedDiv)
                        }

                        tempCell.dataset.processed = 'true'
                    }
                }
            }
        }

        processCoordinates(cells, colIdx) {
            if (colIdx.latlon < 0) return

            const coordCell = cells[colIdx.latlon]
            const latDiv = coordCell.querySelector('div[data-title="Широта"]')
            const lonDiv = coordCell.querySelector('div[data-title="Долгота"]')

            if (!latDiv || !lonDiv || !this.state.visualEnabled) return

            const latSpan = latDiv.querySelector('span')
            const lonSpan = lonDiv.querySelector('span')

            if (!latSpan || !lonSpan) return

            const latText = latSpan.textContent.trim()
            const lonText = lonSpan.textContent.trim()

            const lat = parseFloat(latText.replace(',', '.'))
            const lon = parseFloat(lonText.replace(',', '.'))

            if (!isNaN(lat) && lat !== 0) {
                const latFormatted = lat.toFixed(5)
                latSpan.textContent = latFormatted.endsWith('.00000') ? latFormatted.slice(0, -4) : latFormatted
                latSpan.style.color = '#0066cc'
                latSpan.style.cursor = 'pointer'

                latDiv.style.display = 'inline'
                latDiv.style.marginRight = '10px'

                latSpan.onclick = () => {
                    if (!isNaN(lon) && lon !== 0) {
                        const mapUrl = `https://www.google.com/maps/embed/v1/place?key=AIzaSyBFw0Qbyq9zTFTd-tUY6dZWTgaQzuU17R8&q=${lat},${lon}&zoom=15`
                        this.openMap(mapUrl)
                    }
                }
            }

            if (!isNaN(lon) && lon !== 0) {
                const lonFormatted = lon.toFixed(5)
                lonSpan.textContent = lonFormatted.endsWith('.00000') ? lonFormatted.slice(0, -4) : lonFormatted
                lonSpan.style.color = '#0066cc'
                lonSpan.style.cursor = 'pointer'

                lonDiv.style.display = 'inline'

                lonSpan.onclick = () => {
                    if (!isNaN(lat) && lat !== 0) {
                        const mapUrl = `https://www.google.com/maps/embed/v1/place?key=AIzaSyBFw0Qbyq9zTFTd-tUY6dZWTgaQzuU17R8&q=${lat},${lon}&zoom=15`
                        this.openMap(mapUrl)
                    }
                }
            }
        }

        openMap(mapUrl) {
            let existingMap = document.getElementById('coordinates-map')
            if (existingMap) {
                const iframe = existingMap.querySelector('iframe')
                if (iframe) iframe.src = mapUrl
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

            closeBtn.addEventListener('click', () => mapContainer.remove())

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
    }

    // ========================================
    // Процессор команд
    // ========================================

    class CommandsProcessor extends BaseTableProcessor {
        process(table) {
            if (!this.state.visualEnabled) return

            this.simplifyHeaders(table)

            const detector = new TableDetector()
            const headers = detector.getHeaders(table)
            const colIdx = detector.getColumnIndexes(headers, 'commands')

            this.hideColumns(table, colIdx)
            this.processRows(table, colIdx)
            this.applyTableStyles(table, colIdx)
        }

        simplifyHeaders(table) {
            table.querySelectorAll('thead th').forEach((th) => {
                const text = th.textContent.trim()
                if (text === 'Время формирования команды') {
                    th.textContent = 'Время формирования'
                } else if (text === 'Время плановой отправки команды') {
                    th.textContent = 'Время плановой отправки'
                } else if (text === 'Время фактической отправки команды') {
                    th.textContent = 'Время фактической отправки'
                }
            })
        }

        processRows(table, colIdx) {
            table.querySelectorAll('tbody tr').forEach((row) => {
                const cells = row.querySelectorAll('td')

                // Подсветка строки по времени отправки
                if (colIdx.commandTime >= 0) {
                    const dateCell = cells[colIdx.commandTime]?.querySelector('div')
                    if (dateCell) {
                        const dateStr = dateCell.textContent.trim()
                        const backgroundColor = Utils.getRowColorByTime(dateStr, true)
                        if (backgroundColor) {
                            row.style.backgroundColor = backgroundColor
                        }
                    }
                }

                // Подсветка ячейки статуса
                if (colIdx.commandStatus >= 0) {
                    const statusCell = cells[colIdx.commandStatus]?.querySelector('div')
                    if (statusCell) {
                        const statusText = statusCell.textContent.trim()
                        const statusColor = Utils.getCommandStatusColor(statusText)
                        if (statusColor) {
                            statusCell.style.backgroundColor = statusColor
                            statusCell.style.borderRadius = '4px'
                            statusCell.style.padding = '4px 8px'
                        }
                    }
                }
            })
        }
    }

    // ========================================
    // Менеджер кнопок
    // ========================================

    class ButtonManager {
        constructor(state, autoRefreshManager) {
            this.state = state
            this.autoRefreshManager = autoRefreshManager
        }

        createButtons(tableType) {
            if (!document.body) return

            // Удаляем кнопки, которые не должны отображаться на текущей странице
            if (tableType !== 'telemetry' && tableType !== 'commands') {
                this.removeButton('auto-refresh-btn')
            }

            if (tableType !== 'telemetry') {
                this.removeButton('toggle-temp-btn')
            }

            this.createVisualButton()

            if (tableType === 'telemetry' || tableType === 'commands') {
                this.createAutoRefreshButton()
            }

            if (tableType === 'telemetry') {
                this.createTemperatureButton()
            }
        }

        removeButton(buttonId) {
            const button = document.getElementById(buttonId)
            if (button) {
                button.remove()
            }
        }

        createVisualButton() {
            if (document.getElementById('toggle-visual-btn')) return

            const visualBtn = document.createElement('button')
            visualBtn.id = 'toggle-visual-btn'
            visualBtn.textContent = this.state.visualEnabled ? 'Отключить' : 'Включить'
            visualBtn.style.cssText = `
                position: fixed;
                top: 20px;
                left: 20px;
                background: ${this.state.visualEnabled ? '#dc3545' : '#28a745'};
                color: white;
                border: none;
                border-radius: 5px;
                padding: 10px 15px;
                cursor: pointer;
                z-index: 1000;
                font-size: 14px;
            `

            visualBtn.addEventListener('click', () => {
                this.state.visualEnabled = !this.state.visualEnabled
                visualBtn.textContent = this.state.visualEnabled ? 'Отключить' : 'Включить'
                visualBtn.style.background = this.state.visualEnabled ? '#dc3545' : '#28a745'

                // Управление видимостью кнопки температуры
                const tempBtn = document.getElementById('toggle-temp-btn')
                if (tempBtn) {
                    tempBtn.style.display = this.state.visualEnabled ? 'flex' : 'none'
                }

                // Управление кнопкой автообновления
                const refreshBtn = document.getElementById('auto-refresh-btn')
                if (refreshBtn) {
                    if (!this.state.visualEnabled) {
                        // Останавливаем и скрываем при отключении визуала
                        this.autoRefreshManager.stop()
                        refreshBtn.style.display = 'none'
                    } else {
                        // Показываем и запускаем при включении визуала
                        refreshBtn.style.display = 'flex'
                        if (!this.autoRefreshManager.enabled) {
                            this.autoRefreshManager.start()
                        }
                    }
                }

                const currentTable = document.querySelector('.grid-table')
                if (!currentTable) return

                if (!this.state.visualEnabled) {
                    this.resetTableStyles(currentTable)
                } else {
                    // Перезапускаем обработку
                    window.prettyENP && window.prettyENP.processCurrentTable()
                }
            })

            document.body.appendChild(visualBtn)
        }

        createAutoRefreshButton() {
            if (document.getElementById('auto-refresh-btn')) return

            const refreshBtn = document.createElement('button')
            refreshBtn.id = 'auto-refresh-btn'
            refreshBtn.title = 'Отключить автообновление (50с)'
            refreshBtn.style.cssText = `
                position: fixed;
                top: 20px;
                left: 150px;
                background: #dc3545;
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
                this.autoRefreshManager.toggle()
            })

            document.body.appendChild(refreshBtn)
            this.autoRefreshManager.start()
        }

        createTemperatureButton() {
            const table = document.querySelector('.grid-table')
            if (!table) return

            const detector = new TableDetector()
            const headers = detector.getHeaders(table)
            const tempColIdx = headers.findIndex((h) => h.includes('Датчики температуры'))

            if (tempColIdx < 0 || document.getElementById('toggle-temp-btn')) return

            const toggleBtn = document.createElement('button')
            toggleBtn.id = 'toggle-temp-btn'
            toggleBtn.textContent = 'Показать все датчики температуры'
            toggleBtn.dataset.tempVisible = 'false'
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
                display: ${this.state.visualEnabled ? 'flex' : 'none'};
                align-items: center;
                justify-content: center;
            `

            toggleBtn.addEventListener('click', () => {
                const currentTable = document.querySelector('.grid-table')
                if (!currentTable) return

                const rows = currentTable.querySelectorAll('tbody tr')
                const showingSimplified = toggleBtn.dataset.tempVisible !== 'true'

                if (showingSimplified) {
                    rows.forEach((row) => {
                        const tds = row.querySelectorAll('td')
                        if (tds[tempColIdx]) {
                            const tempCell = tds[tempColIdx]
                            if (tempCell.dataset.originalContent) {
                                tempCell.innerHTML = tempCell.dataset.originalContent
                                tempCell.dataset.processed = 'false'
                            }
                        }
                    })
                    toggleBtn.textContent = 'Упростить датчики температуры'
                    toggleBtn.dataset.tempVisible = 'true'
                } else {
                    rows.forEach((row) => {
                        const tds = row.querySelectorAll('td')
                        if (tds[tempColIdx]) {
                            tds[tempColIdx].dataset.processed = 'false'
                        }
                    })
                    toggleBtn.textContent = 'Показать все датчики температуры'
                    toggleBtn.dataset.tempVisible = 'false'

                    if (this.state.visualEnabled) {
                        setTimeout(() => window.prettyENP && window.prettyENP.processCurrentTable(), 50)
                    }
                }
            })

            document.body.appendChild(toggleBtn)
        }

        resetTableStyles(table) {
            // Восстанавливаем температуру
            table.querySelectorAll('td[data-original-content]').forEach((cell) => {
                cell.innerHTML = cell.dataset.originalContent
                delete cell.dataset.originalContent
                delete cell.dataset.processed
            })

            // Сбрасываем фон строк
            table.querySelectorAll('tbody tr').forEach((row) => {
                row.style.backgroundColor = ''
            })

            // Сбрасываем стили ячеек
            table.querySelectorAll('td span, td div, td i').forEach((el) => {
                el.style.color = ''
                el.style.backgroundColor = ''
                el.style.borderRadius = ''
                el.style.padding = ''

                if (el.tagName.toLowerCase() === 'span') {
                    if (el.innerHTML === '🟢' || el.innerHTML === '🔴') {
                        el.innerHTML = el.innerHTML === '🟢' ? 'Валидная' : 'Невалидная'
                        el.style.fontSize = ''
                        el.style.textAlign = ''
                    }
                    if (el.innerHTML === 'Охрана') {
                        el.innerHTML = 'Под охраной'
                    }
                }
            })

            // Сбрасываем координаты
            table.querySelectorAll('td span').forEach((span) => {
                span.style.cursor = ''
                span.onclick = null
            })

            // Сбрасываем padding
            table.querySelectorAll('td, th').forEach((el) => {
                el.style.padding = ''
                el.style.paddingLeft = ''
                el.style.paddingRight = ''
                el.style.minWidth = ''
            })

            // Показываем скрытые столбцы
            const detector = new TableDetector()
            const headers = detector.getHeaders(table)
            const ths = table.querySelectorAll('thead th')
            const rows = table.querySelectorAll('tbody tr')
            const hideCols = [headers.findIndex((h) => h.includes('Ускорение')), headers.findIndex((h) => h.includes('Штырь извлечен'))].filter(
                (idx) => idx >= 0
            )

            hideCols.forEach((idx) => {
                if (ths[idx]) ths[idx].style.display = ''
                rows.forEach((row) => {
                    const tds = row.querySelectorAll('td')
                    if (tds[idx]) tds[idx].style.display = ''
                })
            })

            // Удаляем карту
            const mapContainer = document.getElementById('coordinates-map')
            if (mapContainer) mapContainer.remove()

            // Скрываем автообновление
            const refreshBtn = document.getElementById('auto-refresh-btn')
            if (refreshBtn) {
                refreshBtn.style.display = 'none'
                this.autoRefreshManager.stop()
            }
        }
    }

    // ========================================
    // Менеджер автообновления
    // ========================================

    class AutoRefreshManager {
        constructor(state) {
            this.state = state
            this.enabled = true
            this.paused = false
            this.interval = null
            this.timeLeft = 50
        }

        start() {
            this.stop()
            this.enabled = true
            this.timeLeft = 50

            this.interval = setInterval(() => {
                if (!this.paused) {
                    this.timeLeft--
                    if (this.timeLeft <= 0) {
                        window.location.reload()
                        return
                    }
                }
                this.updateButton()
            }, 1000)

            this.updateButton()
        }

        stop() {
            if (this.interval) {
                clearInterval(this.interval)
                this.interval = null
            }
            this.enabled = false
            this.updateButton()
        }

        toggle() {
            if (this.enabled) {
                this.stop()
            } else {
                this.start()
            }
        }

        pause() {
            this.paused = true
            this.updateButton()
        }

        resume() {
            this.paused = false
            this.updateButton()
        }

        updateButton() {
            const refreshBtn = document.getElementById('auto-refresh-btn')
            if (!refreshBtn) return

            if (this.paused) {
                refreshBtn.innerHTML = `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
<path d="M10 4H6V20H10V4Z" fill="currentColor"/>
<path d="M18 4H14V20H18V4Z" fill="currentColor"/>
</svg>`
                refreshBtn.style.background = '#ff9800'
                refreshBtn.title = 'Автообновление на паузе (активен ввод текста)'
            } else if (this.enabled) {
                refreshBtn.innerHTML = this.timeLeft
                refreshBtn.style.background = '#dc3545'
                refreshBtn.title = 'Отключить автообновление (50с)'
            } else {
                refreshBtn.innerHTML = `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
<path d="M4.06189 13C4.02104 12.6724 4 12.3387 4 12C4 7.58172 7.58172 4 12 4C14.5006 4 16.7332 5.14727 18.2002 6.94416M19.9381 11C19.979 11.3276 20 11.6613 20 12C20 16.4183 16.4183 20 12 20C9.61061 20 7.46589 18.9525 6 17.2916M9 17H6V17.2916M18.2002 4V6.94416M18.2002 6.94416V6.99993L15.2002 7M6 17.2916V20H9" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
</svg>`
                refreshBtn.style.background = '#28a745'
                refreshBtn.title = 'Включить автообновление (50с)'
            }
        }
    }

    // ========================================
    // Дополнительные функции
    // ========================================

    function makeSerialNumberClickable() {
        const subtitle = document.querySelector('.page-h1__subtitle')
        if (!subtitle) return

        const text = subtitle.textContent
        const snMatch = text.match(/Серийный номер: (\d+)/)
        if (!snMatch) return

        const serialNumber = snMatch[1]
        const now = new Date()
        const startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)
        const endDate = new Date(now.getTime() + 24 * 60 * 60 * 1000)

        const url = `http://oper.crcp.ru/vyg21.php?sn=${serialNumber}&sdt=1&d1=${Utils.formatDate(startDate)}&d2=${Utils.formatDate(endDate)}`

        const originalHTML = subtitle.innerHTML
        const newHTML = originalHTML.replace(
            /(Серийный номер: )(\d+)/,
            `$1<a href="#" style="text-decoration: underline; color: #0066cc; cursor: pointer;">$2</a>`
        )

        subtitle.innerHTML = newHTML

        const link = subtitle.querySelector('a')
        if (link) {
            link.addEventListener('click', (e) => {
                e.preventDefault()
                window.open(url, '_blank')
            })
        }
    }

    function setupInputMonitoring(autoRefreshManager) {
        document.addEventListener('focusin', (e) => {
            if (e.target.matches('input, textarea, select, [contenteditable="true"]')) {
                autoRefreshManager.pause()
            }
        })

        document.addEventListener('focusout', (e) => {
            if (e.target.matches('input, textarea, select, [contenteditable="true"]')) {
                autoRefreshManager.resume()
            }
        })
    }

    // ========================================
    // Главный контроллер
    // ========================================

    class PrettyENP {
        constructor() {
            this.state = { visualEnabled: true }
            this.detector = new TableDetector()
            this.autoRefreshManager = new AutoRefreshManager(this.state)
            this.buttonManager = new ButtonManager(this.state, this.autoRefreshManager)
            this.currentTableType = null

            this.telemetryProcessor = new TelemetryProcessor(this.state)
            this.commandsProcessor = new CommandsProcessor(this.state)

            this.init()
        }

        init() {
            setupInputMonitoring(this.autoRefreshManager)
            this.setupObserver()
            this.processCurrentTable()
        }

        setupObserver() {
            const observer = new MutationObserver((mutations) => {
                for (const mutation of mutations) {
                    if (mutation.type === 'childList' && mutation.addedNodes.length > 0) {
                        for (const node of mutation.addedNodes) {
                            if (node.nodeType === 1 && (node.classList?.contains('grid-table') || node.querySelector?.('.grid-table'))) {
                                setTimeout(() => this.processCurrentTable(), 100)
                                return
                            }
                        }
                    }
                }
            })

            if (document.body) {
                observer.observe(document.body, {
                    childList: true,
                    subtree: true,
                })
            } else {
                const waitForBody = () => {
                    if (document.body) {
                        observer.observe(document.body, {
                            childList: true,
                            subtree: true,
                        })
                        this.processCurrentTable()
                    } else {
                        setTimeout(waitForBody, 100)
                    }
                }
                waitForBody()
            }
        }

        processCurrentTable() {
            const table = document.querySelector('.grid-table')
            if (!table || !this.state.visualEnabled) return

            const tableType = this.detector.detect(table)

            // Создаем кнопки если тип изменился или кнопок нет
            if (tableType !== this.currentTableType || !document.getElementById('toggle-visual-btn')) {
                this.currentTableType = tableType
                this.buttonManager.createButtons(tableType)
            }

            // Обрабатываем таблицу
            if (tableType === 'telemetry') {
                this.telemetryProcessor.process(table)
            } else if (tableType === 'commands') {
                this.commandsProcessor.process(table)
            }

            // Обрабатываем серийный номер
            makeSerialNumberClickable()
        }
    }

    // ========================================
    // Запуск
    // ========================================

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', () => {
            window.prettyENP = new PrettyENP()
        })
    } else {
        window.prettyENP = new PrettyENP()
    }
})()
