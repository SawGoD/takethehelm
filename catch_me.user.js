// ==UserScript==
// @name         Catch Me - Генератор сообщений
// @namespace    http://tampermonkey.net/
// @version      2.15.0
// @description  Генерация сообщений о нарушениях для чата
// @author       SawGoD
// @match        https://sa.transit.crcp.ru/*
// @icon         https://www.google.com/s2/favicons?sz=64&domain=crcp.ru
// @updateURL    https://raw.githubusercontent.com/SawGoD/takethehelm/main/catch_me.user.js
// @downloadURL  https://raw.githubusercontent.com/SawGoD/takethehelm/main/catch_me.user.js
// @grant        GM_info
// ==/UserScript==

// ========================================
// CHANGELOG
// ========================================
//
// 2.15.0
//   feat: флаг template.disabled — шаблон в списке гасится и не открывается
//   feat: "Не согласовано срезание" временно disabled (включить — убрать `disabled: true`)
//
// 2.14.1
//   refactor: радио ЦРЦП/БТС/ГПТИ/ИКТТ встроено в блок чекбокса "Согласовано только" (inlineRadio)
//   style: радио всегда видимы; при неактивном чекбоксе — opacity 0.4 + pointer-events:none
//
// 2.14.0
//   feat: чекбокс "Согласовано только" с выбором ЦРЦП/БТС/ГПТИ/ИКТТ — заменяет
//         "Срезание согласовано с {agreedWith}." на "Срезание согласовано {org} в одностороннем порядке."
//   style: пустая строка перед "Срезание согласовано с …" в сообщении
//   style: highlightColor 'shimmer' — мягкий блик, оранжевый по умолчанию, синий когда выбрано
//   style: чекбокс "Присутствие Агента" использует режим shimmer
//
// 2.13.0
//   feat: GPTI-пломбы — orgLabel "ГПТИ", "Срезание согласовано с КР"
//   feat: getSealNumbers() — детектирует GPTI по маркеру (GPTI), отдаёт gptiSeals
//   feat: GPTI считается non-CRCP — sealLabel "НП", скрытие ПО и температуры
//
// 2.12.2
//   feat: тег для чата — процедура "Не указано" → строка "Статус: {статус}" вместо "Процедура:"
//   feat: умолчание "Не указано" для нераспознанных статусов перевозки
//
// 2.12.1
//   fix: дублирующиеся номера пломб на странице сжимаются до уникальных
//
// 2.12.0
//   feat: "Тег для чата" — мини-форма с выбором Процедуры и пломб (если несколько)
//   feat: предпросмотр тега в реальном времени
//   feat: умолчание Процедуры зависит от статуса перевозки
//
// 2.11.2
//   feat: перевозки EE/ добавлены в автоопределение Д7
//
// 2.11.1
//   fix: тег для чата — префикс Д7/СЕ определяется из процедуры перевозки, а не номера
//
// 2.11.0
//   refactor: SEAL_TYPES — расширяемый маппинг типов пломб (orgLabel, agreedWith)
//   refactor: Utils.getSealType() — определение типа по выбранным пломбам
//   feat: IKTT → "ИКТТ" + "Согласовано с РК", BTS → "БТС" + "Согласовано с РБ"
//   refactor: убраны inline-костыли isBts/orgLabel/allIktt из generate()
//
// 2.10.0
//   feat: IKTT-пломбы — orgLabel "ИКТТ" вместо "БТС" в согласованном срезании
//   feat: "Срезание согласовано с {территория}" вместо хардкода "РБ"
//
// 2.9.3
//   fix: тег для чата — поиск процедуры по подстроке вместо точного совпадения
//
// 2.9.2
//   style: кнопка "Тег для чата" перенесена в footer модалки
//
// 2.9.1
//   feat: территории РК и КР добавлены в datalist выбора территории
//
// 2.9.0
//   feat: кнопка "Тег для чата" на экране категорий Д7 & Соглашение
//   feat: копирование тега (СЕ:ТТ/СЕ:ВТ/Д7:ТТ/...) с перевозкой, ЭНП и ТС в буфер обмена
//
// 2.8.0
//   feat: per-seal поля (ПО, связь, температура) для множественных пломб в срезании
//   feat: renderPerSealGroups/renderPerSealField — группы полей по каждой пломбе
//   feat: "была срезана" → "были срезаны" при 2+ выбранных пломбах
//   feat: per-seal валидация required полей
//   style: карточки пломб по 2 в ряд (flex-wrap grid)
//   feat: IKTT-пломбы — скрытие ПО и температуры (hideIfBts + isNonCrcp)
//   refactor: Д7 → "Д7 & Соглашение" в заголовке регуляции
//   feat: перевозки KZ добавлены в автоопределение Д7
//
// 2.7.0
//   feat: поддержка множественных ЭНП/НП — чекбоксы выбора пломб при 2+ на странице
//   feat: getSealNumbers() извлекает все пломбы, renderSealRow() условный рендер
//   feat: selectedSeals подставляется в сообщение и письмо через join(', ')
//
// 2.6.7
//   refactor: чекбокс "Присутствие Агента" перемещён перед "Причина", убран halfWidth
//
// 2.6.6
//   style: синий highlight для чекбокса "Присутствие Агента"
//
// 2.6.5
//   feat: withDatePicker — кнопка-календарик рядом с текстовым полем даты
//
// 2.6.4
//   feat: "Последний выход на связь" — текстовое поле с парсингом разных форматов даты
//   feat: Utils.formatDateTime — парсинг DD.MM.YYYY HH:MM, YYYY-MM-DD HH:MM, datetime-local
//
// 2.6.3
//   feat: необязательное поле "Температура в телеметрии" для согласованного срезания
//
// 2.6.2
//   style: disabled-стиль для cm-btn-secondary (цвет, курсор, прозрачность)
//
// 2.6.1
//   fix: кнопка "Для письма" неактивна без территории
//   style: белый цвет текста "Скопировано"
//
// 2.6.0
//   feat: кнопка "Для письма" в согласованном срезании — копирует краткое сообщение
//   style: "Скопировано!" → "Скопировано"
//
// 2.5.6
//   feat: Д7 срезание — обязательные причина (requiredOneOf) и действия (minLength: 6)
//   feat: поддержка requiredOneOf и minLength в валидации формы
//
// 2.5.5
//   style: анимация переливания для плейсхолдера ▮▮▮
//
// 2.5.4
//   style: плейсхолдер "???" заменён на "▮▮▮"
//
// 2.5.3
//   fix: место срезания не отображалось при дефолтном "Промежуточное размыкание"
//   fix: сброс скрытых чекбоксов при инициализации формы
//
// 2.5.2
//   feat: hideIfBts — скрытие версии ПО в форме и сообщении при номере > 1000000
//   feat: "Срезание согласовано с РБ." в сообщении согласованного срезания БТС
//
// 2.5.1
//   feat: Д7 срезание — НП/БТС вместо ЭНП/ЦРЦП при номере > 1000000
//
// 2.5.0
//   feat: hideIfStatuses — скрытие полей по статусу перевозки
//   feat: процедура скрыта при Деактивирована/Распломбирована/Завершена, чекбокс "В точке деактивации" с галочкой
//   refactor: удалён неиспользуемый механизм defaultByValue
//   refactor: унифицирован defaultByStatus для checkbox и radio в showForm
//   refactor: restoreFieldDefault поддерживает defaultByStatus
//
// 2.4.0
//   feat: чекбокс "В точке деактивации" для места срезания (согласовано/не согласовано)
//   feat: дефолт чекбокса привязан к процедуре (Завершение → checked) и статусу перевозки
//   feat: defaultByValue — дефолт чекбокса зависит от значения другого поля (radio)
//   feat: defaultByStatus для чекбоксов
//   feat: автопереключение чекбокса при смене radio процедуры
//
// 2.3.0
//   style: анимация сворачивания модалки к кнопке (scale + translate + fade)
//   style: анимация разворачивания из кнопки обратно в центр
//
// 2.2.2
//   fix: принудительное ограничение ввода min/max для number полей через JS
//
// 2.2.1
//   fix: заряд АКБ ограничен 0-100 во всех шаблонах (ПП1877 и Д7)
//   feat: поддержка min/max атрибутов для number полей
//
// 2.2.0
//   feat: превью сообщения отображается справа от формы (side-by-side layout)
//   style: модалка расширена до 960px, превью sticky с прокруткой
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

    // Типы пломб: orgLabel — организация, agreedWith — страна согласования срезания
    const SEAL_TYPES = {
        IKTT:  { orgLabel: 'ИКТТ', agreedWith: 'РК' },
        GPTI:  { orgLabel: 'ГПТИ', agreedWith: 'КР' },
        BTS:   { orgLabel: 'БТС',  agreedWith: 'РБ' },
        CRCP:  { orgLabel: 'ЦРЦП', agreedWith: null },
    }

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
                                : '▮▮▮'
                            return `ЭНП ${data.sealNumber} (перевозка ${data.transportType}) ${data.orderNumber} Перевозка завершена штатно на пункте выезда ${data.checkpointType} ${data.checkpointName}. На связь с ${dateStr} и до конца маршрута не выходила. Трек на картографической основе обрывается на месте последнего выхода ЭНП на связь.`
                        }

                        // Для ЖД - без информации о водителе
                        if (data.transportType === 'ЖД') {
                            return `ЭНП ${data.sealNumber} (перевозка ${data.transportType}) ${data.orderNumber} более 4-х часов не выходит на связь. До пункта выезда ${data.checkpointType} ${data.checkpointName} ${fields.distance || '▮▮▮'} км. Нарушение подтверждено. Отправлено уведомление в ФТС.`
                        }

                        // Для Авто - с информацией о водителе
                        const driverContact = fields.driverCalled
                            ? `Со слов водителя: ${fields.driverWords || ''}`
                            : 'До водителя дозвониться не удалось'

                        return `ЭНП ${data.sealNumber} (перевозка ${data.transportType}) ${data.orderNumber} более 4-х часов не выходит на связь. До пункта выезда ${data.checkpointType} ${data.checkpointName} ${fields.distance || '▮▮▮'} км. ${driverContact}. Нарушение подтверждено. Отправлено уведомление в ФТС.`
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
                            return `ЭНП ${data.sealNumber} (перевозка ${data.transportType}) ${data.orderNumber} , ПО ${fields.firmwareVersion || '▮▮▮'}. Перевозка завершена штатно на пункте выезда ${data.checkpointType} ${data.checkpointName}, на связь с момента активации до конца маршрута не выходила. Трек на картографической основе не прорисовался.`
                        }

                        const dateStr = fields.lastConnectionDate
                            ? new Date(fields.lastConnectionDate).toLocaleString('ru-RU', {
                                day: '2-digit',
                                month: '2-digit',
                                year: 'numeric',
                                hour: '2-digit',
                                minute: '2-digit'
                            }).replace(',', '')
                            : '▮▮▮'

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
                            min: 0,
                            max: 100,
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
                        return `ЭНП ${data.sealNumber} (перевозка ${data.transportType}) ${data.orderNumber} ПО: ${fields.firmwareVersion || '▮▮▮'} Появилось нарушение "Низкий уровень заряда аккумулятора ${fields.batteryLevel || '▮▮▮'}%". Нарушение отклонено. До пункта выезда ${data.checkpointType} ${data.checkpointName} ${fields.distance || '▮▮▮'} км.`
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
                                : '▮▮▮'
                            const dateToStr = fields.dateTo
                                ? new Date(fields.dateTo).toLocaleString('ru-RU', {
                                    day: '2-digit', month: '2-digit', year: 'numeric',
                                    hour: 'numeric', minute: '2-digit'
                                }).replace(',', '')
                                : '▮▮▮'
                            return `ЭНП ${data.sealNumber} (перевозка ${data.transportType}) ${data.orderNumber}, ПО: ${fields.firmwareVersion || '▮▮▮'}. До пункта выезда ${data.checkpointType} ${data.checkpointName} ${fields.distance || '▮▮▮'} км. В период с ${dateFromStr} ч. до ${dateToStr} ч. поступило ${fields.signalCount || '▮▮▮'} сигналов о нарушении: "Взлом запорного штыря". Нарушения подтверждены.`
                        }

                        // Не дозвонился до водителя
                        if (!fields.driverReached) {
                            return `ЭНП ${data.sealNumber} (перевозка ${data.transportType}) ${data.orderNumber}. ПО: ${fields.firmwareVersion || '▮▮▮'}. До пункта выезда ${data.checkpointType} ${data.checkpointName} ${fields.distance || '▮▮▮'} км. Поступило ${fields.signalCount || '▮▮▮'} сигналов о нарушении "Взлом запорного штыря". До водителя дозвониться не удалось. Нарушения подтверждены, отправлено уведомление в ФТС.`
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

                        return `ЭНП ${data.sealNumber} (перевозка ${data.transportType}) ${data.orderNumber}, ПО: ${fields.firmwareVersion || '▮▮▮'}. До пункта выезда ${data.checkpointType} ${data.checkpointName} ${fields.distance || '▮▮▮'} км. Поступил сигнал о нарушении "Взлом запорного штыря".${driverInfo} При попытке установить штыри глубже, ${alarmText}. ${confirmText}`
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
                            min: 0,
                            max: 100,
                        },
                        {
                            id: 'startBatteryLevel',
                            type: 'number',
                            label: 'АКБ Старта (%)',
                            placeholder: 'Например: 95',
                            required: true,
                            halfWidth: true,
                            min: 0,
                            max: 100,
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
                            datalist: ['РФ', 'РБ', 'РК', 'КР'],
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
                            : '▮▮▮'

                        const locationPart = fields.atCheckpoint
                            ? 'ТС на КП завершения'
                            : `До пункта завершения ${fields.distanceToEnd || '▮▮▮'} км`

                        const territory = fields.territory || '▮▮▮'
                        const freq = fields.frequency || '▮▮▮'
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
                            `ПО: ${fields.firmwareVersion || '▮▮▮'}`,
                            `Заряд АКБ: ${fields.batteryLevel || '▮▮▮'}%, АКБ Старта: ${fields.startBatteryLevel || '▮▮▮'}%`,
                            `Активирована: ${activationStr}`,
                            `ТС: ${data.vehicleNumber}`,
                            `Маршрут: ${data.activationPoint} - ${data.deactivationPoint}`,
                            `${locationPart}.`,
                            `На территории: ${territory}.`,
                            frequencyLine,
                            `Анализ: ${analysisParts.length ? analysisParts.join('. ') + '.' : '▮▮▮'}`,
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
                            datalist: ['РФ', 'РБ', 'РК', 'КР'],
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
                            hideIfBts: true,
                            perSeal: true,
                        },
                        {
                            id: 'agentPresent',
                            type: 'checkbox',
                            label: 'Присутствие Агента',
                            default: false,
                            highlight: true,
                            highlightColor: 'shimmer',
                        },
                        { id: 'reasonLabel', type: 'label', label: 'Причина', requiredOneOf: ['reasonNoConnection', 'reasonEnpFault', 'reasonBatteryDrain', 'reasonLockFault'] },
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
                                'Распломбирована': 'Завершение',
                                'Завершена': 'Завершение',
                                '_default': 'Промежуточное размыкание',
                            },
                            hideIfStatuses: ['Деактивирована', 'Распломбирована', 'Завершена'],
                        },
                        {
                            id: 'cuttingAtDeactivation',
                            type: 'checkbox',
                            label: 'В точке деактивации',
                            default: true,
                            halfWidth: true,
                            showIfValue: { field: 'procedure', value: 'Завершение' },
                        },
                        {
                            id: 'cuttingPlace',
                            type: 'text',
                            label: 'Место срезания',
                            placeholder: 'Укажите место срезания',
                            required: true,
                            hideIf: 'cuttingAtDeactivation',
                        },
                        {
                            id: 'lastConnection',
                            type: 'text',
                            label: 'Последний выход на связь',
                            placeholder: '03.02.2026 20:10',
                            required: true,
                            withDatePicker: true,
                            perSeal: true,
                        },
                        {
                            id: 'actions',
                            type: 'textarea',
                            label: 'Описание действий',
                            placeholder: 'Удалённые команды, приложение СОПТ, индикация...',
                            required: true,
                            minLength: 6,
                        },
                        {
                            id: 'unilateral',
                            type: 'checkbox',
                            label: 'Согласовано только',
                            default: false,
                            highlight: true,
                            highlightColor: 'red',
                            inlineRadio: {
                                id: 'unilateralOrg',
                                options: [
                                    { value: 'ЦРЦП', label: 'ЦРЦП' },
                                    { value: 'БТС',  label: 'БТС' },
                                    { value: 'ГПТИ', label: 'ГПТИ' },
                                    { value: 'ИКТТ', label: 'ИКТТ' },
                                ],
                                default: 'ЦРЦП',
                            },
                        },
                        {
                            id: 'telemetryTemperature',
                            type: 'text',
                            label: 'Температура в телеметрии',
                            placeholder: 'например -24',
                            perSeal: true,
                            hideIfBts: true,
                        },
                    ],

                    generate(data, fields) {
                        const sfv = data.sealFieldValues
                        const seals = data.selectedSeals || [data.sealNumber]
                        const isMulti = seals.length > 1
                        const iktt = data.ikttSeals || []
                        const gpti = data.gptiSeals || []
                        const isNonCrcp = s => Number(s) > 1000000 || iktt.includes(s) || gpti.includes(s)
                        const sealType = Utils.getSealType(seals, iktt, gpti)
                        const sealLabel = sealType === SEAL_TYPES.CRCP ? 'ЭНП' : 'НП'

                        const reasons = []
                        if (fields.reasonNoConnection) reasons.push('отсутствие связи')
                        if (fields.reasonNfcFault) reasons.push('неисправность NFC модуля')
                        if (fields.reasonEnpFault) reasons.push('неисправность ЭНП')
                        if (fields.reasonBatteryDrain) reasons.push('разряд АКБ')
                        if (fields.reasonLockFault) reasons.push('неисправность запорного механизма')

                        const cuttingPlace = fields.cuttingAtDeactivation
                            ? data.deactivationPoint
                            : (fields.cuttingPlace || '▮▮▮')

                        // ПО: comma-separated, только для CRCP пломб
                        let fwLine = null
                        if (sfv) {
                            const fwParts = seals.filter(s => !isNonCrcp(s)).map(s => sfv[s]?.firmwareVersion || '▮▮▮')
                            if (fwParts.length) fwLine = `ПО: ${fwParts.join(', ')}`
                        } else if (!isNonCrcp(seals[0])) {
                            fwLine = `ПО: ${fields.firmwareVersion || '▮▮▮'}`
                        }

                        // Per-seal блоки lastConnection + telemetryTemperature
                        const perSealLines = []
                        if (sfv) {
                            seals.forEach((s, i) => {
                                if (i > 0) perSealLines.push('')
                                const sv = sfv[s] || {}
                                const connStr = Utils.formatDateTime(sv.lastConnection)
                                perSealLines.push(`${isMulti ? s + ' ' : ''}Последний выход на связь: ${connStr}`)
                                if (!isNonCrcp(s) && /\d/.test(sv.telemetryTemperature || '')) {
                                    perSealLines.push(`Температура в последней телеметрии: ${sv.telemetryTemperature.trim()}°`)
                                }
                            })
                        } else {
                            const lastConnStr = Utils.formatDateTime(fields.lastConnection)
                            perSealLines.push(`Последний выход на связь: ${lastConnStr}`)
                            if (!isNonCrcp(seals[0]) && /\d/.test(fields.telemetryTemperature || '')) {
                                perSealLines.push(`Температура в последней телеметрии: ${fields.telemetryTemperature.trim()}°`)
                            }
                        }

                        // "была срезана" → "были срезаны"
                        const cutVerb = isMulti ? 'были срезаны' : 'была срезана'

                        const actionsText = (fields.actions || '').trim()
                        const agreedLine = fields.unilateral && fields.unilateralOrg
                            ? `Срезание согласовано ${fields.unilateralOrg} в одностороннем порядке.`
                            : (sealType.agreedWith ? `Срезание согласовано с ${sealType.agreedWith}.` : null)

                        return [
                            `@IvanB0`,
                            `@CUIM_spec1`,
                            ``,
                            `Оператором согласовано срезание ${sealLabel} ${data.sealNumber} ${sealType.orgLabel} в ${fields.territory || '▮▮▮'}`,
                            `по причине: ${reasons.length ? reasons.join(', ') : '▮▮▮'}`,
                            ``,
                            `Тип перевозок: ${data.transportProcedure}`,
                            `Перевозка: ${data.orderNumber}`,
                            `Статус перевозки: ${data.transportStatus || '▮▮▮'}`,
                            `Процедура: ${fields.procedure || '▮▮▮'}`,
                            `${sealLabel}: ${data.sealNumber}`,
                            fwLine,
                            `Присутствие Агента: ${fields.agentPresent ? 'да' : 'нет'}`,
                            `Основной номер ТС: ${data.mainVehicleNumber}`,
                            `ГО: ${data.vehicleNumber}`,
                            `КП активации: ${data.activationPoint}`,
                            `Место срезания: ${cuttingPlace}`,
                            ``,
                            actionsText ? actionsText : null,
                            actionsText && agreedLine ? `` : null,
                            agreedLine,
                            actionsText || agreedLine ? `` : null,
                            ...perSealLines,
                            ``,
                            `${sealLabel} ${data.sealNumber} ${cutVerb}`,
                        ].filter(line => line !== null).join('\n')
                    },

                    relatedTemplates: {},
                },

                notAgreed: {
                    id: 'notAgreed',
                    name: 'Не согласовано срезание',
                    disabled: true, // вернуть в работу — удалить эту строку
                    fields: [
                        {
                            id: 'territory',
                            type: 'text',
                            label: 'Территория',
                            datalist: ['РФ', 'РБ', 'РК', 'КР'],
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
                            hideIfBts: true,
                            perSeal: true,
                        },
                        { id: 'reasonLabel', type: 'label', label: 'Причина', requiredOneOf: ['reasonNoConnection', 'reasonEnpFault', 'reasonBatteryDrain', 'reasonLockFault'] },
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
                            id: 'cuttingAtDeactivation',
                            type: 'checkbox',
                            label: 'В точке деактивации',
                            defaultByStatus: { 'Деактивирована': true, 'Распломбирована': true, 'Завершена': true, '_default': false },
                            halfWidth: true,
                        },
                        {
                            id: 'cuttingPlace',
                            type: 'text',
                            label: 'Место срезания',
                            placeholder: 'Укажите место срезания',
                            required: true,
                            hideIf: 'cuttingAtDeactivation',
                        },
                        {
                            id: 'lastConnection',
                            type: 'text',
                            label: 'Последний выход на связь',
                            placeholder: '03.02.2026 20:10',
                            required: true,
                            withDatePicker: true,
                            perSeal: true,
                        },
                        {
                            id: 'reason',
                            type: 'textarea',
                            label: 'Причина отказа',
                            placeholder: 'Почему не согласовано...',
                            required: true,
                            minLength: 6,
                        },
                    ],

                    generate(data, fields) {
                        const isBts = data.isBts
                        const sealLabel = isBts ? 'НП' : 'ЭНП'
                        const sfv = data.sealFieldValues
                        const seals = data.selectedSeals || [data.sealNumber]
                        const isMulti = seals.length > 1
                        const iktt = data.ikttSeals || []
                        const gpti = data.gptiSeals || []
                        const isNonCrcp = s => Number(s) > 1000000 || iktt.includes(s) || gpti.includes(s)

                        const reasons = []
                        if (fields.reasonNoConnection) reasons.push('отсутствие связи')
                        if (fields.reasonNfcFault) reasons.push('неисправность NFC модуля')
                        if (fields.reasonEnpFault) reasons.push('неисправность ЭНП')
                        if (fields.reasonBatteryDrain) reasons.push('разряд АКБ')
                        if (fields.reasonLockFault) reasons.push('неисправность запорного механизма')

                        const cuttingPlace = fields.cuttingAtDeactivation
                            ? data.deactivationPoint
                            : (fields.cuttingPlace || '▮▮▮')

                        // ПО: comma-separated, только для CRCP пломб
                        let fwLine = null
                        if (sfv) {
                            const fwParts = seals.filter(s => !isNonCrcp(s)).map(s => sfv[s]?.firmwareVersion || '▮▮▮')
                            if (fwParts.length) fwLine = `ПО: ${fwParts.join(', ')}`
                        } else if (!isNonCrcp(seals[0])) {
                            fwLine = `ПО: ${fields.firmwareVersion || '▮▮▮'}`
                        }

                        // Per-seal lastConnection
                        const perSealConnLines = []
                        if (sfv) {
                            seals.forEach((s, i) => {
                                if (i > 0) perSealConnLines.push('')
                                const sv = sfv[s] || {}
                                const connStr = Utils.formatDateTime(sv.lastConnection)
                                perSealConnLines.push(`${isMulti ? s + ' ' : ''}Последний выход на связь: ${connStr}`)
                            })
                        } else {
                            const lastConnStr = Utils.formatDateTime(fields.lastConnection)
                            perSealConnLines.push(`Последний выход на связь: ${lastConnStr}`)
                        }

                        const lines = [
                            `Оператором НЕ согласовано срезание ${sealLabel} ${data.sealNumber} в ${fields.territory || '▮▮▮'}`,
                            `Запрос по причине: ${reasons.length ? reasons.join(', ') : '▮▮▮'}`,
                            `Тип перевозок: ${data.transportProcedure}`,
                            `Перевозка: ${data.orderNumber}`,
                            `Статус перевозки: ${data.transportStatus || '▮▮▮'}`,
                            `${sealLabel}: ${data.sealNumber}`,
                            fwLine,
                            `Основной номер ТС: ${data.mainVehicleNumber}`,
                            `ГО: ${data.vehicleNumber}`,
                            `КП активации: ${data.activationPoint}`,
                            `Место срезания: ${cuttingPlace}`,
                            ...perSealConnLines,
                            `Причина отказа: ${fields.reason || '▮▮▮'}`,
                        ]

                        return lines.filter(line => line !== null).join('\n')
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

        // Определить тип пломбы по выбранным пломбам
        getSealType(seals, ikttSeals, gptiSeals = []) {
            const allIktt = seals.length > 0 && seals.every(s => ikttSeals.includes(s))
            if (allIktt) return SEAL_TYPES.IKTT
            const allGpti = seals.length > 0 && seals.every(s => gptiSeals.includes(s))
            if (allGpti) return SEAL_TYPES.GPTI
            const allBts = seals.length > 0 && seals.every(s => Number(s) > 1000000)
            if (allBts) return SEAL_TYPES.BTS
            return SEAL_TYPES.CRCP
        },

        // Проверить есть ли связанные шаблоны
        hasRelatedTemplates(template) {
            return template.relatedTemplates && Object.keys(template.relatedTemplates).length > 0
        },

        // Сформировать тег для чата (СЕ:ТТ, Д7:ВТ, ...)
        getChatTag(transportProcedure) {
            const proc = (transportProcedure || '').trim()
            const prefix = /Декрет/i.test(proc) ? 'Д7' : 'СЕ'
            let suffix = '▮▮▮'
            if (/Таможенный транзит/i.test(proc)) suffix = 'ТТ'
            else if (/Взаимная торговля/i.test(proc)) suffix = 'ВТ'
            else if (/Экспорт/i.test(proc)) suffix = 'Экспорт'
            return `${prefix}:${suffix}`
        },

        // Парсинг даты из разных форматов → DD.MM.YYYY HH:MM
        formatDateTime(value) {
            if (!value) return '▮▮▮'
            const s = value.trim()

            // DD.MM.YYYY HH:MM[:SS]
            const ru = s.match(/^(\d{2})\.(\d{2})\.(\d{4})\s+(\d{2}):(\d{2})/)
            if (ru) return `${ru[1]}.${ru[2]}.${ru[3]} ${ru[4]}:${ru[5]}`

            // YYYY-MM-DD HH:MM[:SS] или datetime-local (YYYY-MM-DDTHH:MM)
            const iso = s.match(/^(\d{4})-(\d{2})-(\d{2})[T\s](\d{2}):(\d{2})/)
            if (iso) return `${iso[3]}.${iso[2]}.${iso[1]} ${iso[4]}:${iso[5]}`

            return s
        },
    }

    // ========================================
    // Извлечение данных со страницы
    // ========================================

    class DataExtractor {
        extract() {
            const { numbers: sealNumbers, ikttSeals, gptiSeals } = this.getSealNumbers()
            return {
                sealNumber: sealNumbers[0],
                sealNumbers,
                ikttSeals,
                gptiSeals,
                isBts: Number(sealNumbers[0]) > 1000000,
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

        getSealNumbers() {
            const els = document.querySelectorAll('div[data-title="Арендуемые ЭНП"] span')
            const numbers = []
            const ikttSeals = []
            const gptiSeals = []
            els.forEach(el => {
                const text = el.textContent
                const match = text.match(/SN:\s*0*(\d+)/)
                if (match) {
                    numbers.push(match[1])
                    if (/\(IKTT\)/i.test(text)) ikttSeals.push(match[1])
                    if (/\(GPTI\)/i.test(text)) gptiSeals.push(match[1])
                }
            })
            // Убираем дубликаты (одна пломба может встречаться несколько раз на странице)
            const uniqueNumbers = [...new Set(numbers)]
            const uniqueIktt = [...new Set(ikttSeals)]
            const uniqueGpti = [...new Set(gptiSeals)]
            return {
                numbers: uniqueNumbers.length ? uniqueNumbers : ['▮▮▮'],
                ikttSeals: uniqueIktt,
                gptiSeals: uniqueGpti,
            }
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
            return '▮▮▮'
        }

        getOrderNumber() {
            const el = document.querySelector('label.text-orderNum span.status-card-sub')
            return el ? el.textContent.trim() : '▮▮▮'
        }

        getCheckpointName() {
            const container = document.querySelector('div[data-title="Контрольные пункты"]')
            if (!container) return '▮▮▮'

            const spans = container.querySelectorAll('span')
            for (const span of spans) {
                const text = span.textContent.trim()
                if (text.startsWith('←')) {
                    let name = text.replace('←', '').trim()
                    name = name.replace(/^(МАПП|ЖДПП)\s*/i, '').trim()
                    return name
                }
            }
            return '▮▮▮'
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
            if (!container) return '▮▮▮'

            const spans = container.querySelectorAll('span')
            for (const span of spans) {
                const text = span.textContent.trim()
                if (text.startsWith('→')) {
                    let name = text.replace('→', '').trim()
                    name = name.replace(/^(МАПП|ЖДПП)\s*/i, '').trim()
                    return name
                }
            }
            return '▮▮▮'
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
            return el ? el.textContent.trim() : '▮▮▮'
        }

        getVehicleNumber() {
            const el = document.querySelector('div[data-title="Регистрационный знак прицепа или полуприцепа"]')
            return el ? el.textContent.trim() : '▮▮▮'
        }

        getActivationPoint() {
            const el = document.querySelector('div[data-title="Точка активации"]')
            if (!el) return '▮▮▮'
            const name = el.textContent.trim()
            return /СВХ|ПОСТ/i.test(name) ? name : `МАПП ${name}`
        }

        getDeactivationPoint() {
            const el = document.querySelector('div[data-title="Точка деактивации"]')
            if (!el) return '▮▮▮'
            const name = el.textContent.trim()
            return /СВХ|ПОСТ/i.test(name) ? name : `МАПП ${name}`
        }

        getTransportProcedure() {
            const el = document.querySelector('div[data-title="Процедура перевозки"]')
            return el ? el.textContent.trim() : '▮▮▮'
        }

        getRegulationType() {
            const orderNumber = this.getOrderNumber()
            if (orderNumber.startsWith('ST/')) return 'PP1877'
            if (/^(EV\/|ET\/|EE\/|BY_|KZ|KG)/.test(orderNumber)) return 'D7'
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
            this.selectedSeals = []
            this.sealFieldValues = {}
            this.ikttSeals = []
            this.gptiSeals = []
            this.navigationStack = [] // История навигации для кнопки "Назад"
            this.lastOrderId = null // ID перевозки при открытии формы
            this.urlWatchInterval = null
        }

        // Пломба не CRCP (БТС, IKTT или GPTI) — скрываем ПО и температуру
        isNonCrcp(seal) {
            return Number(seal) > 1000000 || this.ikttSeals.includes(seal) || this.gptiSeals.includes(seal)
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
                    transition: opacity 0.3s;
                }

                .cm-overlay.cm-minimizing {
                    opacity: 0;
                    pointer-events: none;
                }

                .cm-modal.cm-minimizing {
                    transition: transform 0.3s ease-in, opacity 0.3s ease-in;
                    transform: scale(0.15) translate(80vw, 60vh);
                    opacity: 0;
                }

                .cm-modal.cm-restoring {
                    animation: cm-restore 0.3s ease-out;
                }

                @keyframes cm-restore {
                    from {
                        transform: scale(0.15) translate(80vw, 60vh);
                        opacity: 0;
                    }
                    to {
                        transform: scale(1) translate(0, 0);
                        opacity: 1;
                    }
                }

                .cm-modal {
                    background: white;
                    border-radius: 8px;
                    box-shadow: 0 4px 20px rgba(0, 0, 0, 0.3);
                    max-width: 520px;
                    width: 90%;
                    max-height: 85vh;
                    overflow-y: auto;
                    transition: max-width 0.2s;
                }

                .cm-modal-wide {
                    max-width: 960px;
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

                .cm-list-item-disabled {
                    opacity: 0.45;
                    cursor: not-allowed;
                    pointer-events: none;
                    background: #fafafa;
                }

                .cm-list-badge {
                    display: inline-block;
                    font-size: 11px;
                    background: #eceff1;
                    color: #607d8b;
                    padding: 2px 6px;
                    border-radius: 3px;
                    margin-left: 6px;
                    vertical-align: middle;
                    font-weight: 500;
                    text-transform: lowercase;
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

                .cm-datepicker-btn {
                    position: absolute;
                    right: 6px;
                    background: none;
                    border: none;
                    cursor: pointer;
                    padding: 0 4px;
                    font-size: 16px;
                    line-height: 1;
                    opacity: 0.5;
                    transition: opacity 0.15s;
                }

                .cm-datepicker-btn:hover {
                    opacity: 1;
                }

                .cm-datepicker-hidden {
                    position: absolute;
                    width: 0;
                    height: 0;
                    opacity: 0;
                    pointer-events: none;
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

                .cm-checkbox-highlight-blue {
                    background: linear-gradient(135deg, #e3f2fd 0%, #bbdefb 100%);
                    border: 2px solid #1890ff;
                    border-radius: 6px;
                    padding: 12px 16px;
                    margin-bottom: 16px;
                }

                .cm-checkbox-highlight-blue .cm-checkbox-label {
                    font-weight: 600;
                    color: #1565c0;
                }

                .cm-checkbox-highlight-blue .cm-checkbox {
                    width: 20px;
                    height: 20px;
                    accent-color: #1890ff;
                }

                .cm-checkbox-shimmer {
                    background: linear-gradient(135deg, #fff3e0 0%, #ffe0b2 100%);
                    border: 2px solid #fb8c00;
                    border-radius: 6px;
                    padding: 12px 16px;
                    margin-bottom: 16px;
                    position: relative;
                    overflow: hidden;
                    transition: background 0.6s ease, border-color 0.6s ease;
                }

                .cm-checkbox-shimmer .cm-checkbox-group {
                    position: relative;
                    z-index: 1;
                }

                .cm-checkbox-shimmer .cm-checkbox-label {
                    font-weight: 600;
                    color: #e65100;
                    transition: color 0.6s ease;
                }

                .cm-checkbox-shimmer .cm-checkbox {
                    width: 20px;
                    height: 20px;
                    accent-color: #fb8c00;
                    transition: accent-color 0.6s ease;
                }

                .cm-checkbox-shimmer:has(input:checked) {
                    background: linear-gradient(135deg, #e3f2fd 0%, #bbdefb 100%);
                    border-color: #1890ff;
                }

                .cm-checkbox-shimmer:has(input:checked) .cm-checkbox-label {
                    color: #1565c0;
                }

                .cm-checkbox-shimmer:has(input:checked) .cm-checkbox {
                    accent-color: #1890ff;
                }

                .cm-checkbox-shimmer::before {
                    content: '';
                    position: absolute;
                    top: 0;
                    left: -50%;
                    width: 40%;
                    height: 100%;
                    background: linear-gradient(110deg, transparent 0%, rgba(255,255,255,0.45) 50%, transparent 100%);
                    animation: cm-checkbox-shimmer-glide 4s ease-in-out infinite;
                    pointer-events: none;
                }

                @keyframes cm-checkbox-shimmer-glide {
                    0%   { left: -50%; }
                    100% { left: 110%; }
                }

                .cm-inline-radio-group {
                    display: flex;
                    gap: 16px;
                    flex-wrap: wrap;
                    margin-top: 10px;
                    padding-top: 10px;
                    border-top: 1px dashed rgba(0, 0, 0, 0.12);
                    transition: opacity 0.3s ease;
                }

                .cm-inline-radio-label {
                    display: inline-flex;
                    align-items: center;
                    gap: 6px;
                    cursor: pointer;
                    font-size: 14px;
                    user-select: none;
                }

                .cm-inline-radio-label .cm-radio {
                    cursor: pointer;
                }

                .cm-checkbox-highlight-red .cm-inline-radio-label {
                    color: #c62828;
                    font-weight: 500;
                }

                .cm-checkbox-highlight-red .cm-inline-radio-label .cm-radio {
                    accent-color: #e53935;
                }

                .cm-form-group:has(> .cm-checkbox-group input[type="checkbox"]:not(:checked)) .cm-inline-radio-group {
                    opacity: 0.4;
                    pointer-events: none;
                }

                .cm-missing {
                    font-weight: 700;
                    background: linear-gradient(90deg, #e53935 40%, #ff8a80 50%, #e53935 60%);
                    background-size: 200% 100%;
                    -webkit-background-clip: text;
                    background-clip: text;
                    -webkit-text-fill-color: transparent;
                    animation: cm-missing-shimmer 2s ease-in-out infinite;
                }

                @keyframes cm-missing-shimmer {
                    0%, 100% { background-position: 100% 0; }
                    50% { background-position: -100% 0; }
                }

                .cm-form-preview-wrap {
                    display: flex;
                    gap: 20px;
                }

                .cm-form-preview-wrap > .cm-form-side {
                    flex: 1;
                    min-width: 0;
                }

                .cm-form-preview-wrap > .cm-preview-side {
                    flex: 1;
                    min-width: 0;
                    position: sticky;
                    top: 0;
                    align-self: flex-start;
                }

                .cm-preview {
                    margin-top: 0;
                }

                .cm-preview-text {
                    background: #fafafa;
                    border-left: 4px solid #1890ff;
                    border-radius: 0 4px 4px 0;
                    padding: 12px 16px;
                    font-size: 13px;
                    line-height: 1.6;
                    white-space: pre-wrap;
                    word-break: break-word;
                    font-style: italic;
                    color: #333;
                    max-height: 60vh;
                    overflow-y: auto;
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

                .cm-btn-secondary:hover:not(:disabled) {
                    border-color: #1890ff;
                    color: #1890ff;
                }

                .cm-btn-secondary:disabled {
                    color: #bbb;
                    border-color: #e8e8e8;
                    cursor: not-allowed;
                    opacity: 0.7;
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

                .cm-seal-selector {
                    display: flex;
                    flex-wrap: wrap;
                    gap: 6px;
                }

                .cm-seal-option {
                    display: flex;
                    align-items: center;
                    gap: 4px;
                    cursor: pointer;
                    font-size: 13px;
                    padding: 2px 8px;
                    background: #f0f7ff;
                    border: 1px solid #91caff;
                    border-radius: 4px;
                    user-select: none;
                }

                .cm-seal-option input {
                    accent-color: #1890ff;
                }

                .cm-seal-groups-wrap {
                    display: flex;
                    flex-wrap: wrap;
                    gap: 12px;
                }

                .cm-seal-group {
                    border: 1px solid #e8e8e8;
                    border-radius: 6px;
                    padding: 10px 12px 6px;
                    flex: 1 1 calc(50% - 6px);
                    min-width: 180px;
                    box-sizing: border-box;
                }

                .cm-seal-group-header {
                    font-size: 12px;
                    font-weight: 600;
                    color: #1890ff;
                    margin-bottom: 8px;
                    padding-bottom: 4px;
                    border-bottom: 1px solid #e8e8e8;
                }

                .cm-copied {
                    background: #52c41a !important;
                    border-color: #52c41a !important;
                    color: #fff !important;
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

            const regulation = this.regulationType === 'D7' ? 'Д7 & Соглашение' : 'ПП1877'

            const footer = this.regulationType === 'D7'
                ? '<button type="button" class="cm-btn cm-btn-secondary" id="cm-chat-tag">Тег для чата</button>'
                : ''

            this.createModal({
                title: `Выберите категорию по ${regulation}`,
                showBack: false,
                body: this.renderCategoriesList(),
                footer,
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

        // ========== Экран: Тег для чата ==========

        showChatTagForm() {
            const pageData = this.dataExtractor.extract()
            this.selectedSeals = [...pageData.sealNumbers]
            this.ikttSeals = [...pageData.ikttSeals]
            this.gptiSeals = [...pageData.gptiSeals]
            this.currentCategory = null
            this.currentTemplate = null

            const finishedStatuses = ['Деактивирована', 'Распломбирована', 'Завершена']
            const activeStatuses = ['Активирована']
            let defaultProcedure
            if (finishedStatuses.includes(pageData.transportStatus)) {
                defaultProcedure = 'Завершение'
            } else if (activeStatuses.includes(pageData.transportStatus)) {
                defaultProcedure = 'Промежуточное размыкание'
            } else {
                defaultProcedure = 'Не указано'
            }

            this.navigationStack.push({ restore: () => this.showCategories() })

            this.createModal({
                title: 'Тег для чата',
                subtitle: Utils.getChatTag(pageData.transportProcedure),
                showBack: true,
                body: this.renderChatTagForm(pageData, defaultProcedure),
                footer: `
                    <button type="button" class="cm-btn cm-btn-secondary" id="cm-back">Назад</button>
                    <button type="button" class="cm-btn cm-btn-primary" id="cm-copy-chat-tag">Копировать</button>
                `,
            })

            this.updateChatTagPreview(pageData)

            // Обновление превью при смене процедуры
            this.container.querySelectorAll('input[name="cm-tag-procedure"]').forEach(r => {
                r.addEventListener('change', () => this.updateChatTagPreview(pageData))
            })

            // Обновление превью при смене пломб (selectedSeals уже обновлены attachSealCheckListeners)
            this.container.querySelectorAll('.cm-seal-check').forEach(cb => {
                cb.addEventListener('change', () => {
                    const checked = [...this.container.querySelectorAll('.cm-seal-check:checked')]
                    if (checked.length > 0) this.selectedSeals = checked.map(c => c.value)
                    this.updateChatTagPreview(pageData)
                })
            })

            // Кнопка копирования
            const copyBtn = this.container.querySelector('#cm-copy-chat-tag')
            if (copyBtn) {
                copyBtn.addEventListener('click', async () => {
                    const text = this.buildChatTagText(pageData)
                    try {
                        await navigator.clipboard.writeText(text)
                    } catch {
                        const ta = document.createElement('textarea')
                        ta.value = text
                        ta.style.cssText = 'position:fixed;opacity:0'
                        document.body.appendChild(ta)
                        ta.select()
                        document.execCommand('copy')
                        document.body.removeChild(ta)
                    }
                    this.showCopySuccess(copyBtn)
                })
            }
        }

        renderChatTagForm(pageData, defaultProcedure) {
            const sealSection = pageData.sealNumbers.length > 1 ? `
                <div class="cm-form-group">
                    <label class="cm-label">Пломбы</label>
                    <div class="cm-seal-selector">
                        ${pageData.sealNumbers.map(num =>
                            `<label class="cm-seal-option"><input type="checkbox" class="cm-seal-check" value="${num}" checked> ${num}</label>`
                        ).join('')}
                    </div>
                </div>
            ` : ''

            return `
                ${sealSection}
                <div class="cm-form-group">
                    <label class="cm-label">Процедура</label>
                    <div class="cm-radio-group">
                        <label class="cm-radio-label">
                            <input type="radio" class="cm-radio" name="cm-tag-procedure" value="Промежуточное размыкание" ${defaultProcedure === 'Промежуточное размыкание' ? 'checked' : ''}>
                            Промежуточное размыкание
                        </label>
                        <label class="cm-radio-label">
                            <input type="radio" class="cm-radio" name="cm-tag-procedure" value="Завершение" ${defaultProcedure === 'Завершение' ? 'checked' : ''}>
                            Завершение
                        </label>
                        <label class="cm-radio-label">
                            <input type="radio" class="cm-radio" name="cm-tag-procedure" value="Не указано" ${defaultProcedure === 'Не указано' ? 'checked' : ''}>
                            Не указано
                        </label>
                    </div>
                </div>
                <div class="cm-preview">
                    <div class="cm-preview-title">Предпросмотр</div>
                    <div id="cm-chat-tag-preview" class="cm-preview-text"></div>
                </div>
            `
        }

        buildChatTagText(pageData) {
            const tag = Utils.getChatTag(pageData.transportProcedure)
            const seals = this.selectedSeals.length > 0 ? this.selectedSeals : pageData.sealNumbers
            const sealType = Utils.getSealType(seals, pageData.ikttSeals, pageData.gptiSeals)
            const sealLabel = sealType === SEAL_TYPES.CRCP ? 'ЭНП' : 'НП'
            const sealNumber = seals.join(', ')
            const procedure = this.container?.querySelector('input[name="cm-tag-procedure"]:checked')?.value
                || 'Не указано'

            // При "Не указано" — показываем статус перевозки вместо процедуры
            const procedureLine = procedure === 'Не указано'
                ? `Статус: ${pageData.transportStatus || '▮▮▮'}`
                : `Процедура: ${procedure}`

            return [
                `Перевозка: ${pageData.orderNumber} - ${tag}`,
                procedureLine,
                `${sealLabel}: ${sealNumber}`,
                `ТС: ${pageData.mainVehicleNumber}`,
            ].join('\n')
        }

        updateChatTagPreview(pageData) {
            const previewEl = this.container?.querySelector('#cm-chat-tag-preview')
            if (!previewEl) return
            previewEl.textContent = this.buildChatTagText(pageData)
        }

        // ========== Экран: Список шаблонов в категории ==========

        showTemplates(categoryId) {
            const categories = Utils.getCategoriesObj(this.regulationType)
            this.currentCategory = categories[categoryId]
            if (!this.currentCategory) return

            this.navigationStack.push({
                restore: () => this.showCategories(),
            })

            const regulation = this.regulationType === 'D7' ? 'Д7 & Соглашение' : 'ПП1877'

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
                        <li class="cm-list-item ${tpl.disabled ? 'cm-list-item-disabled' : ''}" data-template="${tpl.id}" data-search="${tpl.name.toLowerCase()}" ${tpl.disabled ? 'data-disabled="1"' : ''}>
                            <div class="cm-list-content">
                                <div class="cm-list-name">${tpl.name}${tpl.disabled ? ' <span class="cm-list-badge">скоро</span>' : ''}</div>
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
            this.selectedSeals = [...pageData.sealNumbers]
            this.ikttSeals = [...pageData.ikttSeals]
            this.gptiSeals = [...pageData.gptiSeals]

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
            this.currentStatus = pageData.transportStatus
            this.currentIsNonCrcp = pageData.isBts
                || pageData.ikttSeals.includes(pageData.sealNumber)
                || pageData.gptiSeals.includes(pageData.sealNumber)
            this.fieldValues = {}
            template.fields.forEach((field) => {
                // Не устанавливаем default для полей скрытых по showIfStatus
                if (field.showIfStatus && field.showIfStatus !== pageData.transportStatus) {
                    return
                }
                if (field.defaultByStatus) {
                    const status = pageData.transportStatus
                    const val = field.defaultByStatus[status] !== undefined
                        ? field.defaultByStatus[status]
                        : field.defaultByStatus['_default']
                    if (val !== undefined) {
                        this.fieldValues[field.id] = val
                    }
                } else if (field.default !== undefined) {
                    this.fieldValues[field.id] = field.default
                }
                if (field.inlineRadio?.default !== undefined) {
                    this.fieldValues[field.inlineRadio.id] = field.inlineRadio.default
                }
            })

            // Сбрасываем скрытые чекбоксы, чтобы их hideIf-зависимые поля не прятались
            template.fields.forEach((field) => {
                if (field.type === 'checkbox' && this.isFieldHidden(field)) {
                    this.fieldValues[field.id] = false
                }
            })

            this.createModal({
                title: template.name,
                subtitle: this.currentCategory.name,
                showBack: true,
                body: this.renderForm(template, pageData),
                footer: this.renderFormFooter(template),
                wide: true,
            })

            this.updatePreview()
        }

        renderSealRow(pageData) {
            if (pageData.sealNumbers.length > 1) {
                const checkboxes = pageData.sealNumbers.map(num =>
                    `<label class="cm-seal-option"><input type="checkbox" class="cm-seal-check" value="${num}" ${this.selectedSeals.includes(num) ? 'checked' : ''}> ${num}</label>`
                ).join('')
                return `
                    <div class="cm-data-row">
                        <span class="cm-data-label">ЭНП/НП:</span>
                        <div class="cm-seal-selector">${checkboxes}</div>
                    </div>`
            }
            return `
                <div class="cm-data-row">
                    <span class="cm-data-label">ЭНП:</span>
                    <span class="cm-data-value">${pageData.sealNumber}</span>
                </div>`
        }

        renderForm(template, pageData) {
            const hasRelated = Utils.hasRelatedTemplates(template) && !this.currentRelatedTemplate

            return `
                <div class="cm-data-info">
                    ${this.renderSealRow(pageData)}
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

                <div class="cm-form-preview-wrap">
                    <div class="cm-form-side">
                        <form id="cm-form">
                            ${this.renderFields(template.fields, pageData)}
                        </form>
                        ${hasRelated ? this.renderRelatedSection(template) : ''}
                    </div>
                    <div class="cm-preview-side">
                        <div class="cm-preview">
                            <div class="cm-preview-title">Предпросмотр сообщения</div>
                            <div id="cm-preview-text" class="cm-preview-text"></div>
                        </div>
                    </div>
                </div>
            `
        }

        renderFields(fields, pageData) {
            const isMultiSeal = this.selectedSeals.length > 1
            const perSealFields = isMultiSeal ? fields.filter(f => f.perSeal) : []

            let html = fields
                .map((field) => {
                    // Пропускаем perSeal поля при мульти-пломбе (рендерятся в группах)
                    if (isMultiSeal && field.perSeal) return ''

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
                        ? (field.highlightColor === 'red' ? 'cm-checkbox-highlight-red'
                          : field.highlightColor === 'orange' ? 'cm-checkbox-highlight-orange'
                          : field.highlightColor === 'blue' ? 'cm-checkbox-highlight-blue'
                          : field.highlightColor === 'shimmer' ? 'cm-checkbox-shimmer'
                          : 'cm-checkbox-highlight')
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
                            const datePickerBtn = field.withDatePicker
                                ? `<button type="button" class="cm-datepicker-btn" data-for="field-${field.id}">&#128197;</button><input type="datetime-local" class="cm-datepicker-hidden" data-target="field-${field.id}">`
                                : ''
                            return `
                                <div class="cm-form-group ${hidden} ${halfWidth}" data-field="${field.id}" data-showif="${field.showIf || ''}" data-hideif="${field.hideIf || ''}">
                                    <label class="cm-label">${field.label}${field.required ? ' *' : ''}</label>
                                    <div class="cm-input-wrap">
                                        <input type="${field.type}" class="cm-input"
                                            id="field-${field.id}"
                                            placeholder="${field.placeholder || ''}"
                                            ${datalistAttr}
                                            ${field.min !== undefined ? `min="${field.min}"` : ''}
                                            ${field.max !== undefined ? `max="${field.max}"` : ''}
                                            ${field.required ? 'required' : ''}>
                                        ${clearBtn}
                                        ${datePickerBtn}
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

                        case 'checkbox': {
                            const ir = field.inlineRadio
                            const irCurrent = ir ? (this.fieldValues[ir.id] ?? ir.default) : null
                            const inlineRadioHtml = ir
                                ? `<div class="cm-inline-radio-group">${ir.options.map(opt => `
                                        <label class="cm-inline-radio-label">
                                            <input type="radio" class="cm-radio" name="field-${ir.id}" value="${opt.value}" ${opt.value === irCurrent ? 'checked' : ''}>
                                            ${opt.label}
                                        </label>
                                    `).join('')}</div>`
                                : ''
                            return `
                                <div class="cm-form-group ${hidden} ${halfWidth} ${highlightClass}" data-field="${field.id}" data-showif="${field.showIf || ''}" data-hideif="${field.hideIf || ''}">
                                    <div class="cm-checkbox-group">
                                        <input type="checkbox" class="cm-checkbox"
                                            id="field-${field.id}"
                                            ${this.fieldValues[field.id] ? 'checked' : ''}>
                                        <label class="cm-checkbox-label" for="field-${field.id}">${field.label}</label>
                                    </div>
                                    ${inlineRadioHtml}
                                </div>
                            `
                        }

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

            if (perSealFields.length > 0) {
                html += this.renderPerSealGroups(perSealFields)
            }

            return html
        }

        renderPerSealGroups(perSealFields) {
            const groups = this.selectedSeals.map(seal => `
                <div class="cm-seal-group" data-seal="${seal}">
                    <div class="cm-seal-group-header">ЭНП ${seal}</div>
                    ${perSealFields.map(field => this.renderPerSealField(field, seal)).join('')}
                </div>
            `).join('')
            return `<div class="cm-seal-groups-wrap">${groups}</div>`
        }

        renderPerSealField(field, seal) {
            if (field.hideIfBts && this.isNonCrcp(seal)) return ''

            const fieldId = `field-${field.id}-${seal}`
            const datalistId = field.datalist ? `datalist-${field.id}-${seal}` : ''
            const datalistAttr = datalistId ? `list="${datalistId}"` : ''
            const datalistHtml = field.datalist
                ? `<datalist id="${datalistId}">${field.datalist.map(v => `<option value="${v}">`).join('')}</datalist>`
                : ''
            const clearBtn = field.datalist
                ? `<button type="button" class="cm-clear-btn cm-hidden" data-clear="${fieldId}">&times;</button>`
                : ''
            const datePickerBtn = field.withDatePicker
                ? `<button type="button" class="cm-datepicker-btn" data-for="${fieldId}">&#128197;</button><input type="datetime-local" class="cm-datepicker-hidden" data-target="${fieldId}">`
                : ''

            return `
                <div class="cm-form-group">
                    <label class="cm-label">${field.label}${field.required ? ' *' : ''}</label>
                    <div class="cm-input-wrap">
                        <input type="text" class="cm-input cm-per-seal-input"
                            id="${fieldId}"
                            placeholder="${field.placeholder || ''}"
                            ${datalistAttr}
                            ${field.required ? 'required' : ''}>
                        ${clearBtn}
                        ${datePickerBtn}
                    </div>
                    ${datalistHtml}
                </div>
            `
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
            const letterBtn = template.id === 'agreed'
                ? '<button type="button" class="cm-btn cm-btn-secondary" id="cm-copy-letter">Для письма</button>'
                : ''
            return `
                <button type="button" class="cm-btn cm-btn-secondary" id="cm-back">Назад</button>
                ${letterBtn}
                <button type="button" class="cm-btn cm-btn-primary" id="cm-copy">Копировать</button>
            `
        }

        // ========== Общие методы ==========

        createModal({ title, subtitle, showBack, body, footer, wide }) {
            if (this.overlay) {
                this.overlay.remove()
            }

            this.overlay = document.createElement('div')
            this.overlay.className = 'cm-overlay'
            this.overlay.addEventListener('click', (e) => {
                if (e.target === this.overlay) this.minimize()
            })

            this.container = document.createElement('div')
            this.container.className = `cm-modal${wide ? ' cm-modal-wide' : ''}`
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

            // Тег для чата
            const chatTagBtn = this.container.querySelector('#cm-chat-tag')
            if (chatTagBtn) {
                chatTagBtn.addEventListener('click', () => this.showChatTagForm())
            }

            // Категории
            this.container.querySelectorAll('[data-category]').forEach((item) => {
                item.addEventListener('click', () => {
                    this.showTemplates(item.dataset.category)
                })
            })

            // Шаблоны
            this.container.querySelectorAll('[data-template]').forEach((item) => {
                item.addEventListener('click', () => {
                    if (item.dataset.disabled) return
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

            const copyLetterBtn = this.container.querySelector('#cm-copy-letter')
            if (copyLetterBtn) {
                copyLetterBtn.addEventListener('click', () => this.copyForLetter())
            }

            // Поля формы
            this.container.querySelectorAll('input:not(#cm-search), textarea, select').forEach((input) => {
                input.addEventListener('input', () => this.updatePreview())
                input.addEventListener('change', () => this.updatePreview())
            })

            // Ограничение min/max для number полей
            this.container.querySelectorAll('input[type="number"][max], input[type="number"][min]').forEach((input) => {
                input.addEventListener('input', () => {
                    if (input.value === '') return
                    const val = Number(input.value)
                    if (input.max !== '' && val > Number(input.max)) input.value = input.max
                    if (input.min !== '' && val < Number(input.min)) input.value = input.min
                })
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

            // Кнопки календаря
            this.container.querySelectorAll('.cm-datepicker-btn').forEach((btn) => {
                const picker = btn.nextElementSibling
                btn.addEventListener('click', () => {
                    picker.showPicker ? picker.showPicker() : picker.click()
                })
                picker.addEventListener('change', () => {
                    const target = this.container.querySelector(`#${picker.dataset.target}`)
                    if (target && picker.value) {
                        target.value = Utils.formatDateTime(picker.value)
                        this.updatePreview()
                    }
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

            // Чекбоксы выбора пломб
            this.attachSealCheckListeners()

            this.overlay.appendChild(this.container)
            document.body.appendChild(this.overlay)
        }

        attachSealCheckListeners() {
            this.container.querySelectorAll('.cm-seal-check').forEach(cb => {
                cb.addEventListener('change', () => {
                    const checked = [...this.container.querySelectorAll('.cm-seal-check:checked')]
                    if (checked.length === 0) { cb.checked = true; return }
                    this.selectedSeals = checked.map(c => c.value)
                    // Показ/скрытие per-seal групп
                    this.container.querySelectorAll('.cm-seal-group').forEach(group => {
                        group.classList.toggle('cm-hidden', !this.selectedSeals.includes(group.dataset.seal))
                    })
                    this.updatePreview()
                })
            })
        }

        // Проверяет, скрыто ли поле по условиям showIf/hideIf/etc.
        isFieldHidden(field) {
            let hidden = false
            if (field.hideIfBts && this.currentIsNonCrcp) return true
            if (field.hideIfStatuses && this.currentStatus && field.hideIfStatuses.includes(this.currentStatus)) return true
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
                el.checked = false
                this.fieldValues[field.id] = false
            } else {
                el.value = ''
                this.fieldValues[field.id] = ''
            }
        }

        restoreFieldDefault(field) {
            let defaultVal
            if (field.defaultByStatus) {
                defaultVal = field.defaultByStatus[this.currentStatus] !== undefined
                    ? field.defaultByStatus[this.currentStatus]
                    : field.defaultByStatus['_default']
            } else if (field.default !== undefined) {
                defaultVal = field.default
            }
            if (defaultVal === undefined) return

            if (field.type === 'checkbox') {
                const el = this.container.querySelector(`#field-${field.id}`)
                if (el) {
                    el.checked = defaultVal
                    this.fieldValues[field.id] = defaultVal
                }
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
                    if (field.inlineRadio) {
                        const checked = this.container.querySelector(`input[name="field-${field.inlineRadio.id}"]:checked`)
                        this.fieldValues[field.inlineRadio.id] = checked ? checked.value : ''
                    }
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

                        // Восстанавливаем default при появлении
                        if (!shouldHide && wasHidden) {
                            this.restoreFieldDefault(f)
                        }
                    })
                }
            })

            // Сбор per-seal значений
            const perSealFields = template.fields.filter(f => f.perSeal)
            if (perSealFields.length > 0 && pageData.sealNumbers.length > 1) {
                this.sealFieldValues = {}
                this.selectedSeals.forEach(seal => {
                    this.sealFieldValues[seal] = {}
                    perSealFields.forEach(field => {
                        const el = this.container.querySelector(`#field-${field.id}-${seal}`)
                        if (el) this.sealFieldValues[seal][field.id] = el.value
                    })
                })
                pageData.sealFieldValues = this.sealFieldValues
                pageData.selectedSeals = [...this.selectedSeals]
            }

            // Подмена sealNumber по выбранным пломбам
            if (this.selectedSeals.length > 0) {
                pageData.sealNumber = this.selectedSeals.join(', ')
                pageData.isBts = this.selectedSeals.some(s => Number(s) > 1000000)
            }

            const message = template.generate(pageData, this.fieldValues)
            const previewEl = this.container.querySelector('#cm-preview-text')
            if (previewEl) {
                previewEl.innerHTML = message.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/▮▮▮/g, '<span class="cm-missing">▮▮▮</span>')
            }

            // Обновляем состояние кнопки копирования
            this.updateCopyButtonState(template, pageData)
        }

        updateCopyButtonState(template, pageData) {
            const copyBtn = this.container.querySelector('#cm-copy')
            if (copyBtn) {
                copyBtn.disabled = !this.isFormValid(template, pageData)
            }

            const letterBtn = this.container.querySelector('#cm-copy-letter')
            if (letterBtn) {
                letterBtn.disabled = !this.fieldValues.territory || this.fieldValues.territory.trim() === ''
            }
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

                // Проверка requiredOneOf (хотя бы один чекбокс из группы)
                if (field.requiredOneOf && !field.requiredOneOf.some(id => this.fieldValues[id])) {
                    return false
                }

                // Проверка required полей
                if (field.required) {
                    if (field.perSeal && pageData.sealNumbers.length > 1) {
                        for (const seal of this.selectedSeals) {
                            if (field.hideIfBts && this.isNonCrcp(seal)) continue
                            const value = this.sealFieldValues?.[seal]?.[field.id]
                            if (!value || value.toString().trim() === '') return false
                        }
                    } else {
                        const value = this.fieldValues[field.id]
                        if (!value || value.toString().trim() === '') {
                            return false
                        }
                        if (field.minLength && value.toString().trim().length < field.minLength) {
                            return false
                        }
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

        async copyForLetter() {
            const pageData = this.dataExtractor.extract()
            if (this.selectedSeals.length > 0) {
                pageData.sealNumber = this.selectedSeals.join(', ')
                pageData.isBts = this.selectedSeals.some(s => Number(s) > 1000000)
            }
            const sealLabel = pageData.isBts ? 'НП' : 'ЭНП'

            const text = [
                `Оператором согласовано срезание ${sealLabel} ${pageData.sealNumber} в ${this.fieldValues.territory || '▮▮▮'}`,
                ``,
                `Тип перевозок: ${pageData.transportProcedure}`,
                `Перевозка: ${pageData.orderNumber}`,
                `${sealLabel}: ${pageData.sealNumber}`,
                `Основной номер ТС: ${pageData.mainVehicleNumber}`,
                `ГО: ${pageData.vehicleNumber}`,
                ``,
                `Просьба сообщить о факте срезания`,
            ].join('\n')

            const btn = this.container.querySelector('#cm-copy-letter')
            try {
                await navigator.clipboard.writeText(text)
                this.showCopySuccess(btn)
            } catch (err) {
                const textarea = document.createElement('textarea')
                textarea.value = text
                textarea.style.cssText = 'position:fixed;opacity:0'
                document.body.appendChild(textarea)
                textarea.select()
                document.execCommand('copy')
                document.body.removeChild(textarea)
                this.showCopySuccess(btn)
            }
        }

        showCopySuccess(btn) {
            const originalText = btn.textContent
            btn.textContent = 'Скопировано'
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
            this.currentStatus = null
            this.currentIsNonCrcp = false
            this.selectedSeals = []
            this.sealFieldValues = {}
            this.ikttSeals = []
            this.gptiSeals = []
            this.lastOrderId = null
        }

        minimize() {
            if (!this.overlay || this.isMinimized) return
            this.isMinimized = true

            // Анимация сворачивания
            this.overlay.classList.add('cm-minimizing')
            this.container.classList.add('cm-minimizing')

            setTimeout(() => {
                this.overlay.style.display = 'none'
                this.overlay.classList.remove('cm-minimizing')
                this.container.classList.remove('cm-minimizing')
            }, 300)

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

            // Показываем основное окно с анимацией
            if (this.overlay) {
                this.overlay.style.display = 'flex'
                this.container.classList.add('cm-restoring')
                setTimeout(() => this.container.classList.remove('cm-restoring'), 300)
            }

            this.isMinimized = false

            // Обновляем данные страницы в форме (если открыта форма шаблона)
            if (this.currentTemplate && this.container) {
                this.refreshPageData()
            }
        }

        refreshPageData() {
            const pageData = this.dataExtractor.extract()
            this.selectedSeals = [...pageData.sealNumbers]
            this.ikttSeals = [...pageData.ikttSeals]
            this.gptiSeals = [...pageData.gptiSeals]
            const dataInfo = this.container.querySelector('.cm-data-info')
            if (dataInfo) {
                dataInfo.innerHTML = `
                    ${this.renderSealRow(pageData)}
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
                // Обработчики чекбоксов пломб после обновления DOM
                this.attachSealCheckListeners()
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
