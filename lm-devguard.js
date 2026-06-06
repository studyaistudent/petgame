/**
 * 배포 환경에서 F12·소스 보기 등 일반적인 열람을 어렵게 함.
 * localhost / ?dev=1 / localStorage lm_dev=1 이면 비활성.
 */
(function (global) {
  'use strict';

  function isDevBypass() {
    if (global.__LM_DEV_MODE) return true;
    try {
      if (localStorage.getItem('lm_dev') === '1') return true;
      if (/[?&]dev=1(?:&|$)/.test(global.location.search || '')) return true;
    } catch (e) {}
    const h = (global.location && global.location.hostname) || '';
    return h === 'localhost' || h === '127.0.0.1' || h === '[::1]' || h === '';
  }

  if (isDevBypass()) return;

  var devOpen = false;
  var styleInjected = false;

  function injectBlockStyle() {
    if (styleInjected || !global.document) return;
    styleInjected = true;
    var style = document.createElement('style');
    style.id = 'lm-devguard-style';
    style.textContent =
      'html.lm-devblock body{filter:blur(14px) grayscale(.35);pointer-events:none;user-select:none;-webkit-user-select:none;}' +
      'html.lm-devblock #lm-devguard-overlay{position:fixed;inset:0;z-index:2147483646;display:flex;align-items:center;justify-content:center;' +
      'background:rgba(8,6,18,.78);color:#fff;font:700 17px "Noto Sans KR",sans-serif;text-align:center;padding:24px;pointer-events:auto;line-height:1.6;}';
    document.head.appendChild(style);
    var overlay = document.createElement('div');
    overlay.id = 'lm-devguard-overlay';
    overlay.setAttribute('aria-hidden', 'true');
    overlay.textContent = '개발자 도구 사용이 제한됩니다.\n창을 닫으면 게임이 다시 보입니다.';
    document.documentElement.appendChild(overlay);
  }

  function setDevBlock(on) {
    if (!global.document || !document.documentElement) return;
    injectBlockStyle();
    if (on) document.documentElement.classList.add('lm-devblock');
    else document.documentElement.classList.remove('lm-devblock');
  }

  function onDevOpen() {
    devOpen = true;
    setDevBlock(true);
  }

  function onDevClose() {
    devOpen = false;
    setDevBlock(false);
  }

  function checkDevTools() {
    var gapW = Math.abs((global.outerWidth || 0) - (global.innerWidth || 0));
    var gapH = Math.abs((global.outerHeight || 0) - (global.innerHeight || 0));
    var open = gapW > 150 || gapH > 150;
    if (open && !devOpen) onDevOpen();
    else if (!open && devOpen) onDevClose();
  }

  function blockKeys(e) {
    var key = e.key || '';
    var code = e.keyCode || e.which || 0;
    var ctrl = e.ctrlKey || e.metaKey;
    var shift = e.shiftKey;
    if (key === 'F12' || code === 123) {
      e.preventDefault();
      e.stopPropagation();
      return false;
    }
    if (ctrl && shift && /^(I|J|C|K)$/i.test(key)) {
      e.preventDefault();
      e.stopPropagation();
      return false;
    }
    if (ctrl && !shift && /^U$/i.test(key)) {
      e.preventDefault();
      e.stopPropagation();
      return false;
    }
  }

  function blockMenu(e) {
    e.preventDefault();
    return false;
  }

  function muteConsole() {
    var noop = function () {};
    var names = ['log', 'debug', 'info', 'warn', 'dir', 'dirxml', 'table', 'trace', 'group', 'groupCollapsed', 'groupEnd', 'clear'];
    for (var i = 0; i < names.length; i++) {
      try {
        if (global.console && typeof global.console[names[i]] === 'function') {
          global.console[names[i]] = noop;
        }
      } catch (err) {}
    }
  }

  muteConsole();
  global.addEventListener('keydown', blockKeys, true);
  global.addEventListener('contextmenu', blockMenu, true);
  global.setInterval(checkDevTools, 700);

  if (global.document && document.readyState !== 'loading') checkDevTools();
  else global.addEventListener('DOMContentLoaded', checkDevTools);
})(typeof window !== 'undefined' ? window : globalThis);
