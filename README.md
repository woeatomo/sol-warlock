# 🧙 Sol Warlock v1.8: Bot LP Solana (Meteora DLMM)

Bot LP otomatis untuk Meteora DLMM. Default-nya mode PAPER (simulasi, tanpa uang asli), dikontrol lewat Telegram Mini App. Tidak pakai AI/LLM.


## ⚠️ Versi patched di atas v1.8 (14 Nov 2026)
Fork dari [sicknature-x/Sol-Warlock-Meteora-LP-Bot](https://github.com/sicknature-x/Sol-Warlock-Meteora-LP-Bot) (upstream v1.8).

Strategi, filter, dan semua default setelan **sama persis** dengan upstream v1.8. Yang diubah hanya biaya, kejujuran dry run, dan operasional:
1. **Fee developer 0,5% dibuang.** Upstream memotong 50 bps di setiap swap live ke akun yang disamarkan base64; dry run tidak kena. Sekarang tanpa fee. Opsional `OWNER_FEE_BPS` + `OWNER_FEE_WALLET` (kosong = mati, maks 100 bps), berlaku sama di dry run dan live.
2. **Jeda cek posisi dry run = live:** `POSITION_POLL_SEC` (default 30 detik). Scan kandidat tetap `POLL_SEC` (300). Upstream: dry run ~10 detik, live 300 detik.
3. **Cek biaya non-refundable tidak lagi dilewati** untuk range lebar. `MAX_NONREFUND_SOL=0.001` = hanya pool yang bin array-nya sudah ada (`0` = cek mati).
4. **Hemat RPC:** objek DLMM di-cache per pool, cek biaya bin array jalan paling akhir, log `RPC usage` tiap jam.
5. **File PM2 ditambahkan:** `ecosystem.public.config.cjs` (dry run + mini app) dan `ecosystem.public-live.config.cjs` (live, dipanggil tombol Live ON). Jangan isi `PAPER`, `DRY_RUN`, `LIVE_CONFIRMED` di `.env`.
6. Port mini app default `8797` (README upstream menulis 8787).

### Modal SOL + sweep profit bulanan (tambahan fork ini)
Pilih aset modal **SOL** di menu Live mini app. Setelan ini dipakai dry run dan live.
- **Tanpa swap USDC↔SOL.** Budget posisi diambil dari SOL bebas (`POSITION_USDC` tetap dalam dolar, dikonversi ke SOL pada harga saat open), buffer gas dari budget yang sama, token hasil close di-swap ke SOL. TP/SL/SL+ dihitung dari net SOL.
- **Hanya pool ber-quote SOL** yang dibuka (dry run dan live).
- **Live:** isi wallet dengan SOL. SOL bebas = saldo wallet − cadangan tiap posisi terbuka − 0,05 SOL cadangan fee. USDC di wallet tidak dipakai sebagai modal. Go Live butuh minimal 0,40 SOL.
- **Sweep bulanan:** pada siklus pertama tiap bulan baru (WIB), profit *terealisasi* dalam SOL dari trade yang ditutup sebelum bulan itu, dikurangi yang sudah di-sweep, di-swap SOL→USDC. Bulan rugi dibawa ke depan (modal SOL tidak ikut di-sweep). Posisi yang masih terbuka baru dihitung saat ditutup. Hanya SOL bebas yang di-swap; sisanya menyusul. Notifikasi dikirim ke Telegram, riwayat ada di `status.json` (`profitSweep`).
  - `PROFIT_SWEEP_MONTHLY=0` mematikan (default nyala, hanya aktif saat modal SOL). `PROFIT_SWEEP_MIN_SOL` = sweep terkecil (default 0.01).
  - Di dry run USDC hasil sweep diparkir terpisah dan tetap dihitung sebagai equity; di live USDC-nya tinggal di wallet.
- **Belum dites on-chain.** Go Live tetap terkunci sampai `sol-capital` dan `profit-sweep` dites dana kecil dan dicatat: `node record-live-verification.js sol-capital "..."`.

## Fitur
- Screening pool (fee/TVL, bin step, umur pool, filter pump)
- SL -20%, TP +20%, TP Emergency +10% (default ON)
- SL Blacklist: token yang kena SL nggak dibuka lagi
- Close Stale: atur jam, mode keluar (langsung, minus X%, BEP, profit X%)
- Shape Spot:Bid-Ask bebas, trailing opsional (default OFF)
- Mini App: Status, Settings, Wallet, PnL Calendar, Live

## 0. Yang perlu disiapkan
- VPS Linux Ubuntu 22.04/24.04, minimal RAM 1 GB. Bisa sewa di [SumoPod](https://sumopod.com/) (bayar pakai QRIS), Tencent Cloud, DigitalOcean, Vultr, Contabo, dll. Catat IP, username, dan password/SSH key-nya.
- Aplikasi Termius (atau terminal SSH lain). Di Termius: New Host, isi IP, username, password, lalu Connect.
- Akun Telegram.

## 1. Bikin bot Telegram
1. Chat **@BotFather**, kirim `/newbot`.
2. Kasih nama, lalu username yang diakhiri `bot` (contoh: `LPkuBot`).
3. Simpan **token** dari BotFather (bentuknya `123456:ABC...`). Ini rahasia.
4. Chat **@userinfobot**, kirim `/start`, catat angka **Id** kamu.
5. Buka bot barumu dan tekan **Start**.

## 2. Install Node.js + PM2 di VPS
Login ke VPS, lalu jalankan:

    sudo apt update && sudo apt install -y curl unzip wget git
    curl -fsSL https://deb.nodesource.com/setup_22.x | sudo -E bash -
    sudo apt install -y nodejs
    sudo npm install -g pm2
    node -v

Pastikan `node -v` menunjukkan v22 atau lebih.

## 3. Download dari GitHub

    cd ~
    git clone https://github.com/woeatomo/sol-warlock.git
    cd sol-warlock/sol-lp-bot
    npm ci --omit=dev

## 4. Isi file .env

    cp .env.example .env
    chmod 600 .env
    nano .env

Nilai yang diawali `isi_` dianggap kosong dan bot pakai default. Cukup ganti ini:

| Baris | Isi dengan | Wajib? |
|---|---|---|
| `TELEGRAM_BOT_TOKEN=` | token dari BotFather | Wajib |
| `TELEGRAM_ALLOWED_ID=` | Id Telegram kamu | Wajib |
| `TELEGRAM_CHAT_ID=` | Id yang sama | Wajib |
| `ALLOWED_TG_IDS=` | Id yang sama | Wajib |
| `TELEGRAM_BOT_USERNAME=` | username bot, tanpa @ | Disarankan |
| `MINIAPP_URL=` | URL https mini app (langkah 6) | Untuk mini app |
| `SOLANA_RPC_URL=` | URL RPC, misalnya dari helius.dev (gratis) | Disarankan |
| `HELIUS_API_KEY=` | API key Helius | Opsional |
| `JUPITER_API_KEY=` | API key Jupiter | Opsional |
| `PRIVATE_KEY=` | biarkan placeholder selama paper | Hanya live |
| `WALLET_PUBLIC_KEY=` | alamat wallet (bukan private key) | Hanya live |

Baris strategi dan filter biarkan saja, nanti bisa diubah dari menu Settings di mini app. Simpan di nano: `Ctrl+O`, Enter, lalu `Ctrl+X`.

## 5. Jalankan bot

    pm2 start ecosystem.public.config.cjs
    pm2 save
    pm2 startup
    pm2 status
    pm2 logs --lines 30

Setelah `pm2 startup`, jalankan perintah yang ditampilkan supaya bot nyala lagi setelah VPS reboot. Semua proses di `pm2 status` harus "online".

## 6. Mini app (dashboard di Telegram)
Mini app jalan di `127.0.0.1:8797`, dan Telegram butuh alamat https. Pakai Cloudflare tunnel gratis:

    curl -L -o cloudflared https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-linux-amd64
    chmod +x cloudflared && sudo mv cloudflared /usr/local/bin/
    pm2 start "cloudflared tunnel --url http://127.0.0.1:8797" --name miniapp-tunnel
    pm2 logs miniapp-tunnel --lines 20

1. Cari URL `https://xxxx.trycloudflare.com` di log, salin ke `MINIAPP_URL=` di `.env`, lalu `pm2 restart all`.
2. Di @BotFather: `/mybots`, pilih bot, Bot Settings, Menu Button, tempel URL yang sama.
3. Buka bot di Telegram dan tekan tombol menu.

URL trycloudflare berubah kalau tunnel di-restart, jadi ulangi langkah 1 dan 2 kalau itu terjadi.

## 7. Paper vs Live
- Default: dry run / paper (aman, tanpa uang asli).
- Pindah ke live lewat tab **Live** di mini app (konfirmasi dua kali). Live butuh wallet yang sudah diisi dan file `STOP` sudah dihapus.
- Live bisa rugi uang asli. Pakai wallet khusus dengan saldo kecil dulu.

## 8. Perintah berguna

    pm2 status
    pm2 logs --lines 50
    pm2 restart all
    pm2 stop all

## Update dari versi lama (v1.0–v1.4)

    cd ~/sol-warlock && git pull
    rsync -a --exclude '.env' --exclude 'paper/' --exclude 'node_modules/' ~/Sol-Warlock-Meteora-LP-Bot/sol-lp-bot/ ~/sol-lp-bot/
    cd ~/sol-lp-bot && npm ci --omit=dev
    pm2 restart all && pm2 status

Kalau belum punya folder clone-nya, jalankan dulu bagian langkah 3 (`git clone`). File `.env` dan data paper kamu tetap aman. Kalau kamu sudah live dan sempat menghapus `STOP`, update ini memunculkannya lagi sehingga bot berhenti dulu (aman). Hapus lagi `STOP` kalau mau lanjut live.

## Keamanan
- Jangan pernah share atau upload isi `.env`, token, atau private key.
- Bot hanya merespon Id Telegram yang diisi di `.env`.

## Disclaimer
Bukan saran finansial. LP di token baru berisiko tinggi, gunakan dengan risiko sendiri.

💡 Bisa backtest sendiri pakai Grok Bot.
