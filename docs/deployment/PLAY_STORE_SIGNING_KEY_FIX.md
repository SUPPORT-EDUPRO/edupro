# Play Store Signing Key Resolution

## Problem

The EduDash Pro app bundle is being rejected by Google Play Console with the error:

> Your Android App Bundle is signed with the wrong key.

**Expected SHA1**: `13:03:7C:6B:69:F9:AA:7A:00:F7:E5:C9:1F:10:6F:CD:FA:87:97:CF`

**Current SHA1**: `7F:4A:DC:62:BC:60:F2:68:DA:C6:04:5D:DD:99:41:ED:06:AD:42:88`

## Root Cause

The Google Play Store was originally set up with an older EAS/Expo project that had a different signing keystore. When the project was migrated or recreated, a new keystore was generated, but the Play Store still expects the original key.

## Solutions

There are **three possible solutions**:

---

### Option 1: Request Key Upload from Google (RECOMMENDED)

Google Play now supports uploading a new upload key without losing existing users.

**Steps:**

1. **Generate a new Upload Key Certificate (PEM)**:
   ```bash
   cd /home/king/Desktop/edudashpro
   
   # Export current EAS keystore to PEM format
   eas credentials --platform android
   # Select "Keystore: Manage everything needed to build your project"
   # Select "Download credentials locally"
   
   # Then convert to PEM:
   keytool -export -rfc -keystore credentials.jks -alias <key-alias> -file upload_certificate.pem
   ```

2. **Contact Google Play Support**:
   - Go to **Google Play Console** → **Setup** → **App signing**
   - Click **"Request upload key reset"**
   - Follow the prompts to submit your new upload certificate
   - Google typically responds within 1-2 business days

3. **Once approved**, upload your new AAB built with the current EAS keystore

---

### Option 2: Restore Original Keystore to EAS

If you still have the original keystore file:

1. **Upload the original keystore to EAS**:
   ```bash
   eas credentials --platform android
   # Select "Keystore: Manage everything needed to build your project"
   # Select "Use existing credentials"
   # Upload the original keystore file
   ```

2. **Verify the SHA1 matches**:
   ```bash
   keytool -list -v -keystore original-keystore.jks
   # Should show SHA1: 13:03:7C:6B:69:F9:AA:7A:00:F7:E5:C9:1F:10:6F:CD:FA:87:97:CF
   ```

3. **Rebuild and upload**:
   ```bash
   eas build --platform android --profile production
   ```

---

### Option 3: Use Google Play App Signing (Managed Keys)

If you don't have the original keystore and can't wait for Google's key reset:

1. **Enable Play App Signing** (if not already):
   - Go to **Google Play Console** → **Setup** → **App signing**
   - Enable **Google Play App Signing**

2. **With Play App Signing enabled**, Google manages the signing key and you only need to match the **Upload key** (which you can reset)

3. **Follow Option 1** to reset the upload key

---

## Current EAS Credentials

```
Keystore Configuration: dashpro (Default)
Type:                   JKS
Key Alias:              64272887230119a6d9da76fe7ecf21d5
SHA1 Fingerprint:       7F:4A:DC:62:BC:60:F2:68:DA:C6:04:5D:DD:99:41:ED:06:AD:42:88
SHA256 Fingerprint:     E4:50:D5:85:AD:AE:E4:85:AE:36:AF:5C:C2:2A:9F:96:CC:32:92:CB:7B:CD:B6:EF:0E:BC:FE:F3:0E:00:47:3C
```

## Action Items

- [ ] Contact Google Play Support to request upload key reset
- [ ] Generate PEM certificate from current EAS keystore
- [ ] Submit key reset request through Play Console
- [ ] Wait for approval (1-2 business days)
- [ ] After approval, upload new AAB

## Prevention

To prevent this issue in the future:

1. **Backup your keystore** whenever you create a new EAS project:
   ```bash
   eas credentials --platform android
   # Download credentials locally
   ```

2. **Store keystore in secure location** (e.g., 1Password, AWS Secrets Manager)

3. **Document the key fingerprints** in your project documentation

4. **Use Google Play App Signing** to let Google manage the signing key

---

## Helpful Commands

```bash
# Check current EAS credentials
eas credentials --platform android

# Download keystore locally
eas credentials --platform android
# Then select download option

# View keystore details
keytool -list -v -keystore credentials.jks -alias <alias>

# Export certificate to PEM
keytool -export -rfc -keystore credentials.jks -alias <alias> -file certificate.pem

# Build production AAB
eas build --platform android --profile production

# Build production APK (for testing)
eas build --platform android --profile production-apk
```

## References

- [Google Play App Signing](https://support.google.com/googleplay/android-developer/answer/9842756)
- [Reset upload key](https://support.google.com/googleplay/android-developer/answer/9842756#reset)
- [EAS Build Credentials](https://docs.expo.dev/app-signing/managed-credentials/)
