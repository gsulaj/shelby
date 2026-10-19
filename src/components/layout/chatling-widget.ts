/** Guarded calls into the Chatling embed: window.Chatling is missing until embed.js has loaded. */

type ChatlingApi = { open?: () => void; showChatIcon?: () => void; hideChatIcon?: () => void };

function chatling(): ChatlingApi | undefined {
  if (typeof window === "undefined") return undefined;
  return (window as unknown as { Chatling?: ChatlingApi }).Chatling;
}

export function openChatlingWidget() {
  const api = chatling();
  if (api?.open) api.open();
}

/** Hides or restores the floating chat bubble, e.g. while the mobile menu covers the page. */
export function setChatlingIconVisible(visible: boolean) {
  const api = chatling();
  if (visible) {
    if (api?.showChatIcon) api.showChatIcon();
  } else if (api?.hideChatIcon) {
    api.hideChatIcon();
  }
}
