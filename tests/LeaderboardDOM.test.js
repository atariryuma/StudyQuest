const { JSDOM } = require('jsdom');
const escapeHtml = require('../src/shared/escapeHtml.js');

function renderLeaderboard(data, doc) {
  const tbody = doc.querySelector('#leaderboardTable tbody');
  tbody.innerHTML = data
    .map(r => `<tr><td>${r.rank}</td><td>${escapeHtml(r.handleName)}</td><td>${escapeHtml(r.level)}</td><td>${escapeHtml(r.totalXp)}</td></tr>`)
    .join('');
}

test('renderLeaderboard escapes HTML', () => {
  const dom = new JSDOM('<table id="leaderboardTable"><tbody></tbody></table>');
  const { document } = dom.window;
  const malicious = '<img src=x onerror=alert(1)>';
  renderLeaderboard([{ rank: 1, handleName: malicious, level: 5, totalXp: 100 }], document);
  const html = document.querySelector('tbody').innerHTML;
  expect(html).toContain('&lt;img');
  expect(document.querySelector('img')).toBeNull();
});
