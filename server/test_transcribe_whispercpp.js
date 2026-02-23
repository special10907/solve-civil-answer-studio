// Simple test client to POST a small buffer as file to /api/transcribe
(async () => {
  const url = 'http://localhost:8787/api/transcribe';
  const sampleText = 'This is a short test audio placeholder.';
  const encoder = new TextEncoder();
  const buf = encoder.encode(sampleText);

  const fd = new FormData();
  const blob = new Blob([buf], { type: 'audio/raw' });
  fd.append('file', blob, 'sample.raw');

  try {
    const resp = await fetch(url, { method: 'POST', body: fd });
    const j = await resp.json();
    console.log('Status', resp.status);
    console.log(JSON.stringify(j, null, 2));
  } catch (e) {
    console.error('Request failed', e);
    process.exitCode = 2;
  }
})();
