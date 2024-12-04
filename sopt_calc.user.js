// ==UserScript==
// @name         Санкционные - Calc
// @namespace    http://tampermonkey.net/
// @version      2.2
// @description  Считает кол-во цифр в блоках с номерами ТД.
// @author       https://t.me/SawGoD
// @match        https://sa.transit.crcp.ru/orders/active*
// @icon         https://telegra.ph/file/99807e90eb71a7ca3ba43.jpg
// @homepageURL    https://github.com/SawGoD/takethehelm
// @updateURL      https://raw.githubusercontent.com/SawGoD/takethehelm/main/sopt_calc.user.js
// @downloadURL    https://raw.githubusercontent.com/SawGoD/takethehelm/main/sopt_calc.user.js
// ==/UserScript==

(function() {
if (window.location.href.startsWith('https://sa.transit.crcp.ru/orders/active'))
  setInterval(() => {
    const divs = document.querySelectorAll(
      'div[data-title="Номер транзитной декларации"]'
    )

    divs.forEach((div) => {
      const existingParagraph = div.querySelector('p')
      if (existingParagraph) existingParagraph.remove()

      const text = div.textContent.trim()
      const digitCount = text.replace(/\D/g, '').length

      const paragraph = document.createElement('p')
      paragraph.textContent = `Количество: ${digitCount}`
      div.appendChild(paragraph)

      div.style.color =
        (digitCount >= 21 && 'green') ||
        (digitCount < 21 && digitCount >= 8 ? 'orange' : 'red')
    })
  }, 1000)

})();
