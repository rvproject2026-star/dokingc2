// ==========================================
// KODE LENGKAP APP.JS - RUANG DOCKING C2
// ==========================================

// --- 1. INISIALISASI KONFIGURASI FIREBASE ---
// (Ganti dengan konfigurasi Firebase Anda)
const firebaseConfig = {
    apiKey: "YOUR_API_KEY",
    authDomain: "YOUR_PROJECT_ID.firebaseapp.com",
    databaseURL: "https://YOUR_PROJECT_ID-default-rtdb.firebaseio.com",
    projectId: "YOUR_PROJECT_ID",
    storageBucket: "YOUR_PROJECT_ID.appspot.com",
    messagingSenderId: "YOUR_MESSAGING_SENDER_ID",
    appId: "YOUR_APP_ID"
};

// Inisialisasi Firebase
if (!firebase.apps.length) {
    firebase.initializeApp(firebaseConfig);
}
const database = firebase.database();

// Variabel Global
let globalDatabaseSnapshot = null;
let dataInput = {}; 

// --- 2. FITUR EFEK SUARA & GETAR (VIBRATION & AUDIO) ---
function playNotificationSound() {
    try {
        // Suara notifikasi singkat
        const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
        const osc = audioCtx.createOscillator();
        const gain = audioCtx.createGain();
        
        osc.type = 'sine';
        osc.frequency.setValueAtTime(587.33, audioCtx.currentTime); // Nada D5
        osc.frequency.exponentialRampToValueAtTime(880, audioCtx.currentTime + 0.15); // Nada A5
        
        gain.gain.setValueAtTime(0.3, audioCtx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.3);
        
        osc.connect(gain);
        gain.connect(audioCtx.destination);
        
        osc.start();
        osc.stop(audioCtx.currentTime + 0.3);
    } catch (e) {
        console.log("Audio not supported or blocked by browser.");
    }
}

function triggerVibration() {
    if ("vibrate" in navigator) {
        // Pola getar: 200ms - jeda 100ms - 200ms
        navigator.vibrate([200, 100, 200]);
    }
}

// --- 3. ANIMASI LOADING C2 & POP-UP INTERAKTIF ---
function showLoading(pesan = "Memproses Data C2...") {
    let loader = document.getElementById('c2LoaderOverlay');
    if (!loader) {
        loader = document.createElement('div');
        loader.id = 'c2LoaderOverlay';
        loader.style.cssText = `
            position: fixed; top: 0; left: 0; width: 100%; height: 100%;
            background: rgba(0, 0, 0, 0.7); display: flex; flex-direction: column;
            justify-content: center; align-items: center; z-index: 9999; color: white;
            font-family: Arial, sans-serif;
        `;
        loader.innerHTML = `
            <div style="font-size: 48px; font-weight: bold; color: #4A90E2; animation: bounce 1s infinite;">C2</div>
            <div id="c2LoaderText" style="margin-top: 15px; font-size: 16px;">${pesan}</div>
            <style>
                @keyframes bounce {
                    0%, 100% { transform: translateY(0); }
                    50% { transform: translateY(-15px); }
                }
            </style>
        `;
        document.body.appendChild(loader);
    } else {
        document.getElementById('c2LoaderText').innerText = pesan;
        loader.style.display = 'flex';
    }
}

function hideLoading() {
    const loader = document.getElementById('c2LoaderOverlay');
    if (loader) loader.style.display = 'none';
}

// --- 4. CARI & TAMPILKAN NASABAH BERDASARKAN KOLEKTOR ---
function muatDaftarNasabah() {
    const selectKolektor = document.getElementById('selectKolektor');
    const selectNasabah = document.getElementById('selectNasabah');
    
    if (!selectKolektor || !selectNasabah) return;
    
    const kolektorPilihan = selectKolektor.value.toUpperCase();
    selectNasabah.innerHTML = '<option value="">-- Pilih Nasabah --</option>';

    if (dataInput[kolektorPilihan]) {
        dataInput[kolektorPilihan].forEach(item => {
            let opt = document.createElement('option');
            opt.value = item.kontrak;
            opt.textContent = `${item.nama} (${item.kontrak})`;
            selectNasabah.appendChild(opt);
        });
    }
}

