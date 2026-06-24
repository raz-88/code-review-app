let fixedCodeText = '';
let editor = null;
let history = JSON.parse(localStorage.getItem('reviewHistory') || '[]');

const modeMap = {
  python: 'python',
  javascript: 'javascript',
  java: 'text/x-java',
  'c++': 'text/x-c++src',
  html: 'xml',
  css: 'css'
};

window.onload = function () {
  editor = CodeMirror.fromTextArea(document.getElementById('codeInput'), {
    theme: 'dracula',
    lineNumbers: true,
    matchBrackets: true,
    autoCloseBrackets: true,
    mode: 'python',
    indentUnit: 2,
    tabSize: 2,
    lineWrapping: true,
  });

  editor.on('change', updateCounter);
  renderHistory();
};

function changeLanguage() {
  const lang = document.getElementById('language').value;
  editor.setOption('mode', modeMap[lang] || 'python');
  document.getElementById('toolbar-lang').textContent = lang;
}

function updateCounter() {
  const val = editor.getValue();
  const lines = val ? val.split('\n').length : 0;
  document.getElementById('counter').textContent = `${lines} lines · ${val.length} chars`;
}

async function reviewCode() {
  const code = editor.getValue();
  const language = document.getElementById('language').value;
  const level = document.getElementById('level').value;
  const output = document.getElementById('output');
  const loading = document.getElementById('loading');
  const btn = document.getElementById('reviewBtn');
  const btnText = document.getElementById('btnText');

  if (!code.trim()) {
    showToast('Please paste some code first!');
    return;
  }

  btn.disabled = true;
  btnText.textContent = 'Analyzing...';
  loading.classList.remove('hidden');
  output.classList.add('hidden');

  try {
    const res = await fetch('/review', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ code, language, level })
    });

    const data = await res.json();
    if (data.error) throw new Error(data.error);

    renderFeedback(data.feedback);
    saveToHistory(code, language, level, data.feedback);
    output.classList.remove('hidden');
    output.scrollIntoView({ behavior: 'smooth', block: 'start' });

  } catch (e) {
    showToast('Something went wrong. Try again.');
  }

  loading.classList.add('hidden');
  btn.disabled = false;
  btnText.textContent = 'Review my code';
}

