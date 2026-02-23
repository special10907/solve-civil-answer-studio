(async()=>{
  try{
    const url = 'http://localhost:8787/api/analyze-questions';
    const body = { text: 'Q1. 테스트 문제\n\nQ2. 두번째 문제입니다.' };
    const res = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
    const txt = await res.text();
    console.log('STATUS', res.status);
    console.log(txt);
  }catch(e){
    console.error('ERROR', e);
    process.exit(1);
  }
})();
