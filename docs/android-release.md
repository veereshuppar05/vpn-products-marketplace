# VPN Products Android app

The Android app reuses the existing React/Vite site and the same Supabase project. It is packaged with Capacitor and uses Firebase Cloud Messaging (FCM) for Android push notifications.

- Application name: VPN Products
- Android application ID: `com.vpnproducts.services`
- Minimum Android version: Android 7 (API 24)
- Capacitor 8 targets Android 16 (API 36)
- The selling flow remains a Coming Soon page.

## Build from Windows

Install Node.js 22 or newer and Android Studio 2025.2.1 or newer with Android SDK 36.

From the repository root:

```powershell
npm install
npm run build
npm run android:add
npx cap sync android
npm run android:open
```

Open the Android project in Android Studio and run it on a phone or emulator. On later website-code changes, run:

```powershell
npm run android:sync
```

## Automated APK build

GitHub Actions > Build Android app > Run workflow creates a debug-signed APK. Download the `vpn-products-android` artifact and install `app-debug.apk` on an Android device. This APK is for direct testing/installation, not the Play Store release.

## Firebase push notifications

1. Open Firebase Console and create a project for VPN Products.
2. Add an Android app with package name `com.vpnproducts.services`.
3. Download the Firebase `google-services.json` file.
4. In Supabase SQL Editor, run `supabase/mobile-push-notifications.sql`.
5. In Supabase > Edge Functions > Secrets, add `FIREBASE_SERVICE_ACCOUNT_JSON` with the complete JSON contents of a Firebase service-account key that has Firebase Cloud Messaging permissions.
6. Add the same `google-services.json` to GitHub Actions as the repository secret `ANDROID_GOOGLE_SERVICES_JSON_BASE64` (base64-encoded file contents).
7. Redeploy the `order-notifications` Edge Function after the push sender code is deployed.
8. Re-run the Android workflow and install its newly built APK. Sign in and allow notifications.

Do not commit `google-services.json`, Firebase service-account JSON, FCM private keys, or Android upload keystores to the repository. The service-account key belongs only in Supabase Edge Function secrets. The Google services client file belongs only in the GitHub Actions secret used by the Android build.

## Google Play release signing

A Play Store release needs a signed Android App Bundle (.aab). Create an upload keystore and store these GitHub repository secrets:

- `ANDROID_KEYSTORE_BASE64`: base64-encoded upload keystore file.
- `ANDROID_KEYSTORE_PASSWORD`
- `ANDROID_KEY_ALIAS`
- `ANDROID_KEY_PASSWORD`

Re-run the Android workflow. When the signing secrets exist, it builds a signed release APK and AAB in addition to the debug APK.

Keep at least two secure backups of the original upload keystore and passwords. Loss of the upload key can complicate app updates.

## Google Play Console

Create a Google Play Console developer account, complete identity verification, app content/data-safety declarations, store listing, screenshots, privacy policy and testing requirements. Upload the signed AAB to an internal testing track before production submission.

Google Play's current new-app requirement is Android 16 / API 36 or higher from 31 August 2026. Capacitor 8 targets API 36.
