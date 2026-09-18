# 🛡️ VaultDrop — Zero-Cloud E2EE Peer-to-Peer File Transfer System

**VaultDrop** is a production-grade, zero-cloud, end-to-end encrypted (E2EE) peer-to-peer (P2P) file sharing system with native direct-to-disk streaming and full cross-device mobile phone support.

---

## 🚀 Key Features

1. **🌓 Dynamic Dark & Light Mode**:
   - Sleek header theme toggle with animated transitions.
   - Preserves your theme preference in `localStorage`.
2. **📱 Instant Phone & Mobile Wi-Fi Pairing**:
   - Built-in pure JavaScript **QR Code generator**.
   - Dual-server with **HTTPS on port 3443** ensuring full hardware-accelerated **Web Crypto API** (`crypto.subtle`) support on mobile Chrome and iOS Safari.
3. **Zero-Cloud & Zero-Knowledge Architecture**:
   - The Node.js signaling relay only negotiates WebSockets and WebRTC SDP/ICE.
   - Zero payload, zero storage, zero credentials on the server.
4. **Applied Web Cryptography**:
   - **PBKDF2** with SHA-256 and **100,000 iterations**.
   - **AES-GCM-256** with unique 12-byte CSPRNG IV per 64 KB chunk.
   - Wire format: `[12-byte IV][Ciphertext + 16-byte GCM Tag]`.
   - Deterministic visual security fingerprint (`🦊 🪐 🔑 🛡️`).
5. **High-Performance Backpressure Control & Direct Disk Streaming**:
   - 64 KB streaming slices with **8 MB backpressure threshold**.
   - **Native File System Access API** (`showSaveFilePicker` + `createWritable`) writing directly to disk with constant O(1) Zero-RAM consumption.
   - Fallback buffer mode for browsers without File System Access.

---

## 🛠️ Quick Start & Local Setup

### 1. Start the Server
```bash
node server.js
```

The terminal will display both Desktop and Mobile Phone LAN links:
```
===========================================================
  🛡️  VAULTDROP - E2EE ZERO-CLOUD P2P FILE SHARING SYSTEM
===========================================================
  💻 Desktop (HTTP):    http://localhost:3000
  🌐 LAN (HTTP):        http://192.168.1.50:3000
-----------------------------------------------------------
  📱 Phone/HTTPS (LAN): https://192.168.1.50:3443
-----------------------------------------------------------
```

---

## 📱 How to Pair & Test with Your Phone

1. Open `http://localhost:3000` on your PC.
2. Click **"Scan on Phone"** (or the QR icon in the header).
3. Open your phone's camera and scan the QR code.
4. Tap the link to open `https://<ip>:3443` on your phone.
5. *First-time Note:* On your phone browser, tap **"Advanced" ➔ "Proceed to <ip> (unsafe)"** to accept the local self-signed certificate. This unlocks the Web Crypto API on mobile browsers.
6. Your phone and PC will automatically pair with the exact same room code and security fingerprint!
7. Drag & drop files on either device to stream them directly over your local Wi-Fi.

---

## 📄 License
MIT License. Built with modern Web Standards.
