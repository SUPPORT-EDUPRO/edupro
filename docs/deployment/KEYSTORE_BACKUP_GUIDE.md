# EduDash Pro Keystore Backup Guide

## ⚠️ CRITICAL: Never Lose This Keystore!

Losing the Play Store signing key means **you cannot update your app** and would need to publish a completely new app with a new package name.

---

## 📍 Backup Locations

Your keystore is now backed up in **3 locations**:

### 1. Project Folder (Local)
```
/home/king/Desktop/edudashpro/credentials-backup/
├── edudashpro-playstore-release-key.jks
├── KEYSTORE_CREDENTIALS.txt
└── edudashpro-keystore-backup.zip (password protected)
```

### 2. Home Directory Backup
```
~/keystore-backups/edudashpro/
├── edudashpro-playstore-release-key.jks
├── KEYSTORE_CREDENTIALS.txt
└── edudashpro-keystore-backup.zip
```

### 3. External Drive Backup
```
/media/king/.../home/king/keystore-backups/edudashpro/
├── edudashpro-playstore-release-key.jks
├── KEYSTORE_CREDENTIALS.txt
└── edudashpro-keystore-backup.zip
```

---

## 🔐 Credentials Reference

| Field | Value |
|-------|-------|
| **Package Name** | `com.edudashpro` |
| **SHA1 Fingerprint** | `13:03:7C:6B:69:F9:AA:7A:00:F7:E5:C9:1F:10:6F:CD:FA:87:97:CF` |
| **Keystore Password** | `dd92513961172e6d298c8a0aeb1348cf` |
| **Key Alias** | `1f4a4f8dd54e51eaaaf33ca56753a1f8` |
| **Key Password** | `ded48fed90b96d182bf08b9dae1bad10` |

---

## 📤 Recommended Additional Backups

### Cloud Storage (Highly Recommended)

Upload the encrypted zip (`edudashpro-keystore-backup.zip`) to:

1. **Google Drive** - Create a folder called "App Credentials" and upload
2. **Dropbox** - Store in a private folder
3. **Email to yourself** - Send as attachment to your Gmail/Outlook

### Encrypted USB Drive

1. Copy the zip file to a dedicated USB drive
2. Store in a secure physical location (safe, lockbox)

### Password Manager

Store the credentials in a password manager like:
- 1Password
- Bitwarden
- LastPass

---

## 🔧 How to Verify the Keystore

```bash
keytool -list -v -keystore edudashpro-playstore-release-key.jks -storepass dd92513961172e6d298c8a0aeb1348cf
```

Expected SHA1: `13:03:7C:6B:69:F9:AA:7A:00:F7:E5:C9:1F:10:6F:CD:FA:87:97:CF`

---

## 🚀 Upload to EAS (Next Step)

To use this keystore with EAS Build:

```bash
cd /home/king/Desktop/edudashpro

# Clear existing credentials
eas credentials --platform android

# Select: Credentials Manager > Android > Production > Keystore
# Choose: Remove current keystore
# Then: Upload a keystore
# Provide the file and credentials above
```

Or use non-interactive mode:

```bash
eas credentials --platform android --non-interactive \
  --keystore-path ./credentials-backup/edudashpro-playstore-release-key.jks \
  --keystore-password dd92513961172e6d298c8a0aeb1348cf \
  --key-alias 1f4a4f8dd54e51eaaaf33ca56753a1f8 \
  --key-password ded48fed90b96d182bf08b9dae1bad10
```

---

## ⚡ Quick Recovery

If you ever need to restore the keystore:

1. Check `~/keystore-backups/edudashpro/`
2. Or check external drive backups
3. Verify SHA1 matches Play Console
4. Upload to EAS credentials

---

## 📋 Checklist

- [x] Keystore backed up in project folder
- [x] Keystore backed up in home directory
- [x] Keystore backed up on external drive
- [x] Password-protected zip created
- [x] credentials-backup/ added to .gitignore
- [ ] Upload zip to Google Drive
- [ ] Store credentials in password manager
- [ ] Upload keystore to EAS credentials

---

**Last Updated:** December 8, 2024
**Keystore Verified:** ✅ SHA1 matches Play Store
