export {};

declare global {
  interface Window {
    electronAPI?: {
      minimize: () => void;
      close: () => void;
      showNotification: (title: string, body: string) => void;
    };
  }
}
