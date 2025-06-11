/**
 * escapeHtml(text): Escape special HTML characters.
 * @param {string} text
 * @return {string}
 */
function escapeHtml(text) {
  var map = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;'
  };
  return String(text || '').replace(/[&<>"']/g, function(m) {
    return map[m];
  });
}
