(function(){
try{var P=[
{p:'#8AAD9E',c:'#EAF0EE',o:'#1E2623',b:'#E5EDEA',l:'#DEE8E4',f:'#F6F8F7',h:'#718E82',s:'rgba(138,173,158,0.08)',x:'#232421',y:'#6D6F6B',z:'#949591',d:'#BEC5BC',i:'#ACB5AC'},
{p:'#8D9FB2',c:'#EAEEF1',o:'#1F2327',b:'#E6EAEE',l:'#DFE4E9',f:'#F6F7F9',h:'#748292',s:'rgba(141,159,178,0.08)',x:'#232322',y:'#6D6D6D',z:'#949493',d:'#BFC1C2',i:'#AEB1B3'},
{p:'#B89298',c:'#F2EBEC',o:'#282021',b:'#EFE7E8',l:'#EBE0E2',f:'#F9F6F7',h:'#97787D',s:'rgba(184,146,152,0.08)',x:'#252321',y:'#726B6A',z:'#989391',d:'#CCBDBA',i:'#BDACAA'},
{p:'#A89AB8',c:'#EFEDF2',o:'#252228',b:'#ECE9EF',l:'#E7E3EB',f:'#F8F7F9',h:'#8A7E97',s:'rgba(168,154,184,0.08)',x:'#242322',y:'#716C6E',z:'#979493',d:'#C7BFC4',i:'#B7AFB5'},
{p:'#B5A888',c:'#F2EFEA',o:'#28251E',b:'#EFECE5',l:'#EAE7DE',f:'#F9F8F5',h:'#948A70',s:'rgba(181,168,136,0.08)',x:'#252420',y:'#726E68',z:'#98958F',d:'#CBC3B6',i:'#BCB4A4'},
{p:'#8DADA5',c:'#EAF0EF',o:'#1F2624',b:'#E6EDEB',l:'#DFE8E6',f:'#F6F8F8',h:'#748E87',s:'rgba(141,173,165,0.08)',x:'#232421',y:'#6D6F6C',z:'#949592',d:'#BFC5BE',i:'#AEB5AE'},
{p:'#AD94A0',c:'#F0ECEE',o:'#262123',b:'#EDE7EA',l:'#E8E1E4',f:'#F8F6F7',h:'#8E7983',s:'rgba(173,148,160,0.08)',x:'#252321',y:'#716C6B',z:'#979391',d:'#C8BDBD',i:'#B9ADAC'},
{p:'#AD8A7A',c:'#F0EAE7',o:'#261E1B',b:'#EDE5E2',l:'#E8DEDA',f:'#F8F6F4',h:'#8E7164',s:'rgba(173,138,122,0.08)',x:'#252220',y:'#716A67',z:'#97928E',d:'#C8BAB1',i:'#B9A99F'},
{p:'#A3A888',c:'#EEEFEA',o:'#24251E',b:'#EBECE5',l:'#E5E7DE',f:'#F8F8F5',h:'#868A70',s:'rgba(163,168,136,0.08)',x:'#242420',y:'#706E68',z:'#96958F',d:'#C5C3B6',i:'#B5B4A4'}
];
var S=document.documentElement.style,cur=0;
function A(n){
  var d=P[n];
  S.setProperty('--accent',d.p);
  S.setProperty('--accent-hover',d.h);
  S.setProperty('--accent-subtle',d.s);
  S.setProperty('--primary-container',d.c);
  S.setProperty('--on-primary-container',d.o);
  S.setProperty('--bg',d.b);
  S.setProperty('--log-bg',d.l);
  S.setProperty('--surface',d.f);
  S.setProperty('--text',d.x);
  S.setProperty('--text-secondary',d.y);
  S.setProperty('--text-tertiary',d.z);
  S.setProperty('--border',d.d);
  S.setProperty('--input-border',d.i);
}
A(Math.floor(Math.random()*P.length));
setInterval(function(){cur=(cur+1)%P.length;A(cur);},10000);
}catch(e){}
})();

// ============================================================================
// Scholarium Web UI — 主交互脚本
// ============================================================================

const logArea = document.getElementById('log-area');
const logPlaceholder = document.getElementById('log-placeholder');
const btnRun = document.getElementById('btn-run');
const btnDownload = document.getElementById('btn-download');
const statBar = document.getElementById('stat-bar');
const resultsPanel = document.getElementById('results-panel');
const rightEmpty = document.getElementById('right-empty');
const resultsTbody = document.getElementById('results-tbody');
const resultsSummary = document.getElementById('results-summary');

let eventSource = null;
var _allResults = [];

function appendLog(text, cls) {
  if (logPlaceholder) logPlaceholder.style.display = 'none';
  const span = document.createElement('div');
  span.textContent = text;
  span.className = 'log-line' + (cls ? ' ' + cls : '');
  logArea.appendChild(span);
  logArea.scrollTop = logArea.scrollHeight;
}

function clearLog() {
  logArea.querySelectorAll('.log-line').forEach(el => el.remove());
  if (logPlaceholder) logPlaceholder.style.display = '';
}