// --- 5. KIRIM LAPORAN KOLEKTOR KE FIREBASE ---
function kirimLaporan() {
    const kolektor = document.getElementById('selectKolektor')?.value;
    const noKontrak = document.getElementById('selectNasabah')?.value;
    const progres = document.getElementById('selectProgres')?.value; // PRED
    const tglJb = document.getElementById('inputTglJb')?.value; // JB
    const dlq = document.getElementById('inputDlq')?.value; // DELQ
    const ansus = document.getElementById('inputAnsus')?.value; // ANSUS
    const catatan = document.getElementById('inputCatatan')?.value;

    if (!kolektor || !noKontrak || !progres) {
        alert("Mohon lengkapi Kolektor, Nasabah, dan Progres Docking!");
        return;
    }

    // Ambil nama nasabah dari pilihan
    const selectNasabah = document.getElementById('selectNasabah');
    const namaNasabah = selectNasabah.options[selectNasabah.selectedIndex].text.split(' (')[0];

    showLoading("Mengirim Laporan ke Pak Bambang...");

    const payload = {
        kolektor: kolektor,
        noKontrak: noKontrak,
        namaNasabah: namaNasabah,
        progresDocking: progres, // Mengisi PRED
        tglJb: tglJb || "-",      // Mengisi JB
        dlq: dlq || "-",          // Mengisi DELQ
        ansus: ansus || "-",      // Mengisi ANSUS
        catatan: catatan || "-",
        waktuKirim: new Date().toLocaleString('id-ID')
    };

    database.ref('data_docking').push(payload, (error) => {
        hideLoading();
        if (error) {
            alert("❌ Gagal mengirim laporan: " + error.message);
        } else {
            // Sensasi Suara & Getar saat Berhasil
            triggerVibration();
            playNotificationSound();

            alert(`✅ Laporan untuk nasabah "${namaNasabah}" (Kontrak: ${noKontrak}) telah berhasil dikirim ke Pak Bambang!`);
            
            // Reset Form Input
            if (document.getElementById('formDocking')) {
                document.getElementById('formDocking').reset();
            }
        }
    });
}

// --- 6. LISTEN DATA REALTIME DI CONTROL PANEL PAK BAMBANG ---
function inisialisasiRealtimeListener() {
    const tabelBody = document.getElementById('tabelRekapBody');
    if (!tabelBody) return;

    database.ref('data_docking').on('value', (snapshot) => {
        globalDatabaseSnapshot = snapshot.val();
        tabelBody.innerHTML = '';

        if (!globalDatabaseSnapshot) {
            tabelBody.innerHTML = '<tr><td colspan="9" style="text-align:center;">Belum ada data laporan masuk.</td></tr>';
            return;
        }

        let nomor = 1;
        Object.keys(globalDatabaseSnapshot).forEach(key => {
            let item = globalDatabaseSnapshot[key];
            let row = document.createElement('tr');
            row.innerHTML = `
                <td><input type="checkbox" class="chk-nasabah" value="${key}"></td>
                <td>${nomor++}</td>
                <td>${item.kolektor || '-'}</td>
                <td>${item.namaNasabah || '-'}</td>
                <td>${item.noKontrak || '-'}</td>
                <td>${item.progresDocking || '-'}</td>
                <td>${item.tglJb || '-'}</td>
                <td>${item.dlq || '-'}</td>
                <td>${item.ansus || '-'}</td>
            `;
            tabelBody.appendChild(row);
        });
    });

    // Ambil Master Data Nasabah jika ada
    database.ref('master_nasabah').once('value', (snapshot) => {
        if (snapshot.exists()) {
            dataInput = snapshot.val();
        }
    });
}

// --- 7. UPLOAD EXCEL MASTER NASABAH (MENYIMPAN SELURUH STRUKTUR 52 KOLOM ASLI) ---
function uploadMasterExcelKeFirebase() {
    const fileInput = document.getElementById('excelMasterFile');
    if (!fileInput || fileInput.files.length === 0) {
        alert("Silakan pilih file Excel master terlebih dahulu!");
        return;
    }

    showLoading("Memproses & Mengunggah File Excel...");

    const file = fileInput.files[0];
    const reader = new FileReader();

    reader.onload = function(e) {
        try {
            const data = new Uint8Array(e.target.result);
            const workbook = XLSX.read(data, { type: 'array' });
            const firstSheetName = workbook.SheetNames[0];
            const worksheet = workbook.Sheets[firstSheetName];
            const rows = XLSX.utils.sheet_to_json(worksheet, { defval: "" });

            if (rows.length === 0) {
                hideLoading();
                alert("File Excel kosong atau format tidak terbaca!");
                return;
            }

            let structuredData = {};

            rows.forEach(row => {
                let kolektor = (row["KOLEKTOR"] || row["Kolektor"] || row["kolektor"] || "").toString().trim().toUpperCase();
                let namaCust = (row["NAMA CUSTOMER"] || row["Nama Customer"] || row["NAMA"] || row["Nama"] || "").toString().trim().toUpperCase();
                let noKontrak = (row["NO KONTRAK"] || row["No Kontrak"] || row["NO. KONTRAK"] || row["KONTRAK"] || row["Kontrak"] || "").toString().trim();

                if (kolektor && namaCust && noKontrak) {
                    if (!structuredData[kolektor]) {
                        structuredData[kolektor] = [];
                    }
                    structuredData[kolektor].push({
                        nama: namaCust,
                        kontrak: noKontrak,
                        rawRow: row // Menyimpan seluruh 52 kolom asli Excel
                    });
                }
            });

            if (Object.keys(structuredData).length === 0) {
                hideLoading();
                alert("Gagal membaca data! Pastikan header kolom Excel berisi: KOLEKTOR, NAMA CUSTOMER, NO KONTRAK.");
                return;
            }

            database.ref('master_nasabah').set(structuredData, (error) => {
                hideLoading();
                if (error) {
                    alert("Gagal menyimpan ke Firebase: " + error.message);
                } else {
                    dataInput = structuredData;
                    alert("✅ Berhasil! Master data nasabah telah disimpan di Firebase.");
                    fileInput.value = "";
                }
            });

        } catch (err) {
            hideLoading();
            console.error(err);
            alert("Terjadi kesalahan saat membaca file Excel: " + err.message);
        }
    };

    reader.readAsArrayBuffer(file);
}

