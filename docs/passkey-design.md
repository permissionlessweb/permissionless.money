

# Passkey Authentication Guide

**The easiest way to secure your wallet.** No passwords to remember. No seed phrases to lose. Just your fingerprint, face, or hardware key.

## What is a Passkey?

A passkey replaces your password with something you already have — your device. Instead of typing a complicated string you might forget (or that hackers might steal), you prove it's you by unlocking your phone, laptop, or YubiKey.

**Think of it like this:**  
- **Old way:** Username + password + 2FA code → stored on a server somewhere  
- **New way:** Your device proves your identity cryptographically → nothing secret ever leaves your possession

## Why Use Passkeys?

| Before (Passwords) | After (Passkeys) |
|-------------------|------------------|
| Write down seed phrases | No sensitive data to store |
| Phishing emails trick you | Tied to the real website only |
| Server breach exposes your credentials | Server only stores a public "lock" that can't be reversed |
| Forgot password recovery流程 | Your device *is* the proof |

## How It Works

**First Time Setup (One-time)**

1. Click "Create Passkey" on the mint page
2. Your device asks for your fingerprint, Face ID, or PIN
3. A secure credential is created and stays on your device
4. We store only a "fingerprint" of your public key — nothing that can be stolen

**Every Login After**

1. Click "Authenticate with Passkey"
2. Use your fingerprint/Face ID again
3. You're in — no typing, no passwords, no codes

```
You                    Your Device                    Terp Network
│                           │                              │
│── "It's me" ─────────────►│                              │
│◄── "Prove it" ───────────│                              │
│                           │────── Creates proof ─────────►│
│                           │◄────── "Verified" ───────────│
│◄── "Welcome" ─────────────│                              │
```

## Setup Step-by-Step

### 1. Check Your Device

Passkeys work on:
- **iPhone/iPad** iOS 16+ (Face ID / Touch ID)
- **Android** 9+ (Fingerprint / PIN)
- **Mac** macOS Ventura+ (Touch ID)
- **Windows** 10/11 (Windows Hello + PIN)
- **Hardware keys** YubiKey 5 series

**Browser:** Chrome, Safari, Edge, or Firefox (latest versions). Must have screen lock/PIN enabled on your device.

### 2. Create Your Passkey

1. Go to the HashMerchant mint page
2. Click **"Create Passkey"** (instead of "Connect Keplr")
3. When prompted, authenticate with your fingerprint, face, or device PIN
4. Done. Your credential is stored securely on your device.

**Important:** There is no seed phrase to write down. Your device *is* the key. If you lose your device, you can recover using your phone's cloud backup (iCloud Keychain for Apple, Google Password Manager for Android, or Windows Hello backup).

### 3. Use It

Next time you visit:
1. Click **"Authenticate with Passkey"**
2. Authenticate with your biometrics
3. Sign transactions the same way — just biometrics, no Keplr popup

## Passkey vs Keplr: Which Should I Use?

| | **Passkey** | **Keplr Wallet** |
|---|---|---|
| **Best for** | Casual users, mobile-first | Power users, multiple chains |
| **What you need** | Just your phone/computer | Browser extension + seed phrase |
| **Recovery** | Device backup/iCloud/Google | 12/24 word seed phrase |
| **Phishing protection** | Built-in (domain-locked) | You must verify URLs yourself |
| **Cross-device** | Syncs via cloud to your devices | Manual import/export |
| **Works offline** | No (needs server challenge) | Yes |

**Recommendation:** Use passkeys for everyday minting and loyalty rewards. Use Keplr if you're managing significant portfolio value across multiple chains.

## Security: What's Actually Happening?

**What we know:** Nothing. Seriously. We never see your private key, your fingerprint data, or your device PIN.

**What stays on your device:**
- Your private key (mathematical secret)
- Your biometric data (fingerprint/face template)

**What we store:**
- A **public key** (like a lock that only your device can open)
- A **credential ID** (a random number that points to your key)

**What happens when you authenticate:**
Your device solves a math puzzle that only it can solve using its secret key. It sends us the proof. We check the proof against your public key. We can't forge the proof because we don't have your secret. Hackers can't steal your secret because it never leaves your device.

## Troubleshooting

**"WebAuthn not supported"**
- Update your browser or try Chrome/Safari
- Ensure you're on HTTPS (not HTTP)

**"No passkey found"**
- You may have cleared browser data or switched devices
- On your original device: Settings > Passwords > Check for saved passkeys
- Or simply create a new one (old ones auto-expire)

**"This operation is insecure"**
- Passkeys require a secure context. Try `https://` not `http://`
- Or use `localhost` during development

**"Credential creation cancelled"**
- You closed the biometric prompt. Just click the button and try again.
- Make sure your device has a screen lock configured.

**Switching devices?**
- **iPhone to iPhone:** Automatic via iCloud Keychain
- **Android to Android:** Automatic via Google Password Manager
- **Cross-platform:** Create a new passkey on the new device (old one will be replaced)

## Frequently Asked Questions

**What if I lose my phone?**  
Your passkey syncs to your Apple ID, Google account, or Windows account. Get a new phone, sign in to the same account, your passkey returns. If you didn't enable cloud backup, you'll need to create a new passkey.

**Can someone steal my fingerprint from your servers?**  
No. Your fingerprint never leaves your device. Apple's Secure Enclave and Android's StrongBox keep biometric data in hardware isolated from the operating system. We receive only a mathematical yes/no proof, not your biometrics.

**Why does it ask for my PIN sometimes?**  
If biometric fails or your device requires it (policy setting), you fall back to your device PIN. This is still secure — the PIN unlocks the same cryptographic chip.

**Is this blockchain specific?**  
The authentication is standards-based WebAuthn (used by Apple, Google, Microsoft). We convert that proof into a Cosmos-compatible signature so you can sign transactions without a traditional wallet.

