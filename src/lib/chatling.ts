declare global {
  interface Window {
    Chatling?: { open: () => void };
  }
}

/** Opens the Chatling chat widget loaded in the root layout; a no-op until embed.js has loaded. */
export function openChatling() {
  window.Chatling?.open();
}
