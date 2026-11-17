import { App } from "@capacitor/app";
import { Capacitor } from "@capacitor/core";

export function initialiseNativeShell() {
  if (!Capacitor.isNativePlatform()) return;

  document.documentElement.classList.add("capacitor-native");

  void App.addListener("backButton", ({ canGoBack }) => {
    if (canGoBack && window.history.length > 1) {
      window.history.back();
      return;
    }
    App.exitApp();
  });
}
