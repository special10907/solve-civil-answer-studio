(async()=>{
  try{
    const url = 'http://localhost:8787/api/analyze-attachments';
    const body = { items: [{ name: 'a.txt', textExcerpt: 'Q1. 첫번째 문제\n\nQ2. 두번째 문제' }], focus: '요약' };
    const res = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
    console.log('STATUS', res.status);
    console.log(await res.text());
  }catch(e){
    console.error('ERROR', e);
    process.exit(1);
  }
})();
