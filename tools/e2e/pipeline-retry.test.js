import path from 'path';
import fs from 'fs';
import puppeteer from 'puppeteer';
import net from 'net';

async function run() {
  const root = process.cwd();
  const htmlPath = path.resolve(root, 'solve_120.html');
  if (!fs.existsSync(htmlPath)) {
    console.error('solve_120.html not found at', htmlPath);
    process.exit(2);
  }

  const pageUrl = (process.env.E2E_PAGE_URL || 'http://localhost:8000/solve_120.html');
  console.log('Opening', pageUrl);

  const browser = await puppeteer.launch({ headless: true, args: ['--no-sandbox','--disable-setuid-sandbox'] });
  const page = await browser.newPage();
  await page.setViewport({ width: 1280, height: 900 });

  let first = true;
  // NOTE: request interception disabled for server-driven E2E simulation
  page.on('console', msg => {
    try {
      const args = msg.args().map(a=>a._remoteObject && a._remoteObject.value ? a._remoteObject.value : a.toString());
      console.log('PAGE LOG>', msg.type(), args.join(' '));
    } catch(e) { console.log('PAGE LOG (err)', msg.text()); }
  });
  page.on('pageerror', err => console.log('PAGE ERROR>', err && err.stack ? err.stack : err));
  

  // Ensure analyze backend port is accepting connections before loading the page
  const ensurePortOpen = (host, port, timeoutMs = 8000) => new Promise((resolve, reject) => {
    const start = Date.now();
    const tryOnce = () => {
      const socket = new net.Socket();
      let settled = false;
      socket.setTimeout(1500);
      socket.once('error', () => {
        socket.destroy();
        if (Date.now() - start > timeoutMs) {
          if (!settled) { settled = true; reject(new Error(`Port ${port} not open on ${host}`)); }
        } else {
          setTimeout(tryOnce, 300);
        }
      });
      socket.once('timeout', () => {
        socket.destroy();
        if (Date.now() - start > timeoutMs) {
          if (!settled) { settled = true; reject(new Error(`Port ${port} not open on ${host}`)); }
        } else {
          setTimeout(tryOnce, 300);
        }
      });
      socket.connect(port, host, () => {
        socket.end();
        if (!settled) { settled = true; resolve(true); }
      });
    };
    tryOnce();
  });

  try {
    console.log('Checking analyze backend at http://localhost:8787 ...');
    await ensurePortOpen('127.0.0.1', 8787, 8000);
    console.log('Analyze backend port 8787 is open.');
  } catch (e) {
    console.error('Analyze backend not available on :8787 — aborting E2E. Start server/index.js and retry.');
    process.exit(2);
  }

  await page.goto(pageUrl, { waitUntil: 'load' });

  // Ensure helper functions are available
  await page.waitForFunction(() => typeof window.generateAnswer === 'function', { timeout: 5000 });

  // invoke generateAnswer with mandatory pipeline true to trigger 424
  const res = await page.evaluate(async () => {
    try {
      // The generic generateAnswer helper does not open the pipelineAudit modal itself.
      // We still call it to exercise the network interception, but also prepare a
      // stored last request so the retry helper has something to replay.
      try {
        await generateAnswer({ id: 'e2e-1', title: 'E2E 테스트 질문' }, '테스트 지시', 'text', { mandatoryPipeline: true });
      } catch (e) {
        // ignore - interception will return 424
      }

      // Prepare a stored last request so pipelineRetryLast can replay it.
      window.__lastPipelineRequest = {
        endpoint: (window.__ANALYZE_BACKEND__ || 'http://localhost:8787') + '/api/generate-answer',
        requestBody: {
          question: { id: 'e2e-1', title: 'E2E 테스트 질문' },
          instruction: '테스트 지시',
          format: 'text',
          mandatoryPipeline: true,
          sourceBundle: {},
        },
        apiKey: '',
        selectedModelId: 'lmstudio',
        providerValue: 'lmstudio',
      };

      return { ok: false };
    } catch (e) {
      return { ok: false, status: e.status || null, payload: e.payload || null };
    }
  });

  console.log('Initial generateAnswer result:', res);

  // Instead of relying on the backend flow to open the modal (which is exercised
  // in the app under normal conditions), we explicitly open it here using the
  // simulated audit payload so the test is deterministic in headless mode.
  const auditPayload = {
    deepResearchExecuted: false,
    deepResearchParsed: false,
    deepResearchUsable: false,
    deepResearchReferences: 0,
    stepChecks: { stored: false, notebook: false, flowith: false, deep: false },
  };
  await page.evaluate((p) => {
    if (typeof window.openPipelineAuditModal === 'function') {
      window.openPipelineAuditModal(p);
    }
  }, auditPayload);
  await page.waitForSelector('#pipelineAuditModal:not(.hidden)', { timeout: 8000 });
  console.log('Pipeline audit modal opened');

  // check some checkboxes and call pipelineRetryLast(false)
  // install a safe wrapper to capture pipelineAuditRetry results into a global var
  // install a polling installer that will wrap fetch and pipelineAuditRetry as soon as the page exposes them
  await page.evaluate(() => {
    if (window.__e2e_installer) return;
    window.__e2e_installer = true;
    window.__lastFetchStatuses = window.__lastFetchStatuses || [];
    const installer = async () => {
      try {
        if (!window.__e2e_original_fetch && window.fetch) {
          window.__e2e_original_fetch = window.fetch;
          window.fetch = async function (input, init) {
            const resp = await window.__e2e_original_fetch(input, init);
            try {
              const url = String(input || '');
              if (url.includes('/api/generate-answer')) {
                const clone = resp.clone();
                const txt = await clone.text().catch(() => null);
                window.__lastFetchStatuses.push({ url, status: resp.status, ok: !!resp.ok, body: txt });
              }
            } catch (inner) {}
            return resp;
          };
        }

        if (typeof window.pipelineAuditRetry === 'function' && !window.__e2ePipelineRetryWrapped) {
          try {
            const orig = window.pipelineAuditRetry;
            window.__e2ePipelineRetryResult = null;
            window.pipelineAuditRetry = async function (args) {
              try {
                const r = await orig(args);
                window.__e2ePipelineRetryResult = { ok: true, result: r };
                return r;
              } catch (e) {
                try { window.__e2ePipelineRetryResult = { ok: false, message: String(e && e.message), stack: (e && e.stack) }; } catch (inner) {}
                throw e;
              }
            };
            window.__e2ePipelineRetryWrapped = true;
          } catch (e) {}
        }
      } catch (e) {}
    };
    window.__e2e_installer_timer = setInterval(installer, 200);
    // stop trying after some time
    setTimeout(() => { clearInterval(window.__e2e_installer_timer); }, 8000);
  });

  // trigger the retry: wait for the e2e installer to wrap pipelineAuditRetry, then call it directly
  await page.waitForFunction(() => !!window.__e2ePipelineRetryWrapped, { timeout: 5000 }).catch(() => null);
  await page.evaluate(() => {
    try {
      const el = document.getElementById('pipeline_check_deep');
      if (el) el.checked = true;
      if (typeof window.pipelineAuditRetry === 'function') {
        // call with hints.deep = true and forceMandatory = false
        window.pipelineAuditRetry({ hints: { deep: true }, forceMandatory: false }).catch(() => {});
      }
    } catch (e) {}
  });

  // wait for diagnostics from pipelineAuditRetry to indicate completion (final-result, parsed-error, or uncaught-exception)
  const diagSignal = await page.waitForFunction(() => {
    try {
      const d = window.__pipelineAuditRetryDiagnostics || [];
      if (!Array.isArray(d)) return false;
      for (const e of d) {
        if (e && (e.step === 'final-result' || e.step === 'parsed-error' || e.step === 'uncaught-exception' || e.step === 'payload-parsed')) return true;
      }
      const log = document.getElementById('pipelineAuditLog');
      if (log && /재시도 성공|자동화 테스트 응답|E2E backend simulated answer/.test(log.textContent || '')) return true;
      return false;
    } catch (e) { return false; }
  }, { timeout: 10000 }).catch(() => null);
  console.log('Diagnostics signal present:', !!diagSignal);

  // give the client a moment, then capture diagnostics before asserting
  await new Promise((res) => setTimeout(res, 500));
  const diag = await page.evaluate(() => {
    const log = document.getElementById('pipelineAuditLog');
    const lastReq = window.__lastPipelineRequest || null;
    const lastLLM = window.__lastLLMCandidate || null;
    return {
      log: log ? (log.textContent || '') : null,
      lastRequest: lastReq,
      lastLLMCandidatePreview: lastLLM ? (String(lastLLM).slice(0, 2000)) : null,
      lastFetchStatuses: window.__lastFetchStatuses || null,
      pipelineAuditRetryDiagnostics: window.__pipelineAuditRetryDiagnostics || null,
    };
  });
  console.log('E2E DIAG:', JSON.stringify(diag, null, 2));

  // wait for pipelineAuditLog to contain success entry (extended timeout)
  await page.waitForFunction(() => {
    const log = document.getElementById('pipelineAuditLog');
    return log && /재시도 성공|자동화 테스트 응답/.test(log.textContent || '');
  }, { timeout: 15000 });

  const finalLog = await page.evaluate(() => document.getElementById('pipelineAuditLog').textContent);
  console.log('Pipeline audit log (top):\n', finalLog.split('\n').slice(0,8).join('\n'));

  await browser.close();
  console.log('E2E pipeline-retry test finished OK');
}

run().catch((err) => {
  console.error('E2E test failed:', err);
  process.exit(1);
});
