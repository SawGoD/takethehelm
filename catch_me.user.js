// ==UserScript==
// @name         Catch Me - Генератор сообщений
// @namespace    http://tampermonkey.net/
// @version      2.1.0
// @description  Генерация сообщений о нарушениях для чата
// @author       SawGoD
// @match        https://sa.transit.crcp.ru/orders/item/*/view
// @icon         https://www.google.com/s2/favicons?sz=64&domain=crcp.ru
// @grant        GM_info
// ==/UserScript==

// ========================================
// CHANGELOG
// ========================================
//
// 2.1.0
//   refactor: анализ АКБ (штатно/аномально) переделан из чекбоксов в radio button
//   feat: поддержка showIfValue для зависимости полей от значения radio
//   feat: radio триггерит пересчёт видимости зависимых полей
//
// 2.0.0
//   feat: разделение категорий по типу регуляции ПП1877 / Д7
//   feat: автоопределение типа регуляции по номеру перевозки (ST/ → ПП1877, EV/ET/BY_ → Д7)
//   feat: категория Д7 АКБ — шаблон "Уровень заряда АКБ ниже 15%" с многострочным сообщением
//   feat: категория Д7 Срезание — шаблоны "Согласовано" и "Не согласовано" срезание
//   feat: автоподстановка данных со страницы (номер ТС, ГО, точки активации/деактивации, процедура перевозки)
//   feat: анализ АКБ через чекбоксы (штатно / аномально — взаимоисключающие) вместо textarea
//   feat: причины срезания через взаимоисключающие чекбоксы с заголовком секции
//   feat: поле "Процедура" как radio button с дефолтом по статусу перевозки
//   feat: тип поля label для заголовков секций в формах
//   feat: тип поля radio с поддержкой defaultByStatus
//   feat: кнопка очистки для полей с выпадающим списком (datalist)
//   feat: МАПП автоматически добавляется к названию точки активации/деактивации (если нет СВХ/ПОСТ)
//   feat: логика частоты: "не изменялась", "переведена на", "По решению ГТК РБ" для территории РБ
//   feat: температура в сообщении только при наличии цифр, с символом °
//   refactor: ViolationCategories → PP1877Categories, убран префикс "ПП1877" из названий шаблонов
//   refactor: инфо-блок Д7 показывает процедуру перевозки вместо типа, точки вместо пунктов
//   refactor: территория и расстояние на отдельных строках в сообщении
//   style: эффект shimmer-перелива на свёрнутой кнопке, убран hover-взлёт
//   style: единый стиль чекбоксов (accent-color, min-width)
//

