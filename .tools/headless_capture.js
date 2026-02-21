const puppeteer = require('puppeteer');
const fs = require('fs');
(async ()=>{
  const outLog = [];
  try{
    const browser = await puppeteer.launch({args:['--no-sandbox','--disable-setuid-sandbox']});
    const page = await browser.newPage();
    page.on('console', msg => {
      const text = msg.args().map(a=>a._remoteObject && a._remoteObject.value !== undefined ? a._remoteObject.value : msg.text()).join(' ');
      outLog.push(`${new Date().toISOString()} ${msg.type().toUpperCase()}: ${text}`);
    });
    page.on('pageerror', err => {
      outLog.push(`${new Date().toISOString()} PAGE_ERROR: ${err.message}`);
      if (err.stack) outLog.push(`${new Date().toISOString()} PAGE_ERROR_STACK: ${err.stack}`);
    });

    const url = 'http://localhost:8000/solve_120.html';
    outLog.push(`${new Date().toISOString()} INFO: Navigating to ${url}`);
    await page.goto(url, {waitUntil: 'networkidle2', timeout: 60000}).catch(e=>{
      outLog.push(`${new Date().toISOString()} NAV_ERROR: ${e.message}`);
    });

    // Try to invoke OCR entry points if available
    try{
      await page.evaluate(()=>{
        if(window.runExamPdfOcrCheck) try{ window.runExamPdfOcrCheck(); }catch(e){}
        if(window.runRobustOcr) try{ window.runRobustOcr(); }catch(e){}
        if(window.startOcr) try{ window.startOcr(); }catch(e){}
      });
      outLog.push(`${new Date().toISOString()} INFO: Attempted to call known OCR entrypoints`);
    }catch(e){
      outLog.push(`${new Date().toISOString()} EVAL_ERROR: ${e.message}`);
    }

    // Wait to let OCR and other scripts run (use generic timeout for compatibility)
    await new Promise(resolve => setTimeout(resolve, 20000));

    // Capture screenshot and save logs
    const screenshotPath = 'headless_screenshot.png';
    await page.screenshot({path: screenshotPath, fullPage: true}).catch(e=>{
      outLog.push(`${new Date().toISOString()} SCREENSHOT_ERROR: ${e.message}`);
    });
    outLog.push(`${new Date().toISOString()} INFO: Screenshot saved to ${screenshotPath}`);

    await browser.close();
    outLog.push(`${new Date().toISOString()} INFO: Browser closed`);
  }catch(e){
    outLog.push(`${new Date().toISOString()} FATAL: ${e.stack||e.message}`);
  } finally{
    try{ fs.writeFileSync('headless_console.log', outLog.join('\n'), 'utf8'); }catch(e){}
  }
  console.log('CAPTURE_COMPLETE');
})();
