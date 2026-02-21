// Suppress specific Tailwind CDN advisory warning to reduce console noise.
(function(){
  const origWarn = console.warn.bind(console);
  console.warn = function(...args){
    try{
      if(args.length && typeof args[0] === 'string' && args[0].includes('cdn.tailwindcss.com should not be used in production')){
        return; // ignore the Tailwind advisory message
      }
    }catch(e){
      // if anything goes wrong, fall back to original warn
    }
    origWarn(...args);
  };
})();