;(function () {
    'use strict'

    // ========================================
    // КОНФИГУРАЦИЯ: Категории и шаблоны
    // ========================================
    //
    // Структура:
    // - Categories: категории нарушений (верхний уровень меню)
    // - Templates: шаблоны сообщений внутри категорий
    // - relatedTemplates: связанные шаблоны (ответные сообщения)
    //
    // Как добавить новую категорию:
    // 1. Добавить в PP1877Categories новый объект
    //
    // Как добавить новый шаблон:
    // 1. Добавить в templates нужной категории
    //
    // Как добавить связанное сообщение:
    // 1. Добавить в relatedTemplates шаблона
    // ========================================

    // Известные версии ПО
    const FIRMWARE_VERSIONS = [
        '0.051', '0.056', '0.058', '0.065',
        '0.094', '0.096', '0.097', '0.098', '0.099',
        '0.101', '0.102', '0.103', '0.107',
        '1.101', '1.103', '1.107',
    ]

    const PP1877Categories = {
        noConnection: {
            id: 'noConnection',
            name: 'Нет связи',
            icon: '📡', // Опционально
            templates: {
                fourHours: {
                    id: 'fourHours',
                    name: 'Более 4-х часов не выходит на связь',
                    description: '',

                    // Поля формы
                    fields: [
                        {
                            id: 'connectionRestored',
                            type: 'checkbox',
                            label: 'Вышла на связь',
                            default: false,
                            highlight: true,
                        },
                        {
                            id: 'telemetryValid',
                            type: 'checkbox',
                            label: 'Телеметрия валидная',
                            default: true,
                            highlight: true,
                            showIf: 'connectionRestored',
                        },
                        {
                            id: 'transportCompleted',
                            type: 'checkbox',
                            label: 'Перевозка завершена штатно',
                            default: true, // Активен по умолчанию когда показывается
                            highlight: true,
                            hideIf: 'connectionRestored',
                            showIfStatus: 'Завершена', // Показывать только если статус "Завершена"
                        },
                        {
                            id: 'lastConnectionDate',
                            type: 'datetime',
                            label: 'Дата и время последнего выхода на связь',
                            required: true,
                            showIf: 'transportCompleted',
                            hideIf: 'connectionRestored',
                            showIfStatus: 'Завершена', // Показывать только если статус "Завершена"
                        },
                        {
                            id: 'distance',
                            type: 'number',
                            label: 'Расстояние до пункта выезда (км)',
                            placeholder: 'Например: 1050',
                            required: true,
                            hideIf: 'connectionRestored',
                            hideIfAny: ['transportCompleted'],
                        },
                        {
                            id: 'driverCalled',
                            type: 'checkbox',
                            label: 'Дозвонился до водителя',
                            default: false,
                            showIfTransport: 'Авто',
                            hideIf: 'connectionRestored',
                            hideIfAny: ['transportCompleted'],
                        },
                        {
                            id: 'driverWords',
                            type: 'textarea',
                            label: 'Слова водителя',
                            placeholder: 'Что сообщил водитель...',
                            showIf: 'driverCalled',
                            showIfTransport: 'Авто',
                            hideIf: 'connectionRestored',
                            hideIfAny: ['transportCompleted'],
                        },
                    ],

                    // Функция генерации сообщения
                    generate(data, fields) {
                        // Если вышла на связь - короткое сообщение
                        if (fields.connectionRestored) {
                            const telemetryStatus = fields.telemetryValid ? '' : ', телеметрия невалидная'
                            return `ЭНП ${data.sealNumber} (перевозка ${data.transportType}) ${data.orderNumber} вышла на связь${telemetryStatus}. Отправлено уведомление в ФТС о восстановлении связи.`
                        }

                        // Если перевозка завершена штатно (только при статусе "Завершена")
                        if (data.transportStatus === 'Завершена' && fields.transportCompleted) {
                            const dateStr = fields.lastConnectionDate
                                ? new Date(fields.lastConnectionDate).toLocaleString('ru-RU', {
                                    day: '2-digit',
                                    month: '2-digit',
                                    year: 'numeric',
                                    hour: '2-digit',
                                    minute: '2-digit'
                                }).replace(',', '')
                                : '???'
                            return `ЭНП ${data.sealNumber} (перевозка ${data.transportType}) ${data.orderNumber} Перевозка завершена штатно на пункте выезда ${data.checkpointType} ${data.checkpointName}. На связь с ${dateStr} и до конца маршрута не выходила. Трек на картографической основе обрывается на месте последнего выхода ЭНП на связь.`
                        }

                        // Для ЖД - без информации о водителе
                        if (data.transportType === 'ЖД') {
                            return `ЭНП ${data.sealNumber} (перевозка ${data.transportType}) ${data.orderNumber} более 4-х часов не выходит на связь. До пункта выезда ${data.checkpointType} ${data.checkpointName} ${fields.distance || '???'} км. Нарушение подтверждено. Отправлено уведомление в ФТС.`
                        }

                        // Для Авто - с информацией о водителе
                        const driverContact = fields.driverCalled
                            ? `Со слов водителя: ${fields.driverWords || ''}`
                            : 'До водителя дозвониться не удалось'

                        return `ЭНП ${data.sealNumber} (перевозка ${data.transportType}) ${data.orderNumber} более 4-х часов не выходит на связь. До пункта выезда ${data.checkpointType} ${data.checkpointName} ${fields.distance || '???'} км. ${driverContact}. Нарушение подтверждено. Отправлено уведомление в ФТС.`
                    },

                    // Связанные шаблоны (ответные сообщения)
                    // Будут показаны как дополнительные опции после основного
                    relatedTemplates: {},
                },

                // После активации
                fourHoursAfterActivation: {
                    id: 'fourHoursAfterActivation',
                    name: 'Более 4-х часов не выходит на связь после активации',
                    description: '',

                    fields: [
                        {
                            id: 'connectionRestored',
                            type: 'checkbox',
                            label: 'Вышла на связь',
                            default: false,
                            highlight: true,
                        },
                        {
                            id: 'telemetryValid',
                            type: 'checkbox',
                            label: 'Телеметрия валидная',
                            default: true,
                            highlight: true,
                            showIf: 'connectionRestored',
                        },
                        {
                            id: 'properlyInstalled',
                            type: 'checkbox',
                            label: 'Штатно навесили',
                            default: true,
                            hideIf: 'connectionRestored',
                        },
                        {
                            id: 'lockClosed',
                            type: 'checkbox',
                            label: 'Замок закрыт',
                            default: true,
                            hideIf: 'connectionRestored',
                        },
                        {
                            id: 'poorConnection',
                            type: 'checkbox',
                            label: 'Плохая связь на пункте',
                            default: true,
                            hideIf: 'connectionRestored',
                        },
                        {
                            id: 'employeeWords',
                            type: 'textarea',
                            label: 'Дополнительные слова сотрудника (необязательно)',
                            placeholder: 'Что ещё сообщил сотрудник...',
                            hideIf: 'connectionRestored',
                        },
                    ],

                    generate(data, fields) {
                        // Если вышла на связь
                        if (fields.connectionRestored) {
                            const telemetryStatus = fields.telemetryValid ? '' : ', телеметрия невалидная'
                            return `ЭНП ${data.sealNumber} (перевозка ${data.transportType}) ${data.orderNumber} вышла на связь${telemetryStatus}. Отправлено уведомление в ФТС о восстановлении связи.`
                        }

                        // Собираем части сообщения
                        const parts = []

                        // Дополнительные слова сотрудника (если есть)
                        const extraWords = (fields.employeeWords || '').trim()
                        if (extraWords) {
                            parts.push(extraWords)
                        }

                        // Штатно навесили
                        if (fields.properlyInstalled) {
                            parts.push('навешивание прошло штатно')
                        }

                        // Замок закрыт
                        if (fields.lockClosed) {
                            parts.push('замок закрыт')
                        }

                        const employeeInfo = parts.length > 0 ? parts.join(', ') : '—'

                        // Плохая связь
                        const poorConnectionText = fields.poorConnection
                            ? `. На ${data.entryCheckpointType} наблюдается плохая связь`
                            : ''

                        return `ЭНП ${data.sealNumber} (перевозка ${data.transportType}) ${data.orderNumber} более 4-х часов не выходит на связь после активации. Со слов сотрудника ${data.entryCheckpointType} ${data.entryCheckpointName} ${employeeInfo}${poorConnectionText}. Нарушение подтверждено. Отправлено уведомление в ФТС.`
                    },

                    relatedTemplates: {},
                },

                // Более часа после активации
                oneHourAfterActivation: {
                    id: 'oneHourAfterActivation',
                    name: 'Более часа не выходит на связь после активации',
                    description: '',

                    fields: [
                        {
                            id: 'connectionRestored',
                            type: 'checkbox',
                            label: 'Вышла на связь',
                            default: false,
                            highlight: true,
                        },
                        {
                            id: 'telemetryValid',
                            type: 'checkbox',
                            label: 'Телеметрия валидная',
                            default: true,
                            highlight: true,
                            showIf: 'connectionRestored',
                        },
                        {
                            id: 'hasEmployeeInfo',
                            type: 'checkbox',
                            label: 'Есть информация от сотрудника',
                            default: true,
                            hideIf: 'connectionRestored',
                        },
                        {
                            id: 'properlyInstalled',
                            type: 'checkbox',
                            label: 'Штатно навесили',
                            default: true,
                            showIf: 'hasEmployeeInfo',
                            hideIf: 'connectionRestored',
                        },
                        {
                            id: 'lockClosed',
                            type: 'checkbox',
                            label: 'Замок закрыт',
                            default: true,
                            showIf: 'hasEmployeeInfo',
                            hideIf: 'connectionRestored',
                        },
                        {
                            id: 'vehicleLeft',
                            type: 'checkbox',
                            label: 'ТС/Состав покинул пункт навешивания',
                            default: true,
                            showIf: 'hasEmployeeInfo',
                            hideIf: 'connectionRestored',
                        },
                        {
                            id: 'cantInspect',
                            type: 'checkbox',
                            label: 'Осмотреть пломбу нет возможности (для ЖД)',
                            default: false,
                            showIf: 'hasEmployeeInfo',
                            hideIf: 'connectionRestored',
                            showIfTransport: 'ЖД',
                        },
                        {
                            id: 'hasSecondSeal',
                            type: 'checkbox',
                            label: 'На вагон навешана вторая ЭНП (для ЖД)',
                            default: false,
                            hideIf: 'connectionRestored',
                            showIfTransport: 'ЖД',
                        },
                        {
                            id: 'secondSealNumber',
                            type: 'text',
                            label: 'Номер второй ЭНП',
                            placeholder: 'Например: 16363',
                            showIf: 'hasSecondSeal',
                            hideIf: 'connectionRestored',
                            showIfTransport: 'ЖД',
                        },
                        {
                            id: 'poorConnection',
                            type: 'checkbox',
                            label: 'Плохая связь на пункте',
                            default: false,
                            hideIf: 'connectionRestored',
                        },
                        {
                            id: 'employeeWords',
                            type: 'textarea',
                            label: 'Дополнительные слова сотрудника (необязательно)',
                            placeholder: 'Что ещё сообщил сотрудник...',
                            showIf: 'hasEmployeeInfo',
                            hideIf: 'connectionRestored',
                        },
                    ],

                    generate(data, fields) {
                        // Если вышла на связь
                        if (fields.connectionRestored) {
                            const telemetryStatus = fields.telemetryValid ? '' : ', телеметрия невалидная'
                            return `ЭНП ${data.sealNumber} (перевозка ${data.transportType}) ${data.orderNumber} вышла на связь${telemetryStatus}. Отправлено уведомление в ФТС о восстановлении связи.`
                        }

                        const isRailway = data.transportType === 'ЖД'

                        // Вторая ЭНП (только для ЖД)
                        let secondSealText = ''
                        if (isRailway && fields.hasSecondSeal && fields.secondSealNumber) {
                            secondSealText = ` На вагон навешана вторая ЭНП ${fields.secondSealNumber} которая передаёт телеметрию исправно.`
                        }

                        // Собираем информацию от сотрудника
                        let employeePart = ''
                        if (fields.hasEmployeeInfo) {
                            const parts = []

                            // Дополнительные слова сотрудника (если есть)
                            const extraWords = (fields.employeeWords || '').trim()
                            if (extraWords) {
                                parts.push(extraWords)
                            }

                            // Штатно навесили
                            if (fields.properlyInstalled) {
                                parts.push(isRailway ? 'навешивание ЭНП прошло штатно' : 'навешивание ЭНП произошло штатно')
                            }

                            // Замок закрыт (только для Авто, для ЖД обычно не упоминают)
                            if (fields.lockClosed && !isRailway) {
                                parts.push('замок закрыт')
                            }

                            // Осмотреть нет возможности (для ЖД)
                            if (isRailway && fields.cantInspect) {
                                parts.push('осмотреть пломбу нет возможности')
                            }

                            const employeeInfo = parts.join(', ')

                            // Для ЖД: "сотрудника РЖД", для Авто: "сотрудника МАПП {название}"
                            const employeeSource = isRailway
                                ? 'сотрудника РЖД'
                                : `сотрудника ${data.entryCheckpointType} ${data.entryCheckpointName}`

                            if (employeeInfo) {
                                employeePart = ` Со слов ${employeeSource} ${employeeInfo}.`
                            }

                            // ТС/Состав покинул пункт
                            if (fields.vehicleLeft) {
                                employeePart += isRailway ? ' Состав покинул станцию.' : ' ТС покинуло пункт навешивания.'
                            }
                        }

                        // Плохая связь
                        const poorConnectionText = fields.poorConnection
                            ? ` На ${data.entryCheckpointType} наблюдается плохая связь.`
                            : ''

                        return `ЭНП ${data.sealNumber} (перевозка ${data.transportType}) ${data.orderNumber}. Более часа не выходит на связь после активации, ${data.entryCheckpointType} ${data.entryCheckpointName}.${secondSealText}${employeePart}${poorConnectionText} Нарушение подтверждено.`
                    },

                    relatedTemplates: {},
                },

                // Не вышла до конца маршрута
                didNotReachEnd: {
                    id: 'didNotReachEnd',
                    name: 'Не вышла до конца маршрута',
                    description: '',

                    fields: [
                        {
                            id: 'neverConnected',
                            type: 'checkbox',
                            label: 'Не выходила на связь с момента активации',
                            default: false,
                            highlight: true,
                            highlightColor: 'red',
                        },
                        {
                            id: 'lastConnectionDate',
                            type: 'datetime',
                            label: 'Дата и время последнего выхода на связь',
                            required: true,
                            hideIf: 'neverConnected',
                        },
                        {
                            id: 'firmwareVersion',
                            type: 'text',
                            label: 'Версия ПО',
                            placeholder: 'Например: 0.099',
                            required: true,
                            showIf: 'neverConnected',
                            datalist: FIRMWARE_VERSIONS,
                        },
                    ],

                    generate(data, fields) {
                        if (fields.neverConnected) {
                            return `ЭНП ${data.sealNumber} (перевозка ${data.transportType}) ${data.orderNumber} , ПО ${fields.firmwareVersion || '???'}. Перевозка завершена штатно на пункте выезда ${data.checkpointType} ${data.checkpointName}, на связь с момента активации до конца маршрута не выходила. Трек на картографической основе не прорисовался.`
                        }

                        const dateStr = fields.lastConnectionDate
                            ? new Date(fields.lastConnectionDate).toLocaleString('ru-RU', {
                                day: '2-digit',
                                month: '2-digit',
                                year: 'numeric',
                                hour: '2-digit',
                                minute: '2-digit'
                            }).replace(',', '')
                            : '???'

                        return `ЭНП ${data.sealNumber} (перевозка ${data.transportType}) ${data.orderNumber} Перевозка завершена штатно на пункте выезда ${data.checkpointType} ${data.checkpointName}. На связь с ${dateStr} и до конца маршрута не выходила. Трек на картографической основе обрывается на месте последнего выхода ЭНП на связь.`
                    },

                    relatedTemplates: {},
                },
            },
        },

        // Категория: АКБ
        battery: {
            id: 'battery',
            name: 'АКБ',
            icon: '🔋',
            templates: {
                lowBattery: {
                    id: 'lowBattery',
                    name: 'Низкий уровень заряда аккумулятора',
                    description: '',

                    fields: [
                        {
                            id: 'firmwareVersion',
                            type: 'text',
                            label: 'Версия ПО',
                            placeholder: 'Например: 0.065',
                            required: true,
                            datalist: FIRMWARE_VERSIONS,
                        },
                        {
                            id: 'batteryLevel',
                            type: 'number',
                            label: 'Заряд АКБ (%)',
                            placeholder: 'Например: 25',
                            required: true,
                        },
                        {
                            id: 'distance',
                            type: 'number',
                            label: 'Расстояние до пункта выезда (км)',
                            placeholder: 'Например: 130',
                            required: true,
                        },
                    ],

                    generate(data, fields) {
                        return `ЭНП ${data.sealNumber} (перевозка ${data.transportType}) ${data.orderNumber} ПО: ${fields.firmwareVersion || '???'} Появилось нарушение "Низкий уровень заряда аккумулятора ${fields.batteryLevel || '???'}%". Нарушение отклонено. До пункта выезда ${data.checkpointType} ${data.checkpointName} ${fields.distance || '???'} км.`
                    },

                    relatedTemplates: {},
                },
            },
        },

        // Категория: Тревога
        alarm: {
            id: 'alarm',
            name: 'Тревога',
            icon: '⚠️',
            templates: {
                pinBreak: {
                    id: 'pinBreak',
                    name: 'Взлом запорного штыря',
                    description: '',

                    fields: [
                        {
                            id: 'firmwareVersion',
                            type: 'text',
                            label: 'Версия ПО',
                            placeholder: 'Например: 0.065',
                            required: true,
                            datalist: FIRMWARE_VERSIONS,
                        },
                        {
                            id: 'distance',
                            type: 'number',
                            label: 'Расстояние до пункта выезда (км)',
                            placeholder: 'Например: 2473',
                            required: true,
                        },
                        {
                            id: 'isRepeated',
                            type: 'checkbox',
                            label: 'Повторное нарушение',
                            default: false,
                            highlight: true,
                            highlightColor: 'orange',
                        },
                        {
                            id: 'dateFrom',
                            type: 'datetime',
                            label: 'Период с',
                            required: true,
                            showIf: 'isRepeated',
                        },
                        {
                            id: 'dateTo',
                            type: 'datetime',
                            label: 'Период до',
                            required: true,
                            showIf: 'isRepeated',
                        },
                        {
                            id: 'driverReached',
                            type: 'checkbox',
                            label: 'Дозвонился до водителя',
                            default: false,
                            hideIf: 'isRepeated',
                        },
                        {
                            id: 'cableNotExtractable',
                            type: 'checkbox',
                            label: 'Трос не извлекается',
                            default: true,
                            showIf: 'driverReached',
                            hideIf: 'isRepeated',
                        },
                        {
                            id: 'cableIntact',
                            type: 'checkbox',
                            label: 'Трос цел',
                            default: true,
                            showIf: 'driverReached',
                            hideIf: 'isRepeated',
                        },
                        {
                            id: 'enrFixed',
                            type: 'checkbox',
                            label: 'ЭНП зафиксирована на двери',
                            default: true,
                            showIf: 'driverReached',
                            hideIf: 'isRepeated',
                        },
                        {
                            id: 'alarmStopped',
                            type: 'checkbox',
                            label: 'Тревога прекратилась',
                            default: false,
                            highlight: true,
                            showIf: 'driverReached',
                            hideIf: 'isRepeated',
                        },
                        {
                            id: 'additionalDriverInfo',
                            type: 'textarea',
                            label: 'Дополнительная информация от водителя',
                            placeholder: 'Опишите ситуацию...',
                            required: true,
                            showIf: 'driverReached',
                            hideIf: 'isRepeated',
                            hideIfAll: ['cableNotExtractable', 'cableIntact'],
                        },
                        {
                            id: 'signalCount',
                            type: 'number',
                            label: 'Количество сигналов',
                            placeholder: 'Например: 5',
                            required: true,
                            hideIf: 'driverReached',
                            showIfAny: ['isRepeated'],
                        },
                    ],

                    generate(data, fields) {
                        // Повторное нарушение
                        if (fields.isRepeated) {
                            const dateFromStr = fields.dateFrom
                                ? new Date(fields.dateFrom).toLocaleString('ru-RU', {
                                    day: '2-digit', month: '2-digit', year: 'numeric',
                                    hour: 'numeric', minute: '2-digit'
                                }).replace(',', '')
                                : '???'
                            const dateToStr = fields.dateTo
                                ? new Date(fields.dateTo).toLocaleString('ru-RU', {
                                    day: '2-digit', month: '2-digit', year: 'numeric',
                                    hour: 'numeric', minute: '2-digit'
                                }).replace(',', '')
                                : '???'
                            return `ЭНП ${data.sealNumber} (перевозка ${data.transportType}) ${data.orderNumber}, ПО: ${fields.firmwareVersion || '???'}. До пункта выезда ${data.checkpointType} ${data.checkpointName} ${fields.distance || '???'} км. В период с ${dateFromStr} ч. до ${dateToStr} ч. поступило ${fields.signalCount || '???'} сигналов о нарушении: "Взлом запорного штыря". Нарушения подтверждены.`
                        }

                        // Не дозвонился до водителя
                        if (!fields.driverReached) {
                            return `ЭНП ${data.sealNumber} (перевозка ${data.transportType}) ${data.orderNumber}. ПО: ${fields.firmwareVersion || '???'}. До пункта выезда ${data.checkpointType} ${data.checkpointName} ${fields.distance || '???'} км. Поступило ${fields.signalCount || '???'} сигналов о нарушении "Взлом запорного штыря". До водителя дозвониться не удалось. Нарушения подтверждены, отправлено уведомление в ФТС.`
                        }

                        // Дозвонился - со слов водителя
                        const driverParts = []
                        if (fields.cableNotExtractable) driverParts.push('трос не извлекается')
                        if (fields.cableIntact) driverParts.push('визуально трос в исправном состоянии')
                        if (fields.enrFixed) driverParts.push('ЭНП зафиксирована на двери прицепа')

                        let driverInfo = driverParts.length > 0
                            ? ` Со слов водителя: ${driverParts.join(', ')}.`
                            : ''

                        const extra = (fields.additionalDriverInfo || '').trim()
                        if (extra) driverInfo += ` ${extra}.`

                        const alarmText = fields.alarmStopped
                            ? 'сигнал тревоги прекратился'
                            : 'сигнал тревоги не прекратился'

                        const confirmText = fields.alarmStopped
                            ? 'Нарушение не подтверждено.'
                            : 'Нарушение подтверждено, отправлено уведомление в ФТС.'

                        return `ЭНП ${data.sealNumber} (перевозка ${data.transportType}) ${data.orderNumber}, ПО: ${fields.firmwareVersion || '???'}. До пункта выезда ${data.checkpointType} ${data.checkpointName} ${fields.distance || '???'} км. Поступил сигнал о нарушении "Взлом запорного штыря".${driverInfo} При попытке установить штыри глубже, ${alarmText}. ${confirmText}`
                    },

                    relatedTemplates: {},
                },
            },
        },
    }

    const D7Categories = {
        battery: {
            id: 'battery',
            name: 'АКБ',
            icon: '🔋',
            templates: {
                lowBattery: {
                    id: 'lowBattery',
                    name: 'Уровень заряда АКБ ниже 15%',
                    description: '',

                    fields: [
                        {
                            id: 'firmwareVersion',
                            type: 'text',
                            label: 'Версия ПО',
                            placeholder: 'Например: 0.099',
                            required: true,
                            datalist: FIRMWARE_VERSIONS,
                        },
                        {
                            id: 'batteryLevel',
                            type: 'number',
                            label: 'Заряд АКБ (%)',
                            placeholder: 'Например: 12',
                            required: true,
                            halfWidth: true,
                        },
                        {
                            id: 'startBatteryLevel',
                            type: 'number',
                            label: 'АКБ Старта (%)',
                            placeholder: 'Например: 95',
                            required: true,
                            halfWidth: true,
                        },
                        {
                            id: 'activationDate',
                            type: 'datetime',
                            label: 'Дата и время активации',
                            required: true,
                        },
                        {
                            id: 'atCheckpoint',
                            type: 'checkbox',
                            label: 'ТС на КП завершения',
                            default: false,
                            highlight: true,
                        },
                        {
                            id: 'distanceToEnd',
                            type: 'number',
                            label: 'Расстояние до пункта завершения (км)',
                            placeholder: 'Например: 350',
                            required: true,
                            hideIf: 'atCheckpoint',
                        },
                        {
                            id: 'territory',
                            type: 'text',
                            label: 'Территория нахождения',
                            placeholder: 'Например: РФ',
                            required: true,
                            datalist: ['РФ', 'РБ'],
                        },
                        {
                            id: 'frequency',
                            type: 'select',
                            label: 'Частота передачи данных',
                            required: true,
                            halfWidth: true,
                            options: [
                                { value: '900', label: '900' },
                                { value: '3600', label: '3600' },
                                { value: '7200', label: '7200' },
                            ],
                        },
                        {
                            id: 'frequencyUnchanged',
                            type: 'checkbox',
                            label: 'Не изменялась',
                            default: false,
                            halfWidth: true,
                        },
                        {
                            id: 'analysisType',
                            type: 'radio',
                            label: 'Анализ',
                            options: [
                                { value: 'normal', label: 'АКБ работает штатно' },
                                { value: 'anomalous', label: 'Аномальное поведение АКБ' },
                            ],
                        },
                        {
                            id: 'analysisConstantConnection',
                            type: 'checkbox',
                            label: 'Постоянный выход на связь',
                            default: false,
                            halfWidth: true,
                            showIfValue: { field: 'analysisType', value: 'normal' },
                        },
                        {
                            id: 'analysisAlarm',
                            type: 'checkbox',
                            label: 'В статусе "Тревога"',
                            default: false,
                            halfWidth: true,
                            showIf: 'analysisConstantConnection',
                        },
                        {
                            id: 'analysisNonLinear',
                            type: 'checkbox',
                            label: 'Разряд не линейно',
                            default: false,
                            halfWidth: true,
                            showIfValue: { field: 'analysisType', value: 'anomalous' },
                        },
                        {
                            id: 'analysisTemperature',
                            type: 'text',
                            label: 'Температура в телеметрии',
                            halfWidth: true,
                            placeholder: 'например: -31',
                            showIfValue: { field: 'analysisType', value: 'anomalous' },
                        },
                        {
                            id: 'additionalNote',
                            type: 'textarea',
                            label: 'Дополнительная информация (необязательно)',
                            placeholder: 'Дополнительные сведения...',
                        },
                    ],

                    generate(data, fields) {
                        const activationStr = fields.activationDate
                            ? new Date(fields.activationDate).toLocaleString('ru-RU', {
                                day: '2-digit',
                                month: '2-digit',
                                year: 'numeric',
                                hour: '2-digit',
                                minute: '2-digit'
                            }).replace(',', '')
                            : '???'

                        const locationPart = fields.atCheckpoint
                            ? 'ТС на КП завершения'
                            : `До пункта завершения ${fields.distanceToEnd || '???'} км`

                        const territory = fields.territory || '???'
                        const freq = fields.frequency || '???'
                        let frequencyLine
                        if (fields.frequencyUnchanged) {
                            frequencyLine = `Частота: не изменялась - ${freq}`
                        } else if (territory === 'РБ') {
                            frequencyLine = `Частота: По решению ГТК РБ частота изменена на ${freq}`
                        } else {
                            frequencyLine = `Частота: переведена на - ${freq}`
                        }

                        const analysisParts = []
                        if (fields.analysisType === 'normal') {
                            analysisParts.push('АКБ работает штатно')
                            if (fields.analysisConstantConnection) {
                                const alarm = fields.analysisAlarm ? ' в статусе "Тревога"' : ''
                                analysisParts.push(`Разряд АКБ связан с постоянным выходом пломбы на связь${alarm}`)
                            }
                        }
                        if (fields.analysisType === 'anomalous') {
                            analysisParts.push('Аномальное поведение АКБ')
                        }
                        if (fields.analysisNonLinear) {
                            analysisParts.push('Разряд АКБ осуществляется не линейно')
                        }
                        if (/\d/.test(fields.analysisTemperature || '')) {
                            analysisParts.push(`Температура в последней телеметрии: ${fields.analysisTemperature.trim()}°`)
                        }

                        const lines = [
                            `ЭНП ${data.sealNumber} ${data.orderNumber}`,
                            `ПО: ${fields.firmwareVersion || '???'}`,
                            `Заряд АКБ: ${fields.batteryLevel || '???'}%, АКБ Старта: ${fields.startBatteryLevel || '???'}%`,
                            `Активирована: ${activationStr}`,
                            `ТС: ${data.vehicleNumber}`,
                            `Маршрут: ${data.activationPoint} - ${data.deactivationPoint}`,
                            `${locationPart}.`,
                            `На территории: ${territory}.`,
                            frequencyLine,
                            `Анализ: ${analysisParts.length ? analysisParts.join('. ') + '.' : '???'}`,
                        ]

                        if ((fields.additionalNote || '').trim()) {
                            lines.push(fields.additionalNote.trim())
                        }

                        return lines.join('\n')
                    },

                    relatedTemplates: {},
                },
            },
        },

        cutting: {
            id: 'cutting',
            name: 'Срезание',
            icon: '✂️',
            templates: {
                agreed: {
                    id: 'agreed',
                    name: 'Согласовано срезание',
                    fields: [
                        {
                            id: 'territory',
                            type: 'text',
                            label: 'Территория',
                            datalist: ['РФ', 'РБ'],
                            required: true,
                            halfWidth: true,
                        },
                        {
                            id: 'firmwareVersion',
                            type: 'text',
                            label: 'Версия ПО',
                            datalist: FIRMWARE_VERSIONS,
                            required: true,
                            halfWidth: true,
                        },
                        { id: 'reasonLabel', type: 'label', label: 'Причина' },
                        {
                            id: 'reasonNoConnection',
                            type: 'checkbox',
                            label: 'Отсутствие связи',
                            default: false,
                            halfWidth: true,
                            hideIfAny: ['reasonEnpFault', 'reasonBatteryDrain', 'reasonLockFault'],
                        },
                        {
                            id: 'reasonNfcFault',
                            type: 'checkbox',
                            label: 'Неисправность NFC',
                            default: false,
                            halfWidth: true,
                            showIf: 'reasonNoConnection',
                        },
                        {
                            id: 'reasonEnpFault',
                            type: 'checkbox',
                            label: 'Неисправность ЭНП',
                            default: false,
                            halfWidth: true,
                            hideIfAny: ['reasonNoConnection', 'reasonBatteryDrain', 'reasonLockFault'],
                        },
                        {
                            id: 'reasonBatteryDrain',
                            type: 'checkbox',
                            label: 'Разряд АКБ',
                            default: false,
                            halfWidth: true,
                            hideIfAny: ['reasonNoConnection', 'reasonEnpFault', 'reasonLockFault'],
                        },
                        {
                            id: 'reasonLockFault',
                            type: 'checkbox',
                            label: 'Неисправность запорного механизма',
                            default: false,
                            halfWidth: true,
                            hideIfAny: ['reasonNoConnection', 'reasonEnpFault', 'reasonBatteryDrain'],
                        },
                        {
                            id: 'procedure',
                            type: 'radio',
                            label: 'Процедура',
                            options: [
                                { value: 'Промежуточное размыкание', label: 'Промежуточное размыкание' },
                                { value: 'Завершение', label: 'Завершение' },
                            ],
                            defaultByStatus: {
                                'Деактивирована': 'Завершение',
                                '_default': 'Промежуточное размыкание',
                            },
                        },
                        {
                            id: 'agentPresent',
                            type: 'checkbox',
                            label: 'Присутствие Агента',
                            default: false,
                            halfWidth: true,
                        },
                        {
                            id: 'cuttingPlace',
                            type: 'text',
                            label: 'Место срезания',
                            placeholder: 'Авто: точка деактивации при "Деактивирована"',
                        },
                        {
                            id: 'lastConnection',
                            type: 'datetime',
                            label: 'Последний выход на связь',
                            required: true,
                        },
                        {
                            id: 'actions',
                            type: 'textarea',
                            label: 'Описание действий',
                            placeholder: 'Удалённые команды, приложение СОПТ, индикация...',
                        },
                    ],

                    generate(data, fields) {
                        const reasons = []
                        if (fields.reasonNoConnection) reasons.push('отсутствие связи')
                        if (fields.reasonNfcFault) reasons.push('неисправность NFC модуля')
                        if (fields.reasonEnpFault) reasons.push('неисправность ЭНП')
                        if (fields.reasonBatteryDrain) reasons.push('разряд АКБ')
                        if (fields.reasonLockFault) reasons.push('неисправность запорного механизма')

                        const cuttingPlace = (data.transportStatus === 'Деактивирована' && !(fields.cuttingPlace || '').trim())
                            ? data.deactivationPoint
                            : (fields.cuttingPlace || '???')

                        const lastConnStr = fields.lastConnection
                            ? new Date(fields.lastConnection).toLocaleString('ru-RU', {
                                day: '2-digit',
                                month: '2-digit',
                                year: 'numeric',
                                hour: '2-digit',
                                minute: '2-digit'
                            }).replace(',', '')
                            : '???'

                        return [
                            `@IvanB0`,
                            `Дежурный Оператор 1 ЦУиМ`,
                            ``,
                            `Оператором согласовано срезание ЭНП ${data.sealNumber} ЦРЦП в ${fields.territory || '???'}`,
                            `по причине: ${reasons.length ? reasons.join(', ') : '???'}`,
                            ``,
                            `Тип перевозок: ${data.transportProcedure}`,
                            `Перевозка: ${data.orderNumber}`,
                            `Статус перевозки: ${data.transportStatus || '???'}`,
                            `Процедура: ${fields.procedure || '???'}`,
                            `ЭНП: ${data.sealNumber}`,
                            `ПО: ${fields.firmwareVersion || '???'}`,
                            `Присутствие Агента: ${fields.agentPresent ? 'да' : 'нет'}`,
                            `Основной номер ТС: ${data.mainVehicleNumber}`,
                            `ГО: ${data.vehicleNumber}`,
                            `КП активации: ${data.activationPoint}`,
                            `Место срезания: ${cuttingPlace}`,
                            ``,
                            (fields.actions || '').trim() ? fields.actions.trim() : null,
                            (fields.actions || '').trim() ? `` : null,
                            `Последний выход на связь: ${lastConnStr}`,
                            ``,
                            `ЭНП ${data.sealNumber} была срезана`,
                        ].filter(line => line !== null).join('\n')
                    },

                    relatedTemplates: {},
                },

                notAgreed: {
                    id: 'notAgreed',
                    name: 'Не согласовано срезание',
                    fields: [
                        {
                            id: 'territory',
                            type: 'text',
                            label: 'Территория',
                            datalist: ['РФ', 'РБ'],
                            required: true,
                            halfWidth: true,
                        },
                        {
                            id: 'firmwareVersion',
                            type: 'text',
                            label: 'Версия ПО',
                            datalist: FIRMWARE_VERSIONS,
                            required: true,
                            halfWidth: true,
                        },
                        { id: 'reasonLabel', type: 'label', label: 'Причина' },
                        {
                            id: 'reasonNoConnection',
                            type: 'checkbox',
                            label: 'Отсутствие связи',
                            default: false,
                            halfWidth: true,
                            hideIfAny: ['reasonEnpFault', 'reasonBatteryDrain', 'reasonLockFault'],
                        },
                        {
                            id: 'reasonNfcFault',
                            type: 'checkbox',
                            label: 'Неисправность NFC',
                            default: false,
                            halfWidth: true,
                            showIf: 'reasonNoConnection',
                        },
                        {
                            id: 'reasonEnpFault',
                            type: 'checkbox',
                            label: 'Неисправность ЭНП',
                            default: false,
                            halfWidth: true,
                            hideIfAny: ['reasonNoConnection', 'reasonBatteryDrain', 'reasonLockFault'],
                        },
                        {
                            id: 'reasonBatteryDrain',
                            type: 'checkbox',
                            label: 'Разряд АКБ',
                            default: false,
                            halfWidth: true,
                            hideIfAny: ['reasonNoConnection', 'reasonEnpFault', 'reasonLockFault'],
                        },
                        {
                            id: 'reasonLockFault',
                            type: 'checkbox',
                            label: 'Неисправность запорного механизма',
                            default: false,
                            halfWidth: true,
                            hideIfAny: ['reasonNoConnection', 'reasonEnpFault', 'reasonBatteryDrain'],
                        },
                        {
                            id: 'cuttingPlace',
                            type: 'text',
                            label: 'Место срезания',
                            placeholder: 'Авто: точка деактивации при "Деактивирована"',
                        },
                        {
                            id: 'lastConnection',
                            type: 'datetime',
                            label: 'Последний выход на связь',
                            required: true,
                        },
                        {
                            id: 'reason',
                            type: 'textarea',
                            label: 'Причина отказа',
                            placeholder: 'Почему не согласовано...',
                            required: true,
                        },
                    ],

                    generate(data, fields) {
                        const reasons = []
                        if (fields.reasonNoConnection) reasons.push('отсутствие связи')
                        if (fields.reasonNfcFault) reasons.push('неисправность NFC модуля')
                        if (fields.reasonEnpFault) reasons.push('неисправность ЭНП')
                        if (fields.reasonBatteryDrain) reasons.push('разряд АКБ')
                        if (fields.reasonLockFault) reasons.push('неисправность запорного механизма')

                        const cuttingPlace = (data.transportStatus === 'Деактивирована' && !(fields.cuttingPlace || '').trim())
                            ? data.deactivationPoint
                            : (fields.cuttingPlace || '???')

                        const lastConnStr = fields.lastConnection
                            ? new Date(fields.lastConnection).toLocaleString('ru-RU', {
                                day: '2-digit',
                                month: '2-digit',
                                year: 'numeric',
                                hour: '2-digit',
                                minute: '2-digit'
                            }).replace(',', '')
                            : '???'

                        const lines = [
                            `Оператором НЕ согласовано срезание ЭНП ${data.sealNumber} в ${fields.territory || '???'}`,
                            `Запрос по причине: ${reasons.length ? reasons.join(', ') : '???'}`,
                            `Тип перевозок: ${data.transportProcedure}`,
                            `Перевозка: ${data.orderNumber}`,
                            `Статус перевозки: ${data.transportStatus || '???'}`,
                            `ЭНП: ${data.sealNumber}`,
                            `ПО: ${fields.firmwareVersion || '???'}`,
                            `Основной номер ТС: ${data.mainVehicleNumber}`,
                            `ГО: ${data.vehicleNumber}`,
                            `КП активации: ${data.activationPoint}`,
                            `Место срезания: ${cuttingPlace}`,
                            `Последний выход на связь: ${lastConnStr}`,
                            `Причина отказа: ${fields.reason || '???'}`,
                        ]

                        return lines.join('\n')
                    },

                    relatedTemplates: {},
                },
            },
        },
    }

    // ========================================
    // Утилиты
    // ========================================

    const Utils = {
        // Получить объект категорий по типу регуляции
        getCategoriesObj(regulationType) {
            return regulationType === 'D7' ? D7Categories : PP1877Categories
        },

        // Получить все категории как массив
        getCategories(regulationType) {
            return Object.values(this.getCategoriesObj(regulationType))
        },

        // Получить шаблон по пути category.template
        getTemplate(regulationType, categoryId, templateId) {
            const categories = this.getCategoriesObj(regulationType)
            const category = categories[categoryId]
            if (!category) return null
            return category.templates[templateId] || null
        },

        // Получить связанный шаблон
        getRelatedTemplate(regulationType, categoryId, templateId, relatedId) {
            const template = this.getTemplate(regulationType, categoryId, templateId)
            if (!template || !template.relatedTemplates) return null
            return template.relatedTemplates[relatedId] || null
        },

        // Проверить есть ли связанные шаблоны
        hasRelatedTemplates(template) {
            return template.relatedTemplates && Object.keys(template.relatedTemplates).length > 0
        },
    }

    // ========================================
    // Извлечение данных со страницы
    // ========================================

    class DataExtractor {
        extract() {
            return {
                sealNumber: this.getSealNumber(),
                transportType: this.getTransportType(),
                transportStatus: this.getTransportStatus(),
                orderNumber: this.getOrderNumber(),
                checkpointName: this.getCheckpointName(),      // Пункт выезда (←)
                checkpointType: this.getCheckpointType(),
                entryCheckpointName: this.getEntryCheckpointName(), // Пункт въезда (→)
                entryCheckpointType: this.getEntryCheckpointType(),
                mainVehicleNumber: this.getMainVehicleNumber(),
                vehicleNumber: this.getVehicleNumber(),
                activationPoint: this.getActivationPoint(),
                deactivationPoint: this.getDeactivationPoint(),
                transportProcedure: this.getTransportProcedure(),
            }
        }

        getSealNumber() {
            const el = document.querySelector('div[data-title="Арендуемые ЭНП"] span')
            if (!el) return '???'
            const match = el.textContent.match(/SN:\s*0*(\d+)/)
            return match ? match[1] : '???'
        }

        getTransportType() {
            // Ищем SVG use элемент с типом перевозки несколькими способами
            const svgIcons = document.querySelectorAll('svg use')
            for (const useEl of svgIcons) {
                // Пробуем разные способы получить href атрибут
                const href = useEl.getAttribute('xlink:href')
                    || useEl.getAttributeNS('http://www.w3.org/1999/xlink', 'href')
                    || useEl.getAttribute('href')
                    || ''

                if (href.includes('status-type-railway')) return 'ЖД'
                if (href.includes('status-type-auto')) return 'Авто'
            }
            return '???'
        }

        getOrderNumber() {
            const el = document.querySelector('label.text-orderNum span.status-card-sub')
            return el ? el.textContent.trim() : '???'
        }

        getCheckpointName() {
            const container = document.querySelector('div[data-title="Контрольные пункты"]')
            if (!container) return '???'

            const spans = container.querySelectorAll('span')
            for (const span of spans) {
                const text = span.textContent.trim()
                if (text.startsWith('←')) {
                    let name = text.replace('←', '').trim()
                    name = name.replace(/^(МАПП|ЖДПП)\s*/i, '').trim()
                    return name
                }
            }
            return '???'
        }

        getCheckpointType() {
            const transportType = this.getTransportType()
            if (transportType === 'ЖД') return 'ЖДПП'
            const name = this.getCheckpointName()
            if (/СВХ|ПОСТ/.test(name)) return ''
            return 'МАПП'
        }

        // Пункт въезда (→)
        getEntryCheckpointName() {
            const container = document.querySelector('div[data-title="Контрольные пункты"]')
            if (!container) return '???'

            const spans = container.querySelectorAll('span')
            for (const span of spans) {
                const text = span.textContent.trim()
                if (text.startsWith('→')) {
                    let name = text.replace('→', '').trim()
                    name = name.replace(/^(МАПП|ЖДПП)\s*/i, '').trim()
                    return name
                }
            }
            return '???'
        }

        getEntryCheckpointType() {
            const transportType = this.getTransportType()
            if (transportType === 'ЖД') return 'ЖДПП'
            const name = this.getEntryCheckpointName()
            if (/СВХ|ПОСТ/.test(name)) return ''
            return 'МАПП'
        }

        getTransportStatus() {
            // Ищем статус в блоке .status-card
            const statusDiv = document.querySelector('.status-card .sc-color div')
            return statusDiv ? statusDiv.textContent.trim() : ''
        }

        getMainVehicleNumber() {
            const el = document.querySelector('div[data-title="Регистрационный знак транспортного средства"]')
            return el ? el.textContent.trim() : '???'
        }

        getVehicleNumber() {
            const el = document.querySelector('div[data-title="Регистрационный знак прицепа или полуприцепа"]')
            return el ? el.textContent.trim() : '???'
        }

        getActivationPoint() {
            const el = document.querySelector('div[data-title="Точка активации"]')
            if (!el) return '???'
            const name = el.textContent.trim()
            return /СВХ|ПОСТ/i.test(name) ? name : `МАПП ${name}`
        }

        getDeactivationPoint() {
            const el = document.querySelector('div[data-title="Точка деактивации"]')
            if (!el) return '???'
            const name = el.textContent.trim()
            return /СВХ|ПОСТ/i.test(name) ? name : `МАПП ${name}`
        }

        getTransportProcedure() {
            const el = document.querySelector('div[data-title="Процедура перевозки"]')
            return el ? el.textContent.trim() : '???'
        }

        getRegulationType() {
            const orderNumber = this.getOrderNumber()
            if (orderNumber.startsWith('ST/')) return 'PP1877'
            if (/^(EV\/|ET\/|BY_)/.test(orderNumber)) return 'D7'
            return 'PP1877'
        }
    }

    // ========================================
    // Модальное окно
    // ========================================

    class Modal {
        constructor() {
            this.overlay = null
            this.container = null
            this.minimizedElement = null
            this.isMinimized = false
            this.currentCategory = null
            this.currentTemplate = null
            this.currentRelatedTemplate = null // Для связанных шаблонов
            this.regulationType = null
            this.fieldValues = {}
            this.dataExtractor = new DataExtractor()
            this.navigationStack = [] // История навигации для кнопки "Назад"
            this.lastOrderId = null // ID перевозки при открытии формы
            this.urlWatchInterval = null
        }

        // Извлекает ID перевозки из URL: /orders/item/{ID}/...
        getOrderIdFromUrl() {
            const match = window.location.pathname.match(/\/orders\/item\/([^\/]+)/)
            return match ? match[1] : null
        }

        injectStyles() {
            if (document.getElementById('catch-me-styles')) return

            const styles = document.createElement('style')
            styles.id = 'catch-me-styles'
            styles.textContent = `
                .cm-overlay {
                    position: fixed;
                    top: 0;
                    left: 0;
                    right: 0;
                    bottom: 0;
                    background: rgba(0, 0, 0, 0.5);
                    z-index: 10000;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                }

                .cm-modal {
                    background: white;
                    border-radius: 8px;
                    box-shadow: 0 4px 20px rgba(0, 0, 0, 0.3);
                    max-width: 520px;
                    width: 90%;
                    max-height: 85vh;
                    overflow-y: auto;
                }

                .cm-header {
                    padding: 16px 20px;
                    border-bottom: 1px solid #e0e0e0;
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    position: sticky;
                    top: 0;
                    background: white;
                    z-index: 1;
                }

                .cm-title {
                    font-size: 18px;
                    font-weight: 600;
                    color: #333;
                    margin: 0;
                }

                .cm-subtitle {
                    font-size: 12px;
                    color: #888;
                    margin-top: 2px;
                }

                .cm-close {
                    background: none;
                    border: none;
                    font-size: 24px;
                    cursor: pointer;
                    color: #666;
                    padding: 0;
                    line-height: 1;
                }

                .cm-close:hover {
                    color: #333;
                }

                .cm-minimize {
                    background: none;
                    border: none;
                    font-size: 20px;
                    cursor: pointer;
                    color: #666;
                    padding: 0;
                    line-height: 1;
                    margin-right: 8px;
                }

                .cm-minimize:hover {
                    color: #1890ff;
                }

                .cm-header-buttons {
                    display: flex;
                    align-items: center;
                }

                .cm-minimized {
                    position: fixed;
                    bottom: 5%;
                    right: 20px;
                    background: #1890ff;
                    color: white;
                    padding: 12px 20px;
                    border-radius: 8px;
                    cursor: pointer;
                    box-shadow: 0 4px 12px rgba(24, 144, 255, 0.4);
                    z-index: 10001;
                    display: flex;
                    align-items: center;
                    gap: 10px;
                    font-size: 14px;
                    transition: background 0.2s;
                    overflow: hidden;
                }

                .cm-minimized::before {
                    content: '';
                    position: absolute;
                    top: 0;
                    left: -100%;
                    width: 60%;
                    height: 100%;
                    background: linear-gradient(
                        90deg,
                        transparent,
                        rgba(255, 255, 255, 0.25),
                        transparent
                    );
                    animation: cm-shimmer 3s ease-in-out infinite;
                }

                @keyframes cm-shimmer {
                    0% { left: -100%; }
                    50% { left: 150%; }
                    100% { left: 150%; }
                }

                .cm-minimized:hover {
                    background: #40a9ff;
                }

                .cm-minimized-icon {
                    font-size: 18px;
                }

                .cm-minimized-close {
                    margin-left: 8px;
                    opacity: 0.7;
                    font-size: 18px;
                }

                .cm-minimized-close:hover {
                    opacity: 1;
                }

                .cm-body {
                    padding: 20px;
                }

                .cm-list {
                    list-style: none;
                    padding: 0;
                    margin: 0;
                }

                .cm-list-item {
                    padding: 14px 16px;
                    border: 1px solid #e0e0e0;
                    border-radius: 6px;
                    margin-bottom: 8px;
                    cursor: pointer;
                    transition: all 0.2s;
                    display: flex;
                    align-items: center;
                    gap: 12px;
                }

                .cm-list-item:hover {
                    background: #f5f5f5;
                    border-color: #1890ff;
                }

                .cm-list-item:last-child {
                    margin-bottom: 0;
                }

                .cm-list-icon {
                    font-size: 20px;
                    width: 28px;
                    text-align: center;
                }

                .cm-list-content {
                    flex: 1;
                }

                .cm-list-name {
                    font-weight: 500;
                    color: #333;
                }

                .cm-list-desc {
                    font-size: 12px;
                    color: #888;
                    margin-top: 2px;
                }

                .cm-list-arrow {
                    color: #ccc;
                    font-size: 18px;
                }

                .cm-breadcrumb {
                    font-size: 12px;
                    color: #888;
                    margin-bottom: 16px;
                    display: flex;
                    align-items: center;
                    gap: 6px;
                }

                .cm-breadcrumb-item {
                    cursor: pointer;
                }

                .cm-breadcrumb-item:hover {
                    color: #1890ff;
                }

                .cm-breadcrumb-sep {
                    color: #ccc;
                }

                #cm-form {
                    display: flex;
                    flex-wrap: wrap;
                    gap: 0 12px;
                }

                .cm-form-group {
                    width: 100%;
                    margin-bottom: 16px;
                }

                .cm-form-group-half {
                    width: calc(50% - 6px);
                }

                .cm-label {
                    display: block;
                    margin-bottom: 6px;
                    font-weight: 500;
                    color: #333;
                }

                .cm-input, .cm-textarea {
                    width: 100%;
                    padding: 10px 12px;
                    border: 1px solid #d9d9d9;
                    border-radius: 4px;
                    font-size: 14px;
                    box-sizing: border-box;
                }

                .cm-input:focus, .cm-textarea:focus {
                    border-color: #1890ff;
                    outline: none;
                    box-shadow: 0 0 0 2px rgba(24, 144, 255, 0.2);
                }

                .cm-textarea {
                    min-height: 80px;
                    resize: vertical;
                }

                .cm-input-wrap {
                    position: relative;
                    display: flex;
                    align-items: center;
                }

                .cm-input-wrap .cm-input {
                    padding-right: 32px;
                }

                .cm-clear-btn {
                    position: absolute;
                    right: 6px;
                    background: none;
                    border: none;
                    color: #999;
                    font-size: 18px;
                    cursor: pointer;
                    padding: 0 4px;
                    line-height: 1;
                }

                .cm-clear-btn:hover {
                    color: #333;
                }

                .cm-radio-group {
                    display: flex;
                    gap: 16px;
                }

                .cm-radio-label {
                    display: flex;
                    align-items: center;
                    gap: 6px;
                    cursor: pointer;
                    user-select: none;
                    font-size: 14px;
                }

                .cm-radio {
                    width: 16px;
                    height: 16px;
                    cursor: pointer;
                }

                .cm-checkbox-group {
                    display: flex;
                    align-items: center;
                    gap: 8px;
                }

                .cm-checkbox {
                    width: 18px;
                    height: 18px;
                    min-width: 18px;
                    cursor: pointer;
                    appearance: auto;
                    accent-color: #1890ff;
                }

                .cm-checkbox-label {
                    cursor: pointer;
                    user-select: none;
                    font-size: 14px;
                }

                .cm-checkbox-highlight {
                    background: linear-gradient(135deg, #e8f5e9 0%, #c8e6c9 100%);
                    border: 2px solid #4caf50;
                    border-radius: 6px;
                    padding: 12px 16px;
                    margin-bottom: 16px;
                }

                .cm-checkbox-highlight .cm-checkbox-label {
                    font-weight: 600;
                    color: #2e7d32;
                }

                .cm-checkbox-highlight .cm-checkbox {
                    width: 20px;
                    height: 20px;
                    accent-color: #4caf50;
                }

                .cm-checkbox-highlight-red {
                    background: linear-gradient(135deg, #ffebee 0%, #ffcdd2 100%);
                    border: 2px solid #e53935;
                    border-radius: 6px;
                    padding: 12px 16px;
                    margin-bottom: 16px;
                }

                .cm-checkbox-highlight-red .cm-checkbox-label {
                    font-weight: 600;
                    color: #c62828;
                }

                .cm-checkbox-highlight-red .cm-checkbox {
                    width: 20px;
                    height: 20px;
                    accent-color: #e53935;
                }

                .cm-checkbox-highlight-orange {
                    background: linear-gradient(135deg, #fff3e0 0%, #ffe0b2 100%);
                    border: 2px solid #fb8c00;
                    border-radius: 6px;
                    padding: 12px 16px;
                    margin-bottom: 16px;
                }

                .cm-checkbox-highlight-orange .cm-checkbox-label {
                    font-weight: 600;
                    color: #e65100;
                }

                .cm-checkbox-highlight-orange .cm-checkbox {
                    width: 20px;
                    height: 20px;
                    accent-color: #fb8c00;
                }

                .cm-missing {
                    color: #e53935;
                    font-weight: 700;
                }

                .cm-preview {
                    margin-top: 16px;
                }

                .cm-preview-text {
                    background: #fafafa;
                    border-left: 4px solid #1890ff;
                    border-radius: 0 4px 4px 0;
                    padding: 12px 16px;
                    font-size: 14px;
                    line-height: 1.7;
                    white-space: pre-wrap;
                    word-break: break-word;
                    font-style: italic;
                    color: #333;
                }

                .cm-preview-title {
                    font-weight: 600;
                    margin-bottom: 8px;
                    color: #666;
                    font-size: 12px;
                    text-transform: uppercase;
                }

                .cm-footer {
                    padding: 16px 20px;
                    border-top: 1px solid #e0e0e0;
                    display: flex;
                    gap: 12px;
                    justify-content: flex-end;
                    position: sticky;
                    bottom: 0;
                    background: white;
                }

                .cm-btn {
                    padding: 8px 16px;
                    border-radius: 4px;
                    font-size: 14px;
                    cursor: pointer;
                    transition: all 0.2s;
                    display: inline-flex;
                    align-items: center;
                    gap: 6px;
                }

                .cm-btn-secondary {
                    background: white;
                    border: 1px solid #d9d9d9;
                    color: #333;
                }

                .cm-btn-secondary:hover {
                    border-color: #1890ff;
                    color: #1890ff;
                }

                .cm-btn-primary {
                    background: #1890ff;
                    border: 1px solid #1890ff;
                    color: white;
                }

                .cm-btn-primary:hover:not(:disabled) {
                    background: #40a9ff;
                    border-color: #40a9ff;
                }

                .cm-btn-primary:disabled {
                    background: #ccc;
                    border-color: #ccc;
                    cursor: not-allowed;
                    opacity: 0.7;
                }

                .cm-data-info {
                    background: #e6f7ff;
                    border: 1px solid #91d5ff;
                    border-radius: 4px;
                    padding: 12px;
                    margin-bottom: 16px;
                    font-size: 13px;
                }

                .cm-data-row {
                    display: flex;
                    margin-bottom: 4px;
                }

                .cm-data-row:last-child {
                    margin-bottom: 0;
                }

                .cm-data-label {
                    color: #666;
                    min-width: 140px;
                }

                .cm-data-value {
                    color: #333;
                    font-weight: 500;
                }

                .cm-copied {
                    background: #52c41a !important;
                    border-color: #52c41a !important;
                }

                .cm-hidden {
                    display: none !important;
                }

                .cm-related-section {
                    margin-top: 20px;
                    padding-top: 16px;
                    border-top: 1px dashed #e0e0e0;
                }

                .cm-related-title {
                    font-size: 12px;
                    color: #888;
                    margin-bottom: 12px;
                    text-transform: uppercase;
                }

                .cm-empty {
                    text-align: center;
                    padding: 40px 20px;
                    color: #888;
                }

                .cm-empty-icon {
                    font-size: 48px;
                    margin-bottom: 12px;
                }

                .cm-search {
                    margin-bottom: 16px;
                }

                .cm-search-input {
                    width: 100%;
                    padding: 10px 12px;
                    border: 1px solid #d9d9d9;
                    border-radius: 4px;
                    font-size: 14px;
                    box-sizing: border-box;
                }

                .cm-search-input:focus {
                    border-color: #1890ff;
                    outline: none;
                    box-shadow: 0 0 0 2px rgba(24, 144, 255, 0.2);
                }

                .cm-list-item.cm-hidden-search {
                    display: none;
                }
            `
            document.head.appendChild(styles)
        }

        // ========== Навигация ==========

        open() {
            this.injectStyles()

            // Если свёрнуто - разворачиваем
            if (this.isMinimized) {
                this.restore()
                return
            }

            this.close()
            this.navigationStack = []
            this.lastOrderId = this.getOrderIdFromUrl()
            this.regulationType = this.dataExtractor.getRegulationType()
            this.showCategories()
        }

        goBack() {
            if (this.navigationStack.length > 0) {
                const prev = this.navigationStack.pop()
                prev.restore()
            } else {
                this.showCategories()
            }
        }

        // ========== Экран: Список категорий ==========

        showCategories() {
            this.currentCategory = null
            this.currentTemplate = null

            const regulation = this.regulationType === 'D7' ? 'Д7' : 'ПП1877'

            this.createModal({
                title: `Выберите категорию по ${regulation}`,
                showBack: false,
                body: this.renderCategoriesList(),
            })
        }

        renderCategoriesList() {
            const categories = Utils.getCategories(this.regulationType)

            if (categories.length === 0) {
                return `
                    <div class="cm-empty">
                        <div class="cm-empty-icon">📭</div>
                        <div>Нет доступных категорий</div>
                    </div>
                `
            }

            return `
                <ul class="cm-list">
                    ${categories
                        .map(
                            (cat) => `
                        <li class="cm-list-item" data-category="${cat.id}">
                            <span class="cm-list-icon">${cat.icon || '📁'}</span>
                            <div class="cm-list-content">
                                <div class="cm-list-name">${cat.name}</div>
                                <div class="cm-list-desc">${Object.keys(cat.templates).length} шаблон(ов)</div>
                            </div>
                            <span class="cm-list-arrow">›</span>
                        </li>
                    `
                        )
                        .join('')}
                </ul>
            `
        }

        // ========== Экран: Список шаблонов в категории ==========

        showTemplates(categoryId) {
            const categories = Utils.getCategoriesObj(this.regulationType)
            this.currentCategory = categories[categoryId]
            if (!this.currentCategory) return

            this.navigationStack.push({
                restore: () => this.showCategories(),
            })

            const regulation = this.regulationType === 'D7' ? 'Д7' : 'ПП1877'

            this.createModal({
                title: this.currentCategory.name,
                subtitle: `Выберите нарушение по ${regulation}`,
                showBack: true,
                body: this.renderTemplatesList(),
                footer: '<button type="button" class="cm-btn cm-btn-secondary" id="cm-back">Назад</button>',
            })
        }

        renderTemplatesList() {
            const templates = Object.values(this.currentCategory.templates)

            if (templates.length === 0) {
                return `
                    <div class="cm-empty">
                        <div class="cm-empty-icon">📭</div>
                        <div>Нет шаблонов в этой категории</div>
                    </div>
                `
            }

            return `
                <div class="cm-search">
                    <input type="text" class="cm-search-input" id="cm-search" placeholder="Поиск..." autofocus>
                </div>
                <ul class="cm-list" id="cm-templates-list">
                    ${templates
                        .map(
                            (tpl) => `
                        <li class="cm-list-item" data-template="${tpl.id}" data-search="${tpl.name.toLowerCase()}">
                            <div class="cm-list-content">
                                <div class="cm-list-name">${tpl.name}</div>
                                ${tpl.description ? `<div class="cm-list-desc">${tpl.description}</div>` : ''}
                            </div>
                            <span class="cm-list-arrow">›</span>
                        </li>
                    `
                        )
                        .join('')}
                </ul>
            `
        }

        // ========== Экран: Форма шаблона ==========

        showForm(templateId, isRelated = false) {
            if (isRelated) {
                this.currentRelatedTemplate = this.currentTemplate.relatedTemplates[templateId]
                if (!this.currentRelatedTemplate) return
            } else {
                this.currentTemplate = this.currentCategory.templates[templateId]
                this.currentRelatedTemplate = null
                if (!this.currentTemplate) return
            }

            const template = this.currentRelatedTemplate || this.currentTemplate
            const pageData = this.dataExtractor.extract()

            // Сохраняем текущее состояние для навигации
            this.navigationStack.push({
                restore: () => {
                    if (isRelated) {
                        this.showForm(this.currentTemplate.id, false)
                    } else {
                        this.showTemplates(this.currentCategory.id)
                    }
                },
            })

            // Сброс значений полей
            this.fieldValues = {}
            template.fields.forEach((field) => {
                // Не устанавливаем default для полей скрытых по showIfStatus
                if (field.showIfStatus && field.showIfStatus !== pageData.transportStatus) {
                    return
                }
                if (field.default !== undefined) {
                    this.fieldValues[field.id] = field.default
                }
            })

            this.createModal({
                title: template.name,
                subtitle: this.currentCategory.name,
                showBack: true,
                body: this.renderForm(template, pageData),
                footer: this.renderFormFooter(template),
            })

            this.updatePreview()
        }

        renderForm(template, pageData) {
            const hasRelated = Utils.hasRelatedTemplates(template) && !this.currentRelatedTemplate

            return `
                <div class="cm-data-info">
                    <div class="cm-data-row">
                        <span class="cm-data-label">ЭНП:</span>
                        <span class="cm-data-value">${pageData.sealNumber}</span>
                    </div>
                    <div class="cm-data-row">
                        <span class="cm-data-label">${this.regulationType === 'D7' ? 'Процедура:' : 'Тип перевозки:'}</span>
                        <span class="cm-data-value">${this.regulationType === 'D7' ? pageData.transportProcedure : pageData.transportType}</span>
                    </div>
                    <div class="cm-data-row">
                        <span class="cm-data-label">Номер перевозки:</span>
                        <span class="cm-data-value">${pageData.orderNumber}</span>
                    </div>
                    ${this.regulationType === 'D7' ? `
                    <div class="cm-data-row">
                        <span class="cm-data-label">Точка активации:</span>
                        <span class="cm-data-value">${pageData.activationPoint}</span>
                    </div>
                    <div class="cm-data-row">
                        <span class="cm-data-label">Точка деактивации:</span>
                        <span class="cm-data-value">${pageData.deactivationPoint}</span>
                    </div>
                    <div class="cm-data-row">
                        <span class="cm-data-label">Номер ТС:</span>
                        <span class="cm-data-value">${pageData.vehicleNumber}</span>
                    </div>
                    ` : `
                    <div class="cm-data-row">
                        <span class="cm-data-label">Пункт въезда:</span>
                        <span class="cm-data-value">${pageData.entryCheckpointType} ${pageData.entryCheckpointName}</span>
                    </div>
                    <div class="cm-data-row">
                        <span class="cm-data-label">Пункт выезда:</span>
                        <span class="cm-data-value">${pageData.checkpointType} ${pageData.checkpointName}</span>
                    </div>
                    `}
                </div>

                <form id="cm-form">
                    ${this.renderFields(template.fields, pageData)}
                </form>

                <div class="cm-preview">
                    <div class="cm-preview-title">Предпросмотр сообщения</div>
                    <div id="cm-preview-text" class="cm-preview-text"></div>
                </div>

                ${hasRelated ? this.renderRelatedSection(template) : ''}
            `
        }

        renderFields(fields, pageData) {
            return fields
                .map((field) => {
                    // Скрываем поле если не соответствует типу транспорта
                    if (field.showIfTransport && field.showIfTransport !== pageData.transportType) {
                        return ''
                    }

                    // Скрываем поле если не соответствует статусу перевозки
                    if (field.showIfStatus && field.showIfStatus !== pageData.transportStatus) {
                        return ''
                    }

                    const hidden = this.isFieldHidden(field) ? 'cm-hidden' : ''
                    const halfWidth = field.halfWidth ? 'cm-form-group-half' : ''

                    const highlightClass = field.highlight
                        ? (field.highlightColor === 'red' ? 'cm-checkbox-highlight-red' : field.highlightColor === 'orange' ? 'cm-checkbox-highlight-orange' : 'cm-checkbox-highlight')
                        : ''

                    switch (field.type) {
                        case 'number':
                        case 'text': {
                            const datalistId = field.datalist ? `datalist-${field.id}` : ''
                            const datalistAttr = datalistId ? `list="${datalistId}"` : ''
                            const datalistHtml = field.datalist
                                ? `<datalist id="${datalistId}">${field.datalist.map(v => `<option value="${v}">`).join('')}</datalist>`
                                : ''
                            const clearBtn = field.datalist
                                ? `<button type="button" class="cm-clear-btn cm-hidden" data-clear="field-${field.id}">&times;</button>`
                                : ''
                            return `
                                <div class="cm-form-group ${hidden} ${halfWidth}" data-field="${field.id}" data-showif="${field.showIf || ''}" data-hideif="${field.hideIf || ''}">
                                    <label class="cm-label">${field.label}${field.required ? ' *' : ''}</label>
                                    <div class="cm-input-wrap">
                                        <input type="${field.type}" class="cm-input"
                                            id="field-${field.id}"
                                            placeholder="${field.placeholder || ''}"
                                            ${datalistAttr}
                                            ${field.required ? 'required' : ''}>
                                        ${clearBtn}
                                    </div>
                                    ${datalistHtml}
                                </div>
                            `
                        }

                        case 'textarea':
                            return `
                                <div class="cm-form-group ${hidden}" data-field="${field.id}" data-showif="${field.showIf || ''}" data-hideif="${field.hideIf || ''}">
                                    <label class="cm-label">${field.label}</label>
                                    <textarea class="cm-textarea"
                                        id="field-${field.id}"
                                        placeholder="${field.placeholder || ''}"></textarea>
                                </div>
                            `

                        case 'checkbox':
                            return `
                                <div class="cm-form-group ${hidden} ${halfWidth} ${highlightClass}" data-field="${field.id}" data-showif="${field.showIf || ''}" data-hideif="${field.hideIf || ''}">
                                    <div class="cm-checkbox-group">
                                        <input type="checkbox" class="cm-checkbox"
                                            id="field-${field.id}"
                                            ${field.default ? 'checked' : ''}>
                                        <label class="cm-checkbox-label" for="field-${field.id}">${field.label}</label>
                                    </div>
                                </div>
                            `

                        case 'radio': {
                            const defaultVal = field.defaultByStatus
                                ? (field.defaultByStatus[pageData.transportStatus] || field.defaultByStatus['_default'] || field.options[0].value)
                                : field.options[0].value
                            return `
                                <div class="cm-form-group ${hidden} ${halfWidth}" data-field="${field.id}" data-showif="${field.showIf || ''}" data-hideif="${field.hideIf || ''}">
                                    <label class="cm-label">${field.label}</label>
                                    <div class="cm-radio-group">
                                        ${field.options.map((opt) => `
                                            <label class="cm-radio-label">
                                                <input type="radio" class="cm-radio" name="field-${field.id}" value="${opt.value}" ${opt.value === defaultVal ? 'checked' : ''}>
                                                ${opt.label}
                                            </label>
                                        `).join('')}
                                    </div>
                                </div>
                            `
                        }

                        case 'select':
                            return `
                                <div class="cm-form-group ${hidden} ${halfWidth}" data-field="${field.id}" data-showif="${field.showIf || ''}" data-hideif="${field.hideIf || ''}">
                                    <label class="cm-label">${field.label}</label>
                                    <select class="cm-input" id="field-${field.id}">
                                        ${field.options.map((opt) => `<option value="${opt.value}">${opt.label}</option>`).join('')}
                                    </select>
                                </div>
                            `

                        case 'datetime':
                            return `
                                <div class="cm-form-group ${hidden}" data-field="${field.id}" data-showif="${field.showIf || ''}" data-hideif="${field.hideIf || ''}">
                                    <label class="cm-label">${field.label}${field.required ? ' *' : ''}</label>
                                    <input type="datetime-local" class="cm-input"
                                        id="field-${field.id}"
                                        ${field.required ? 'required' : ''}>
                                </div>
                            `

                        case 'label':
                            return `
                                <div class="cm-form-group ${hidden}" data-field="${field.id}" data-showif="${field.showIf || ''}" data-hideif="${field.hideIf || ''}">
                                    <label class="cm-label">${field.label}</label>
                                </div>
                            `

                        default:
                            return ''
                    }
                })
                .join('')
        }

        renderRelatedSection(template) {
            const related = Object.values(template.relatedTemplates)
            if (related.length === 0) return ''

            return `
                <div class="cm-related-section">
                    <div class="cm-related-title">Связанные сообщения</div>
                    <ul class="cm-list">
                        ${related
                            .map(
                                (tpl) => `
                            <li class="cm-list-item cm-related-item" data-related="${tpl.id}">
                                <div class="cm-list-content">
                                    <div class="cm-list-name">${tpl.name}</div>
                                    ${tpl.description ? `<div class="cm-list-desc">${tpl.description}</div>` : ''}
                                </div>
                                <span class="cm-list-arrow">›</span>
                            </li>
                        `
                            )
                            .join('')}
                    </ul>
                </div>
            `
        }

        renderFormFooter(template) {
            return `
                <button type="button" class="cm-btn cm-btn-secondary" id="cm-back">Назад</button>
                <button type="button" class="cm-btn cm-btn-primary" id="cm-copy">Копировать</button>
            `
        }

        // ========== Общие методы ==========

        createModal({ title, subtitle, showBack, body, footer }) {
            if (this.overlay) {
                this.overlay.remove()
            }

            this.overlay = document.createElement('div')
            this.overlay.className = 'cm-overlay'
            this.overlay.addEventListener('click', (e) => {
                if (e.target === this.overlay) this.minimize()
            })

            this.container = document.createElement('div')
            this.container.className = 'cm-modal'
            this.container.innerHTML = `
                <div class="cm-header">
                    <div>
                        <h3 class="cm-title">${title}</h3>
                        ${subtitle ? `<div class="cm-subtitle">${subtitle}</div>` : ''}
                    </div>
                    <div class="cm-header-buttons">
                        <button class="cm-minimize" title="Свернуть">−</button>
                        <button class="cm-close" title="Закрыть">&times;</button>
                    </div>
                </div>
                <div class="cm-body">
                    ${body}
                </div>
                ${footer ? `<div class="cm-footer">${footer}</div>` : ''}
            `

            // Обработчики
            this.container.querySelector('.cm-close').addEventListener('click', () => this.close())
            this.container.querySelector('.cm-minimize').addEventListener('click', () => this.minimize())

            // Категории
            this.container.querySelectorAll('[data-category]').forEach((item) => {
                item.addEventListener('click', () => {
                    this.showTemplates(item.dataset.category)
                })
            })

            // Шаблоны
            this.container.querySelectorAll('[data-template]').forEach((item) => {
                item.addEventListener('click', () => {
                    this.showForm(item.dataset.template)
                })
            })

            // Связанные шаблоны
            this.container.querySelectorAll('[data-related]').forEach((item) => {
                item.addEventListener('click', () => {
                    this.showForm(item.dataset.related, true)
                })
            })

            // Кнопки формы
            const backBtn = this.container.querySelector('#cm-back')
            if (backBtn) {
                backBtn.addEventListener('click', () => this.goBack())
            }

            const copyBtn = this.container.querySelector('#cm-copy')
            if (copyBtn) {
                copyBtn.addEventListener('click', () => this.copyMessage())
            }

            // Поля формы
            this.container.querySelectorAll('input:not(#cm-search), textarea, select').forEach((input) => {
                input.addEventListener('input', () => this.updatePreview())
                input.addEventListener('change', () => this.updatePreview())
            })

            // Кнопки очистки для полей с datalist
            this.container.querySelectorAll('.cm-clear-btn').forEach((btn) => {
                const inputId = btn.dataset.clear
                const input = this.container.querySelector(`#${inputId}`)
                if (!input) return

                const toggle = () => btn.classList.toggle('cm-hidden', !input.value)
                input.addEventListener('input', toggle)
                input.addEventListener('change', toggle)
                toggle()

                btn.addEventListener('click', () => {
                    input.value = ''
                    input.focus()
                    btn.classList.add('cm-hidden')
                    this.updatePreview()
                })
            })

            // Поиск по шаблонам
            const searchInput = this.container.querySelector('#cm-search')
            if (searchInput) {
                searchInput.addEventListener('input', (e) => {
                    const query = e.target.value.toLowerCase().trim()
                    const items = this.container.querySelectorAll('#cm-templates-list .cm-list-item')
                    items.forEach((item) => {
                        const searchText = item.dataset.search || ''
                        if (query === '' || searchText.includes(query)) {
                            item.classList.remove('cm-hidden-search')
                        } else {
                            item.classList.add('cm-hidden-search')
                        }
                    })
                })
            }

            this.overlay.appendChild(this.container)
            document.body.appendChild(this.overlay)
        }

        // Проверяет, скрыто ли поле по условиям showIf/hideIf/etc.
        isFieldHidden(field) {
            let hidden = false
            if (field.showIf && !this.fieldValues[field.showIf]) hidden = true
            if (field.showIfValue) {
                const { field: f, value: v } = field.showIfValue
                hidden = this.fieldValues[f] !== v
            }
            if (field.hideIf && this.fieldValues[field.hideIf]) hidden = true
            if (field.hideIfAny && field.hideIfAny.some(id => this.fieldValues[id])) hidden = true
            if (field.hideIfAll && field.hideIfAll.every(id => this.fieldValues[id])) hidden = true
            if (field.showIfAny && field.showIfAny.some(id => this.fieldValues[id])) hidden = false
            return hidden
        }

        // Сбрасывает значение поля (при скрытии)
        resetField(field) {
            if (field.type === 'radio') {
                const first = this.container.querySelector(`input[name="field-${field.id}"]`)
                if (first) {
                    first.checked = true
                    this.fieldValues[field.id] = first.value
                }
                return
            }

            const el = this.container.querySelector(`#field-${field.id}`)
            if (!el) return

            if (field.type === 'checkbox') {
                const defaultVal = field.default !== undefined ? field.default : false
                el.checked = defaultVal
                this.fieldValues[field.id] = defaultVal
            } else {
                el.value = ''
                this.fieldValues[field.id] = ''
            }
        }

        updatePreview() {
            const template = this.currentRelatedTemplate || this.currentTemplate
            if (!template) return

            const pageData = this.dataExtractor.extract()

            // Собираем значения полей
            template.fields.forEach((field) => {
                if (field.type === 'radio') {
                    const checked = this.container.querySelector(`input[name="field-${field.id}"]:checked`)
                    this.fieldValues[field.id] = checked ? checked.value : ''
                    return
                }

                const el = this.container.querySelector(`#field-${field.id}`)
                if (!el) return

                if (field.type === 'checkbox') {
                    this.fieldValues[field.id] = el.checked
                } else {
                    this.fieldValues[field.id] = el.value
                }

                // Показ/скрытие зависимых полей и очистка скрытых
                if (field.type === 'checkbox' || field.type === 'radio') {
                    template.fields.forEach((f) => {
                        if (f.showIfTransport && f.showIfTransport !== pageData.transportType) return
                        if (f.showIfStatus && f.showIfStatus !== pageData.transportStatus) return

                        const group = this.container.querySelector(`[data-field="${f.id}"]`)
                        if (!group) return

                        const shouldHide = this.isFieldHidden(f)
                        const wasHidden = group.classList.contains('cm-hidden')
                        group.classList.toggle('cm-hidden', shouldHide)

                        // Очищаем поле при скрытии
                        if (shouldHide && !wasHidden) {
                            this.resetField(f)
                        }
                    })
                }
            })

            const message = template.generate(pageData, this.fieldValues)
            const previewEl = this.container.querySelector('#cm-preview-text')
            if (previewEl) {
                previewEl.innerHTML = message.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/\?\?\?/g, '<span class="cm-missing">???</span>')
            }

            // Обновляем состояние кнопки копирования
            this.updateCopyButtonState(template, pageData)
        }

        updateCopyButtonState(template, pageData) {
            const copyBtn = this.container.querySelector('#cm-copy')
            if (!copyBtn) return

            const isValid = this.isFormValid(template, pageData)
            copyBtn.disabled = !isValid
        }

        isFormValid(template, pageData) {
            // Если "Вышла на связь" - всегда валидно
            if (this.fieldValues.connectionRestored) {
                return true
            }

            // Если перевозка завершена - нужна только дата (только при статусе "Завершена")
            if (pageData.transportStatus === 'Завершена' && this.fieldValues.transportCompleted) {
                return !!this.fieldValues.lastConnectionDate
            }

            // Проверяем все required поля
            for (const field of template.fields) {
                // Пропускаем скрытые поля
                if (field.showIfTransport && field.showIfTransport !== pageData.transportType) continue
                if (field.showIfStatus && field.showIfStatus !== pageData.transportStatus) continue
                if (this.isFieldHidden(field)) continue

                // Проверка required полей
                if (field.required) {
                    const value = this.fieldValues[field.id]
                    if (!value || value.toString().trim() === '') {
                        return false
                    }
                    // Минимум 6 символов для textarea
                    if (field.type === 'textarea' && value.toString().trim().length < 6) {
                        return false
                    }
                }
            }

            // Проверка слов водителя (для fourHours, если дозвонился)
            if (this.fieldValues.driverCalled) {
                const driverWords = this.fieldValues.driverWords || ''
                if (driverWords.trim().length < 6) {
                    return false
                }
            }

            // Проверка для fourHoursAfterActivation - должен быть хотя бы один чекбокс или слова (мин. 6 символов)
            if (template.id === 'fourHoursAfterActivation') {
                const hasCheckbox = this.fieldValues.properlyInstalled ||
                                    this.fieldValues.lockClosed ||
                                    this.fieldValues.poorConnection
                const wordsLength = (this.fieldValues.employeeWords || '').trim().length
                const hasValidWords = wordsLength >= 6

                // Если есть текст, но меньше 6 символов - невалидно
                if (wordsLength > 0 && wordsLength < 6) {
                    return false
                }

                // Должен быть хотя бы чекбокс или валидные слова
                if (!hasCheckbox && !hasValidWords) {
                    return false
                }
            }

            // Проверка для oneHourAfterActivation
            if (template.id === 'oneHourAfterActivation') {
                const hasEmployeeCheckbox = this.fieldValues.properlyInstalled ||
                                            this.fieldValues.lockClosed ||
                                            this.fieldValues.vehicleLeft ||
                                            this.fieldValues.cantInspect
                const hasOtherCheckbox = this.fieldValues.poorConnection ||
                                         this.fieldValues.hasSecondSeal
                const wordsLength = (this.fieldValues.employeeWords || '').trim().length
                const hasValidWords = wordsLength >= 6

                // Если есть текст, но меньше 6 символов - невалидно
                if (wordsLength > 0 && wordsLength < 6) {
                    return false
                }

                // Если вторая ЭНП отмечена, нужен номер
                if (this.fieldValues.hasSecondSeal) {
                    const secondSealNumber = (this.fieldValues.secondSealNumber || '').trim()
                    if (!secondSealNumber) {
                        return false
                    }
                }

                // Должна быть хоть какая-то информация
                const hasAnyInfo = (this.fieldValues.hasEmployeeInfo && (hasEmployeeCheckbox || hasValidWords)) ||
                                   hasOtherCheckbox ||
                                   this.fieldValues.hasSecondSeal

                if (!hasAnyInfo) {
                    return false
                }
            }

            return true
        }

        async copyMessage() {
            const previewEl = this.container.querySelector('#cm-preview-text')
            if (!previewEl) return

            const text = previewEl.innerText
            const copyBtn = this.container.querySelector('#cm-copy')

            try {
                await navigator.clipboard.writeText(text)
                this.showCopySuccess(copyBtn)
            } catch (err) {
                // Fallback
                const textarea = document.createElement('textarea')
                textarea.value = text
                textarea.style.cssText = 'position:fixed;opacity:0'
                document.body.appendChild(textarea)
                textarea.select()
                document.execCommand('copy')
                document.body.removeChild(textarea)
                this.showCopySuccess(copyBtn)
            }
        }

        showCopySuccess(btn) {
            const originalText = btn.textContent
            btn.textContent = 'Скопировано!'
            btn.classList.add('cm-copied')
            setTimeout(() => {
                btn.textContent = originalText
                btn.classList.remove('cm-copied')
            }, 2000)
        }

        close() {
            this.stopUrlWatch()
            if (this.overlay) {
                this.overlay.remove()
                this.overlay = null
                this.container = null
            }
            if (this.minimizedElement) {
                this.minimizedElement.remove()
                this.minimizedElement = null
            }
            this.isMinimized = false
            this.navigationStack = []
            this.fieldValues = {}
            this.currentCategory = null
            this.currentTemplate = null
            this.currentRelatedTemplate = null
            this.regulationType = null
            this.lastOrderId = null
        }

        minimize() {
            if (!this.overlay || this.isMinimized) return

            // Скрываем основное окно
            this.overlay.style.display = 'none'
            this.isMinimized = true

            // Создаём свёрнутую плашку
            this.minimizedElement = document.createElement('div')
            this.minimizedElement.className = 'cm-minimized'

            // Формируем текст плашки
            let label = 'Catch Me'
            if (this.currentTemplate) {
                label = this.currentTemplate.name
                if (label.length > 30) {
                    label = label.substring(0, 30) + '...'
                }
            } else if (this.currentCategory) {
                label = this.currentCategory.name
            }

            this.minimizedElement.innerHTML = `
                <span class="cm-minimized-icon">📋</span>
                <span>${label}</span>
                <span class="cm-minimized-close">&times;</span>
            `

            // Клик по плашке - разворачиваем
            this.minimizedElement.addEventListener('click', (e) => {
                // Если кликнули на крестик - закрываем полностью
                if (e.target.classList.contains('cm-minimized-close')) {
                    this.close()
                } else {
                    this.restore()
                }
            })

            document.body.appendChild(this.minimizedElement)

            // Отслеживаем смену перевозки
            this.startUrlWatch()
        }

        startUrlWatch() {
            this.stopUrlWatch()
            this.urlWatchInterval = setInterval(() => {
                const currentOrderId = this.getOrderIdFromUrl()
                if (this.lastOrderId && this.lastOrderId !== currentOrderId) {
                    this.close()
                }
            }, 1000)
        }

        stopUrlWatch() {
            if (this.urlWatchInterval) {
                clearInterval(this.urlWatchInterval)
                this.urlWatchInterval = null
            }
        }

        restore() {
            if (!this.isMinimized) return

            // Проверяем, изменился ли ID перевозки
            const currentOrderId = this.getOrderIdFromUrl()
            if (this.lastOrderId && this.lastOrderId !== currentOrderId) {
                // Перевозка изменилась - закрываем форму полностью
                this.close()
                return
            }

            // Удаляем свёрнутую плашку
            if (this.minimizedElement) {
                this.minimizedElement.remove()
                this.minimizedElement = null
            }

            this.stopUrlWatch()

            // Показываем основное окно
            if (this.overlay) {
                this.overlay.style.display = 'flex'
            }

            this.isMinimized = false

            // Обновляем данные страницы в форме (если открыта форма шаблона)
            if (this.currentTemplate && this.container) {
                this.refreshPageData()
            }
        }

        refreshPageData() {
            const pageData = this.dataExtractor.extract()
            const dataInfo = this.container.querySelector('.cm-data-info')
            if (dataInfo) {
                dataInfo.innerHTML = `
                    <div class="cm-data-row">
                        <span class="cm-data-label">ЭНП:</span>
                        <span class="cm-data-value">${pageData.sealNumber}</span>
                    </div>
                    <div class="cm-data-row">
                        <span class="cm-data-label">${this.regulationType === 'D7' ? 'Процедура:' : 'Тип перевозки:'}</span>
                        <span class="cm-data-value">${this.regulationType === 'D7' ? pageData.transportProcedure : pageData.transportType}</span>
                    </div>
                    <div class="cm-data-row">
                        <span class="cm-data-label">Номер перевозки:</span>
                        <span class="cm-data-value">${pageData.orderNumber}</span>
                    </div>
                    ${this.regulationType === 'D7' ? `
                    <div class="cm-data-row">
                        <span class="cm-data-label">Точка активации:</span>
                        <span class="cm-data-value">${pageData.activationPoint}</span>
                    </div>
                    <div class="cm-data-row">
                        <span class="cm-data-label">Точка деактивации:</span>
                        <span class="cm-data-value">${pageData.deactivationPoint}</span>
                    </div>
                    <div class="cm-data-row">
                        <span class="cm-data-label">Номер ТС:</span>
                        <span class="cm-data-value">${pageData.vehicleNumber}</span>
                    </div>
                    ` : `
                    <div class="cm-data-row">
                        <span class="cm-data-label">Пункт въезда:</span>
                        <span class="cm-data-value">${pageData.entryCheckpointType} ${pageData.entryCheckpointName}</span>
                    </div>
                    <div class="cm-data-row">
                        <span class="cm-data-label">Пункт выезда:</span>
                        <span class="cm-data-value">${pageData.checkpointType} ${pageData.checkpointName}</span>
                    </div>
                    `}
                `
            }
            // Обновляем предпросмотр с новыми данными
            this.updatePreview()
        }
    }

    // ========================================
    // Кнопка "Сообщить"
    // ========================================

    class ButtonManager {
        constructor(modal) {
            this.modal = modal
        }

        createButton() {
            if (document.getElementById('catch-me-container')) return

            // Контейнер для кнопки и версии
            const container = document.createElement('div')
            container.id = 'catch-me-container'
            container.style.cssText = `
                position: fixed;
                top: 5px;
                left: 20px;
                display: flex;
                align-items: center;
                gap: 8px;
                z-index: 1000;
            `

            // Кнопка
            const btn = document.createElement('button')
            btn.id = 'catch-me-btn'
            btn.textContent = 'Сообщить'
            btn.style.cssText = `
                background: #1890ff;
                color: white;
                border: none;
                border-radius: 5px;
                padding: 3px 20px;
                cursor: pointer;
                font-size: 14px;
                box-shadow: none;
                transition: all 0.2s;
            `

            btn.addEventListener('mouseenter', () => {
                btn.style.background = '#40a9ff'
            })

            btn.addEventListener('mouseleave', () => {
                btn.style.background = '#1890ff'
            })

            btn.addEventListener('click', () => this.modal.open())

            // Версия
            const version = document.createElement('span')
            version.style.cssText = `
                font-size: 10px;
                color: #999;
            `
            version.textContent = `v${GM_info.script.version}`

            container.appendChild(btn)
            container.appendChild(version)

            document.body.appendChild(container)
        }
    }

    // ========================================
    // Главный контроллер
    // ========================================

    class CatchMe {
        constructor() {
            this.modal = new Modal()
            this.buttonManager = new ButtonManager(this.modal)
            this.init()
        }

        init() {
            if (document.readyState === 'loading') {
                document.addEventListener('DOMContentLoaded', () => this.setup())
            } else {
                this.setup()
            }
        }

        setup() {
            const checkReady = () => {
                if (document.body) {
                    this.buttonManager.createButton()
                } else {
                    setTimeout(checkReady, 100)
                }
            }
            checkReady()
        }
    }

    // ========================================
    // Запуск
    // ========================================

    window.catchMe = new CatchMe()
})()
