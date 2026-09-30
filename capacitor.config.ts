import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.stemmantra.app',
  appName: 'STEMmantra',
  webDir: 'dist',

  // In dev, point to your local Vite server. Comment out for release builds.
  // server: {
  //   url: 'http://192.168.1.5:5173',
  //   cleartext: true,
  // },

  android: {
    allowMixedContent: false,
    captureInput: true,
    webContentsDebuggingEnabled: true, // false for release
  },

  plugins: {
    SplashScreen: {
      launchShowDuration: 2000,
      launchAutoHide: true,
      backgroundColor: '#FFF6EE',       // brand-cream
      androidSplashResourceName: 'splash',
      androidScaleType: 'CENTER_CROP',
      showSpinner: false,
      splashFullScreen: true,
      splashImmersive: true,
    },
    StatusBar: {
      style: 'DARK',                    // dark icons on light bg
      backgroundColor: '#FFF6EE',
      overlaysWebView: false,
    },
    Keyboard: {
      resize: 'body',
      resizeOnFullScreen: true,
    },
    Geolocation: {
      // Runtime request handled from JS
    },
    Camera: {
      // Runtime request handled from JS
    },
  },
};

export default config;
