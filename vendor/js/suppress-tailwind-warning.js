// Suppress specific library advisories to reduce console noise.
(function() {
  const silentStrings = [
    'cdn.tailwindcss.com should not be used in production',
    '[PDF.js] Using CDN worker'
  ];

  const wrap = (original) => function(...args) {
    try {
      if (args.length && typeof args[0] === 'string' && silentStrings.some(s => args[0].includes(s))) {
        return; 
      }
    } catch (e) {}
    return original.apply(this, args);
  };

  console.warn = wrap(console.warn.bind(console));
  console.log = wrap(console.log.bind(console));
  console.info = wrap(console.info.bind(console));
})();