// --- 8. FITUR PILIH / CENTANG SEMUA CHECKBOX ---
function toggleSelectAll(masterCheckbox) {
    const checkboxes = document.querySelectorAll('.chk-nasabah');
    checkboxes.forEach(cb => cb.checked = masterCheckbox.checked);
}

// --- 9. DOWNLOAD EXCEL REKAP (SESUAI STRUKTUR MASTER EXCEL + INPUTAN APK) ---
function downloadExcel() {
    let dataSudahInputExcel = [];
    let dataBelumInputExcel = [];
    let kontrakSudahInputMap = {};

    const checkboxes = document.querySelectorAll('.chk-nasabah:checked');

    // Kumpulkan data laporan dari Firebase yang dicentang
    if (globalDatabaseSnapshot && checkboxes.length > 0) {
        checkboxes.forEach(cb => {
            let key = cb.value;
            let item = globalDatabaseSnapshot[key];
            if (item && item.noKontrak) {
                let kontrakClean = item.noKontrak.toString().trim();
                kontrakSudahInputMap[kontrakClean] = item;
            }
        });
    }

    // Gabungkan dengan Master Data untuk mencetak kolom Excel asli
    if (dataInput && Object.keys(dataInput).length > 0) {
        Object.keys(dataInput).forEach(kolektor => {
            dataInput[kolektor].forEach(nasabahObj => {
                let kontrakClean = (nasabahObj.kontrak || "").toString().trim();
                
                // Ambil seluruh kolom asli dari Master Excel
                let baseRow = nasabahObj.rawRow ? { ...nasabahObj.rawRow } : {
                    "NO KONTRAK": nasabahObj.kontrak,
                    "NAMA CUSTOMER": nasabahObj.nama,
                    "KOLEKTOR": kolektor
                };

                if (kontrakSudahInputMap[kontrakClean]) {
                    let inputItem = kontrakSudahInputMap[kontrakClean];

                    // Timpa / Isi kolom sesuai inputan dari APK
                    baseRow["JB"] = inputItem.tglJb || baseRow["JB"] || "";
                    baseRow["PRED"] = inputItem.progresDocking || baseRow["PRED"] || "";
                    baseRow["DELQ"] = inputItem.dlq || baseRow["DELQ"] || "";
                    baseRow["ANSUS"] = inputItem.ansus || baseRow["ANSUS"] || "";

                    dataSudahInputExcel.push(baseRow);
                } else {
                    dataBelumInputExcel.push(baseRow);
                }
            });
        });
    }

    if (dataSudahInputExcel.length === 0 && dataBelumInputExcel.length === 0) {
        alert("Tidak ada data untuk diunduh!");
        return;
    }

    // Buat file Workbook Excel
    const workbook = XLSX.utils.book_new();

    if (dataSudahInputExcel.length > 0) {
        const worksheetSudah = XLSX.utils.json_to_sheet(dataSudahInputExcel);
        XLSX.utils.book_append_sheet(workbook, worksheetSudah, "Sudah Input");
    }

    if (dataBelumInputExcel.length > 0) {
        const worksheetBelum = XLSX.utils.json_to_sheet(dataBelumInputExcel);
        XLSX.utils.book_append_sheet(workbook, worksheetBelum, "Belum Input");
    }

    // Unduh File Excel
    XLSX.writeFile(workbook, "Rekap_Sistem_Ruang_Docking_Pusat.xlsx");
}

// --- 10. JALANKAN INISIALISASI SAAT HALAMAN SELESAI DIMUAT ---
document.addEventListener('DOMContentLoaded', () => {
    inisialisasiRealtimeListener();
});
