// The upstream hostname check throws before engine initialization on IP URLs.
// Allow local development URLs, including a phone connecting over private Wi-Fi.
export function patchLocalHostStartup(source) {
  const original = 'if(!_0x9c7df7)data;else return;';
  const patched = "if(!_0x9c7df7&&!/^(?:localhost|127(?:\\.[0-9]{1,3}){3}|\\[::1\\]|10(?:\\.[0-9]{1,3}){3}|192\\.168(?:\\.[0-9]{1,3}){2}|172\\.(?:1[6-9]|2[0-9]|3[01])(?:\\.[0-9]{1,3}){2})$/.test(window.location.hostname))data;else return;";
  if (source.includes(patched)) return source;
  if (source.split(original).length !== 2) throw Error('Expected one upstream startup hostname check.');
  return source.replace(original, patched);
}