async function startCrawl() {
  const urls = document.getElementById('urls').value.trim();
  if (!urls) { alert('请输入至少一个 URL'); return; }

  btnRun.disabled = true;
  btnDownload.disabled = true;
  resultsPanel.style.display = 'none';
  rightEmpty.style.display = '';
  statBar.style.display = 'none';
  clearLog();
  appendLog('正在启动采集任务…', 'status-warn');

  const config = {
    urls: urls,
    timeout: parseInt(document.getElementById('timeout').value) || 5,
    retries: parseInt(document.getElementById('retries').value) || 3,
    delay_min: parseFloat(document.getElementById('delay_min').value) || 0.1,
    delay_max: parseFloat(document.getElementById('delay_max').value) || 0.5,
    min_content_len: parseInt(document.getElementById('min_content_len').value) || 30,
    output_filename: document.getElementById('output_filename').value || 'teachers.xlsx'
  };

  try {
    const resp = await fetch('/run', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(config)
    });
    if (!resp.ok) {
      const err = await resp.json();
      appendLog('错误: ' + (err.error || '启动失败'), 'status-err');
      btnRun.disabled = false;
      return;
    }
  } catch(e) {
    appendLog('连接失败: ' + e.message, 'status-err');
    btnRun.disabled = false;
    return;
  }

  if (eventSource) eventSource.close();
  eventSource = new EventSource('/stream');

  eventSource.onmessage = function(e) {
    const data = JSON.parse(e.data);
    if (data.type === 'log') {
      appendLog(data.text);
    } else if (data.type === 'done') {
      eventSource.close();
      eventSource = null;
      btnRun.disabled = false;
      fetchResults();
    }
  };

  eventSource.onerror = function() {
    if (eventSource) {
      eventSource.close();
      eventSource = null;
    }
    btnRun.disabled = false;
  };
}

async function fetchResults() {
  try {
    const resp = await fetch('/results');
    const data = await resp.json();
    const results = data.results || [];
    if (results.length === 0) return;

    _allResults = results;

    const hasC = results.filter(r => r.status === '').length;
    const noC  = results.filter(r => r.status === '主页无内容').length;
    const dead = results.filter(r => r.status === '链接无效').length;

    statBar.innerHTML =
      '<span>总计: <strong>' + results.length + '</strong></span>' +
      '<span style="color:var(--success)">有内容: <strong>' + hasC + '</strong></span>' +
      '<span style="color:var(--accent)">无内容: <strong>' + noC + '</strong></span>' +
      '<span style="color:var(--error)">无效: <strong>' + dead + '</strong></span>';
    statBar.style.display = 'flex';

    resultsSummary.textContent = '共 ' + results.length + ' 条';

    var html = '';
    for (var i = 0; i < results.length; i++) {
      var r = results[i];
      var statusText = r.status || '';
      var statusCls = r.status === '链接无效' ? 'status-error' :
                      r.status === '主页无内容' ? 'status-no-content' :
                      'status-ok';

      html += '<tr>' +
        '<td class="col-content"><div class="cell-content">' + escHtml(r.content || '') + '</div></td>' +
        '<td class="col-email"><div class="cell-email">' + escHtml(r.email || '') + '</div></td>' +
        '<td class="col-status"><div class="cell-status ' + statusCls + '">' + escHtml(statusText) + '</div></td>' +
        '</tr>';
    }
    resultsTbody.innerHTML = html;

    rightEmpty.style.display = 'none';
    resultsPanel.style.display = 'flex';

    if (data.output_file) {
      btnDownload.disabled = false;
      document.getElementById('btn-download-bottom').disabled = false;
    }
  } catch(e) {
    console.error(e);
  }
}

function escHtml(s) {
  return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

function toggleAdvanced() {
  var btn = document.getElementById('advanced-toggle');
  var panel = document.getElementById('advanced-params');
  btn.classList.toggle('open');
  panel.classList.toggle('open');
}

function copyColumn(colIdx) {
  var values = [];
  for (var i = 0; i < _allResults.length; i++) {
    var r = _allResults[i];
    var val = colIdx === 0 ? (r.content || '') :
              colIdx === 1 ? (r.email || '') :
              (r.status || '');
    if (val.indexOf('\n') !== -1 || val.indexOf('"') !== -1 || val.indexOf(',') !== -1) {
      val = '"' + val.replace(/"/g, '""') + '"';
    }
    values.push(val);
  }
  var text = values.join('\n');
  navigator.clipboard.writeText(text).then(function() {
    var btns = document.querySelectorAll('.th-copy-btn');
    var btn = btns[colIdx];
    if (btn) {
      var orig = btn.textContent;
      btn.textContent = '已复制';
      btn.classList.add('copied');
      setTimeout(function() {
        btn.textContent = orig;
        btn.classList.remove('copied');
      }, 1500);
    }
  }).catch(function(err) {
    console.error('复制失败:', err);
  });
}

function downloadExcel() {
  window.location.href = '/download';
}