function renderFeedback(text) {
  const sections = text.split(/^## /m).filter(Boolean);
  let bugsHTML = '', fixedHTML = '', tipsHTML = '';
  fixedCodeText = '';

  sections.forEach(section => {
    const lines = section.trim().split('\n');
    const title = lines[0].trim().toLowerCase();
    const body = lines.slice(1).join('\n').trim();

    if (title.includes('bug')) {
      bugsHTML = formatBody(body);
      const hasBugs = !body.toLowerCase().includes('no bugs');
      const count = (body.match(/^[-•\d]/gm) || []).length;
      document.getElementById('bug-count').textContent =
        hasBugs ? `${count || 1} issue${count !== 1 ? 's' : ''} found` : 'Clean code! 🎉';
    } else if (title.includes('fix')) {
      const codeMatch = body.match(/```[\w]*\n?([\s\S]*?)```/);
      fixedCodeText = codeMatch ? codeMatch[1].trim() : body;
      fixedHTML = formatBody(body);
    } else if (title.includes('tip')) {
      tipsHTML = formatBody(body);
    }
  });

  document.getElementById('bugs-content').innerHTML  = bugsHTML  || '<p>No bugs section found.</p>';
  document.getElementById('fixed-content').innerHTML = fixedHTML || '<p>No fix provided.</p>';
  document.getElementById('tips-content').innerHTML  = tipsHTML  || '<p>No tips provided.</p>';
}

function formatBody(text) {
  return text
    .replace(/```[\w]*\n?([\s\S]*?)```/g, '<pre><code>$1</code></pre>')
    .replace(/^[-•] (.+)/gm, '<li>$1</li>')
    .replace(/^(\d+)\. (.+)/gm, '<li>$2</li>')
    .replace(/(<li>[\s\S]*?<\/li>)/g, '<ul>$1</ul>')
    .replace(/<\/ul>\s*<ul>/g, '')
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/`([^`]+)`/g, '<code style="background:#1a1a2a;padding:2px 6px;border-radius:4px;font-family:Fira Code,monospace;font-size:12px">$1</code>')
    .replace(/\n\n/g, '</p><p>')
    .replace(/^(?!<)(.+)$/gm, '<p>$1</p>')
    .replace(/<p><\/p>/g, '');
}

function loadFixedCode() {
  if (!fixedCodeText) return;
  editor.setValue(fixedCodeText);
  window.scrollTo({ top: 0, behavior: 'smooth' });
  showToast('Fixed code loaded into editor!');
}

function copyFixedCode() {
  if (!fixedCodeText) return;
  navigator.clipboard.writeText(fixedCodeText).then(() => {
    showToast('Fixed code copied!');
    const btn = document.getElementById('copyCodeBtn');
    btn.textContent = 'Copied!';
    setTimeout(() => btn.textContent = 'Copy fixed code', 2000);
  });
}

function copyAll() {
  const bugs  = document.getElementById('bugs-content').innerText;
  const fixed = document.getElementById('fixed-content').innerText;
  const tips  = document.getElementById('tips-content').innerText;
  const full  = `BUGS FOUND\n${bugs}\n\nFIXED CODE\n${fixed}\n\nTIPS\n${tips}`;
  navigator.clipboard.writeText(full).then(() => showToast('Full report copied!'));
}

function reviewAgain() {
  document.getElementById('output').classList.add('hidden');
  editor.focus();
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

function clearCode() {
  editor.setValue('');
  editor.focus();
  updateCounter();
}

/* ── History ── */
function saveToHistory(code, language, level, feedback) {
  const hasBugs = !feedback.toLowerCase().includes('no bugs found');
  const item = {
    id: Date.now(),
    code: code.slice(0, 200),
    language,
    level,
    hasBugs,
    feedback,
    time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
  };
  history.unshift(item);
  if (history.length > 20) history.pop();
  localStorage.setItem('reviewHistory', JSON.stringify(history));
  renderHistory();
}

function renderHistory() {
  const list = document.getElementById('history-list');
  const count = document.getElementById('history-count');

  if (history.length === 0) {
    list.innerHTML = '<div class="history-empty">No reviews yet. Submit your first code review!</div>';
    count.classList.add('hidden');
    return;
  }

  count.textContent = history.length;
  count.classList.remove('hidden');

  list.innerHTML = history.map(item => `
    <div class="history-item" onclick="loadFromHistory(${item.id})">
      <span class="history-item-lang">${item.language}</span>
      <span class="history-item-preview">${item.code.split('\n')[0]}</span>
      <span class="history-item-time">${item.time}</span>
      <span class="history-item-bugs ${item.hasBugs ? 'has-bugs' : 'no-bugs'}">
        ${item.hasBugs ? 'Bugs found' : 'Clean'}
      </span>
    </div>
  `).join('');
}

function loadFromHistory(id) {
  const item = history.find(h => h.id === id);
  if (!item) return;
  editor.setValue(item.code);
  document.getElementById('language').value = item.language;
  changeLanguage();
  renderFeedback(item.feedback);
  document.getElementById('output').classList.remove('hidden');
  toggleHistory();
  showToast('Review loaded from history!');
}

function toggleHistory() {
  document.getElementById('history-panel').classList.toggle('hidden');
}

function clearHistory() {
  history = [];
  localStorage.setItem('reviewHistory', JSON.stringify(history));
  renderHistory();
  showToast('History cleared!');
}

function showToast(msg) {
  const toast = document.getElementById('toast');
  toast.textContent = msg;
  toast.classList.remove('hidden');
  setTimeout(() => toast.classList.add('hidden'), 2500);
}