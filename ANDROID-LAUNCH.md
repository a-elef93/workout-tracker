# GymPilot on Google Play — launch plan

There are two ways onto Android. They don't exclude each other.

| | **A. This web app as a Play Store app (TWA)** | **B. The native app (Expo, in progress)** |
|---|---|---|
| What ships | This PWA inside a Trusted Web Activity: full screen, own icon, no browser bar | A real React Native app built with EAS |
| Effort | Days | Weeks (the native app is still being built) |
| Health Connect steps, rest notifications with the screen off | No | Yes |
| Updates | Every push to `main` is live on the phone at once | Store review for native changes, EAS Update for JS changes |

**Recommendation:** start with **A** to learn the Play Console process and collect testers now. Ship **B** later with the same package name, so it arrives as an update and nobody reinstalls.

## 1. Before you start
- **Google Play Console** account: $25 once. Use a **personal** account with your real name and address (Google verifies your identity).
- New personal accounts **must run a closed test with at least 12 testers who stay opted in for 14 days in a row** before they can publish to production. Recruit testers now: gym friends, family, a WhatsApp group. Each tester needs a Google account and an Android phone.
- Pick the package name once and never change it: **`com.gympilot.app`**.

## 2. Host it where Android can verify it (for A)
A TWA proves it owns the site through `/.well-known/assetlinks.json` at the **root of the domain**. The app lives at `a-elef93.github.io/workout-tracker/`, but the root `a-elef93.github.io/` belongs to a different repo. Pick one:
1. Create the repo **`a-elef93/a-elef93.github.io`** and put `.well-known/assetlinks.json` in it, **or**
2. Use your own domain (e.g. `gympilot.app`) for GitHub Pages, which is cleaner for a store listing anyway.

## 3. Build the Android package (A)
1. Open **https://www.pwabuilder.com**, enter the app's URL and choose **Android → Generate package**.
2. Settings: package `com.gympilot.app`, app name `GymPilot`, launcher name `GymPilot`, theme color `#24180f`, background `#f4f8f2`, **signing key: let PWABuilder create one**.
3. Download the zip. It contains the **`.aab`** for Play, the **signing key** and **`assetlinks.json`**. Keep the key and its passwords somewhere safe: losing them means you can never update the app.
4. Put `assetlinks.json` at `/.well-known/assetlinks.json` (see step 2). After Play App Signing is on, add Google's **app signing key SHA-256** fingerprint (Play Console → *Setup → App signing*) to the same file, or the app shows a browser bar.

## 4. Play Console
1. **Create app** → GymPilot, default language Greek, *App*, *Free*.
2. **App content**:
   - Privacy policy URL. A short page is enough: "No account. Data stays on the device. Nothing is collected or shared." It can live in the repo.
   - **Data safety**: *No data collected, no data shared.* This is true: everything is in `localStorage` on the phone, and the backup is a file you share yourself.
   - **Health apps declaration**: fitness tracking without health-data access.
   - Content rating questionnaire (→ *Everyone*), target audience **18+** (it avoids the extra rules for apps aimed at children), ads: **No**.
3. **Store listing** in Greek and English:
   - Short description: *Γράψε προπονήσεις, νίκησε την προηγούμενη φορά. Χωρίς λογαριασμό.* / *Log workouts, beat last time. No account.*
   - Full description: the plan & Today card, Pilot Coach, Progress Every Time, Stay consistent, water/weight/nutrition. **Lead with "no account, no login, your data stays on your phone"**: it's the privilege that sets GymPilot apart.
   - Graphics: 512×512 icon (`icon-512.png`), 1024×500 feature graphic (espresso + logo), 4–8 phone screenshots (Today card, logging, Progress Every Time, Stay consistent, Coach, Nutrition), in light and dark.
4. **Testing → Internal testing**: upload the `.aab` and check it on your own phone.
5. **Testing → Closed testing**: create a track, add the **12+ testers** by email or a Google Group, and share the opt-in link. Keep them opted in for **14 days** and fix what they report.
6. **Apply for production access** (Play Console asks a few questions about the test), then **Production → Create release**: roll out to 20% → 50% → 100% while watching *Android vitals*.

## 5. After launch
- Web changes ship by pushing to `main`: the TWA loads the live site, and the service worker picks up new versions on the next open.
- Only changes to the wrapper itself (icon, name, package settings) need a new `.aab`, with a higher `versionCode`.
- When the native app (B) is ready, build it with `eas build -p android` using the **same package name and upload key**, upload it to the same Play listing, and it replaces the web wrapper as an update. The native app imports `GymPilot-backup.json`, so nobody loses data.

## Checklist
- [ ] Play Console account verified ($25)
- [ ] 12+ testers lined up
- [ ] Root domain for `assetlinks.json` (user site repo or own domain)
- [ ] Privacy policy page
- [ ] `.aab` from PWABuilder, key stored safely
- [ ] Internal test on your own phone
- [ ] Closed test: 12 testers × 14 days
- [ ] Store listing in Greek and English, screenshots light and dark
- [ ] Production access → staged rollout
