(function initGameDateTime(root) {
  const SHANGHAI_TIME_ZONE = 'Asia/Shanghai';
  const TIME_ZONE_SUFFIX = /(?:Z|[+-]\d{2}:?\d{2})$/i;

  function parseDatabaseTimestamp(value) {
    if (value instanceof Date) {
      return Number.isNaN(value.getTime()) ? null : value;
    }
    if (value === null || value === undefined || value === '') return null;

    const raw = String(value).trim();
    const normalized = TIME_ZONE_SUFFIX.test(raw)
      ? raw
      : `${raw.replace(' ', 'T')}Z`;
    const parsed = new Date(normalized);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
  }

  function formatShanghaiDate(value) {
    const date = parseDatabaseTimestamp(value);
    if (!date) return '';
    return date.toLocaleDateString('zh-CN', { timeZone: SHANGHAI_TIME_ZONE });
  }

  function formatShanghaiDateTime(value) {
    const date = parseDatabaseTimestamp(value);
    if (!date) return '';
    return date.toLocaleString('zh-CN', {
      timeZone: SHANGHAI_TIME_ZONE,
      hour12: false,
    });
  }

  const api = { parseDatabaseTimestamp, formatShanghaiDate, formatShanghaiDateTime };
  root.GameDateTime = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof globalThis !== 'undefined' ? globalThis : window);
