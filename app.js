// --- 1. INISIALISASI FIREBASE ---
if (!firebase.apps.length) {
    firebase.initializeApp(firebaseConfig);
}
const database = firebase.database();

let globalDatabaseSnapshot = null;
let userAktif = null;
let dataInput = {};

// --- 2. MUAT DATA DARI FIREBASE SAAT HALAMAN DIBUKA ---
window.addEventListener('DOMContentLoaded', () => {
    // Listener untuk Master Nasabah
    database.ref('master_nasabah').on('value', (snapshot) => {
        if (snapshot.exists()) {
            dataInput = snapshot.val();
            const collectorSelect = document.getElementById('collector_select');
            if (collectorSelect) {
                const currentVal = collectorSelect.value;
                collectorSelect.innerHTML = '<option value="">-- Pilih Nama Kolektor --</option>';
                Object.keys(dataInput).forEach(collector => {
                    let option = document.createElement('option');
                    option.value = collector;
                    option.text = collector;
                    collectorSelect.appendChild(option);
                });
                if (currentVal) collectorSelect.value = currentVal;
            }
        }
    });

    // Listener Realtime untuk Data Docking (Otomatis memperbarui halaman Pak Bambang & Live Input)
    database.ref('data_docking').on('value', (snapshot) => {
        const dataObjek = snapshot.val();
        globalDatabaseSnapshot = dataObjek;
        
        // Perbarui tampilan secara langsung (Realtime)
        tampilkanRiwayatSingkat(dataObjek);
        tampilkanTabelOnlinePakSalman(dataObjek);
        
        // Perbarui filter dropdown kolektor jika sedang dipilih
        const collectorSelect = document.getElementById('collector_select');
        if (collectorSelect && collectorSelect.value) {
            filterCustomers(collectorSelect.value);
        }
    });
});


// --- 3. LOGIKA LOGIN DENGAN ANIMASI C2 ---
function prosesLogin(event) {
    event.preventDefault();
    
    const inputNik = document.getElementById('password').value.trim();
    const errorMsg = document.getElementById('errorMsg');
    const btnSubmit = document.querySelector('.btn-submit');
    
    if (!inputNik) {
        errorMsg.innerText = "Masukkan NIK terlebih dahulu!";
        errorMsg.style.display = 'block';
        return;
    }

    if (typeof showLoading === 'function') showLoading("Memverifikasi Hak Akses...");
    btnSubmit.innerText = "MEMVERIFIKASI...";
    btnSubmit.disabled = true;
    errorMsg.style.display = 'none';

    const emailSemu = `${inputNik}@doking.com`;
    const passwordSemu = inputNik;

    let isFinished = false;
    const timeoutId = setTimeout(() => {
        if (!isFinished) {
            isFinished = true;
            if (typeof hideLoading === 'function') hideLoading();
            btnSubmit.innerText = "MASUK SISTEM";
            btnSubmit.disabled = false;
            errorMsg.innerText = "Koneksi ke Firebase Timeout. Periksa jaringan Anda.";
            errorMsg.style.display = 'block';
        }
    }, 6000);

    firebase.auth().signInWithEmailAndPassword(emailSemu, passwordSemu)
        .then(() => {
            return database.ref('master_karyawan/' + inputNik).once('value');
        })
        .then((snapshot) => {
            if (isFinished) return;
            isFinished = true;
            clearTimeout(timeoutId);
            if (typeof hideLoading === 'function') hideLoading();

            btnSubmit.innerText = "MASUK SISTEM";
            btnSubmit.disabled = false;

            if (snapshot.exists()) {
                userAktif = snapshot.val();
                userAktif.nik = inputNik;
                errorMsg.style.display = 'none';
                document.getElementById('password').value = '';

                document.getElementById('userNama').innerText = userAktif.nama;
                document.getElementById('userJabatan').innerText = userAktif.jabatan;
                document.getElementById('userFoto').src = userAktif.foto || 'default.png';

                const btnAksiProfil = document.getElementById('btnAksiProfil');
                if (userAktif.khusus) {
                    btnAksiProfil.innerHTML = '<i class="fa-solid fa-sliders"></i> REKAP HASIL DOCKING';
                } else {
                    btnAksiProfil.innerHTML = '<i class="fa-solid fa-pen-to-square"></i> ISI DATA DOCKING';
                }

                switchPage('sectionProfil');
            } else {
                errorMsg.innerText = "⚠️ Akun Auth valid, tapi NIK tidak ada di database 'master_karyawan'!";
                errorMsg.style.display = 'block';
            }
        })
        .catch((error) => {
            if (isFinished) return;
            isFinished = true;
            clearTimeout(timeoutId);
            if (typeof hideLoading === 'function') hideLoading();

            btnSubmit.innerText = "MASUK SISTEM";
            btnSubmit.disabled = false;
            
            errorMsg.innerText = "Gagal: " + error.message;
            errorMsg.style.display = 'block';
        });
}

// --- 4. NAVIGASI HALAMAN ---
function switchPage(pageId) {
    document.querySelectorAll('.page-section').forEach(section => {
        section.classList.remove('active');
    });
    document.getElementById(pageId).classList.add('active');
}

function bukaHalamanKerja() {
    if (userAktif && userAktif.khusus) {
        switchPage('sectionRekapSalman');
    } else {
        document.getElementById('karyawanHeaderTitle').innerText = "Ruang Docking — " + userAktif.nama.toUpperCase();
        switchPage('sectionInputDocking');
    }
}

function logout() {
    firebase.auth().signOut().then(() => {
        userAktif = null;
        document.getElementById('updateForm').reset();
        document.getElementById('customer_select').innerHTML = '<option value="">-- Pilih Kolektor Dahulu --</option>';
        document.getElementById('customer_select').disabled = true;
        document.getElementById('no_kontrak').value = '';
        switchPage('sectionLogin');
    });
}

// --- 5. FILTER NASABAH & PENANGANAN KONTRAK GANDA ---
function filterCustomers(selectedCollector) {
    const customerSelect = document.getElementById('customer_select');
    const noKontrakInput = document.getElementById('no_kontrak');
    customerSelect.innerHTML = '<option value="">-- Pilih Nama Nasabah & Kontrak --</option>';
    noKontrakInput.value = '';

    if (selectedCollector === "" || !dataInput[selectedCollector]) {
        customerSelect.disabled = true;
        return;
    }

    let kontrakSudahInput = [];
    if (globalDatabaseSnapshot) {
        Object.keys(globalDatabaseSnapshot).forEach(key => {
            let item = globalDatabaseSnapshot[key];
            if (item.remedialMk2 && item.remedialMk2.toUpperCase() === selectedCollector.toUpperCase()) {
                if (item.noKontrak) {
                    kontrakSudahInput.push(item.noKontrak.toString().trim());
                }
            }
        });
    }

    let listTersedia = dataInput[selectedCollector].filter(cust => {
        let kontrakClean = (cust.kontrak || "").toString().trim();
        return !kontrakSudahInput.includes(kontrakClean);
    });

    if (listTersedia.length === 0) {
        customerSelect.innerHTML = '<option value="">🎉 Semua nasabah kolektor ini sudah selesai!</option>';
        customerSelect.disabled = true;
        return;
    }

    listTersedia.forEach(custObj => {
        let option = document.createElement('option');
        option.value = custObj.kontrak; 
        option.text = `${custObj.nama} — Kontrak: ${custObj.kontrak}`;
        option.dataset.namaCustomer = custObj.nama;
        customerSelect.appendChild(option);
    });
    customerSelect.disabled = false;
}

function isiOtomatisNoKontrak(kontrakTerpilih) {
    const noKontrakInput = document.getElementById('no_kontrak');
    if (!kontrakTerpilih) {
        noKontrakInput.value = '';
        return;
    }
    noKontrakInput.value = kontrakTerpilih;
}

// --- 6. PENGIRIMAN DATA KE FIREBASE ---
function kirimKeFirebase(event) {
    event.preventDefault();
    const btn = document.getElementById('btnSubmit');
    const collector = document.getElementById('collector_select').value;
    const customerSelect = document.getElementById('customer_select');
    const selectedOption = customerSelect.options[customerSelect.selectedIndex];
    
    const customerName = selectedOption ? (selectedOption.dataset.namaCustomer || selectedOption.text || "Nasabah") : "";
    const nomorKontrak = document.getElementById('no_kontrak').value;

    if (!customerName || !nomorKontrak) {
        alert("Silakan pilih nasabah dan nomor kontrak dengan benar!");
        return;
    }

    if (typeof showLoading === 'function') showLoading("Mengirim Laporan ke Pak Bambang...");
    btn.disabled = true;
    btn.innerText = "Mengirim...";
    
    let objekData = {
        namaCustomer: customerName.toUpperCase(),
        noKontrak: nomorKontrak.toString().trim(),
        remedialMk2: collector.toUpperCase(),
        progresDocking: document.getElementById('prediksi_sukses').value,
        tglJb: document.getElementById('tgl_prediksi_jb').value,
        dlq: document.getElementById('deliquency').value.toUpperCase(),
        ansus: document.getElementById('detail_kasus').value,
        inputBy: userAktif ? userAktif.nama : "Karyawan"
    };

    database.ref('data_docking').push(objekData, function(error) {
        if (typeof hideLoading === 'function') hideLoading();
        btn.disabled = false;
        btn.innerText = "Kirim Laporan";

        if (error) {
            alert("Gagal mengirim data: " + error.message);
        } else {
            if ("vibrate" in navigator) {
                navigator.vibrate([200, 100, 200]);
            }

            try {
                let audioNotif = new Audio('https://assets.mixkit.co/active_storage/sfx/2869/2869-preview.mp3');
                audioNotif.play().catch(e => console.log("Audio diblokir oleh browser"));
            } catch(e) {}

            alert(`✅ Laporan untuk nasabah "${customerName.toUpperCase()}" (Kontrak: ${nomorKontrak}) telah berhasil dikirim!`);
            
            document.getElementById('updateForm').reset();
            document.getElementById('customer_select').innerHTML = '<option value="">-- Pilih Kolektor Dahulu --</option>';
            document.getElementById('customer_select').disabled = true;
            document.getElementById('no_kontrak').value = '';
        }
    });
}

// --- 7. UPLOAD EXCEL MASTER NASABAH ---
function uploadMasterExcelKeFirebase() {
    const fileInput = document.getElementById('excelMasterFile');
    if (fileInput.files.length === 0) {
        alert("Silakan pilih file Excel terlebih dahulu!");
        return;
    }

    if (typeof showLoading === 'function') showLoading("Memproses & Mengunggah File Excel...");

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
                if (typeof hideLoading === 'function') hideLoading();
                alert("File Excel kosong atau format tidak terbaca!");
                return;
            }

            let structuredData = {};

            rows.forEach(row => {
                let kolektor = (row["KOLEKTOR"] || row["Kolektor"] || row["kolektor"] || "").toString().trim().toUpperCase();
                let namaCust = (row["NAMA CUSTOMER"] || row["Nama Customer"] || row["NAMA"] || row["Nama"] || "").toString().trim().toUpperCase();
                let noKontrak = (row["NO KONTRAK"] || row["No Kontrak"] || row["NO. KONTRAK"] || row["KONTRAK"] || row["Kontrak"] || row["kontrak"] || "").toString().trim();

                if (kolektor && namaCust && noKontrak) {
                    if (!structuredData[kolektor]) {
                        structuredData[kolektor] = [];
                    }
                    structuredData[kolektor].push({
                        nama: namaCust,
                        kontrak: noKontrak,
                        rawRow: row
                    });
                }
            });

            if (Object.keys(structuredData).length === 0) {
                if (typeof hideLoading === 'function') hideLoading();
                alert("Gagal membaca data. Pastikan baris judul Excel menggunakan: KOLEKTOR, NAMA CUSTOMER, NO KONTRAK.");
                return;
            }

            database.ref('master_nasabah').set(structuredData, (error) => {
                if (typeof hideLoading === 'function') hideLoading();
                if (error) {
                    alert("Gagal menyimpan ke Firebase: " + error.message);
                } else {
                    alert("✅ Berhasil! Master data nasabah telah diperbarui di Firebase.");
                    fileInput.value = "";
                }
            });

        } catch (err) {
            if (typeof hideLoading === 'function') hideLoading();
            console.error(err);
            alert("Terjadi kesalahan saat membaca file Excel: " + err.message);
        }
    };

    reader.readAsArrayBuffer(file);
}

// --- 8. TABEL LIVE HISTORY & CONTROL PANEL PAK BAMBANG ---
function tampilkanRiwayatSingkat(dataObjek) {
    const tbody = document.getElementById('liveHistoryBody');
    const badgeCount = document.getElementById('liveCount');
    
    if (!dataObjek) {
        badgeCount.textContent = "0 Terinput";
        tbody.innerHTML = '<tr><td colspan="4" class="empty-state">Belum ada input masuk hari ini.</td></tr>';
        return;
    }

    let keys = Object.keys(dataObjek);
    badgeCount.textContent = keys.length + " Terinput";

    let htmlString = "";
    let counter = 1;

    keys.reverse().forEach(key => {
        let item = dataObjek[key];
        let badgeClass = 'status-pending';
        if (item.progresDocking === 'SELESAI') badgeClass = 'status-selesai';
        if (item.progresDocking === 'TIDAK SELESAI') badgeClass = 'status-tidak';

        htmlString += `<tr>
            <td style="text-align: center; font-weight: bold; color: var(--text-muted);">${counter++}</td>
            <td><strong>${item.namaCustomer}</strong><br><small style="color:var(--text-muted)">Kontrak: ${item.noKontrak}</small></td>
            <td>${item.remedialMk2}</td>
            <td><span class="badge-status ${badgeClass}">${item.progresDocking}</span></td>
        </tr>`;
    });
    tbody.innerHTML = htmlString;
}

function tampilkanTabelOnlinePakSalman(dataObjek) {
    const wrapper = document.getElementById('tableWrapper');
    
    if (!dataObjek) {
        document.getElementById('totalNasabah').textContent = "0";
        document.getElementById('totalTerpilih').textContent = "0";
        wrapper.innerHTML = '<div class="empty-state">Belum ada pengiriman data dari kolektor.</div>';
        return;
    }

    let keys = Object.keys(dataObjek);
    document.getElementById('totalNasabah').textContent = keys.length;
    document.getElementById('totalTerpilih').textContent = keys.length;

    let tableHtml = `
        <div class="table-responsive">
            <table>
                <thead>
                    <tr>
                        <th style="width: 50px; text-align:center;">PILIH</th>
                        <th style="width: 50px; text-align:center;">NO</th>
                        <th>NAMA CUSTOMER</th>
                        <th>NO KONTRAK</th>
                        <th>REMEDIAL / MK2</th>
                        <th>JANJI BAYAR</th>
                        <th>DLQ</th>
                        <th>DETAIL KASUS (ANSUS)</th>
                        <th>PREDIKSI KELAYAKAN</th>
                        <th>INPUT OLEH</th>
                    </tr>
                </thead>
                <tbody>
    `;

    let counter = 1;
    for (let key in dataObjek) {
        let item = dataObjek[key];
        let badgeClass = 'status-pending';
        if (item.progresDocking === 'SELESAI') badgeClass = 'status-selesai';
        if (item.progresDocking === 'TIDAK SELESAI') badgeClass = 'status-tidak';

        tableHtml += `
            <tr>
                <td style="text-align:center;">
                    <input type="checkbox" class="chk-nasabah" value="${key}" checked onchange="hitungTerpilih()">
                </td>
                <td style="text-align:center; color: var(--text-muted);">${counter++}</td>
                <td><strong style="color: var(--text-main);">${item.namaCustomer}</strong></td>
                <td style="color: #475569; font-weight: 600;">${item.noKontrak || "-"}</td>
                <td>${item.remedialMk2}</td>
                <td style="color: var(--primary); font-weight: 600;">${item.tglJb}</td>
                <td style="font-weight: 600;">${item.dlq}</td>
                <td style="max-width: 240px; white-space: normal; word-wrap: break-word;">${item.ansus}</td>
                <td><span class="badge-status ${badgeClass}">${item.progresDocking}</span></td>
                <td style="color: var(--primary); font-weight: 600;">${item.inputBy || 'Karyawan'}</td>
            </tr>
        `;
    }

    tableHtml += `</tbody></table></div>`;
    wrapper.innerHTML = tableHtml;
}

function hitungTerpilih() {
    const checkedCount = document.querySelectorAll('.chk-nasabah:checked').length;
    document.getElementById('totalTerpilih').textContent = checkedCount;
}

function hapusSemuaDatabase() {
    if (confirm("⚠️ PERINGATAN: Tindakan ini akan mengosongkan seluruh laporan docking harian. Anda yakin?")) {
        if (typeof showLoading === 'function') showLoading("Membersihkan Database...");
        database.ref('data_docking').remove()
            .then(() => {
                if (typeof hideLoading === 'function') hideLoading();
                alert("Data laporan docking berhasil dibersihkan.");
            })
            .catch((error) => {
                if (typeof hideLoading === 'function') hideLoading();
                alert("Gagal menghapus data: " + error.message);
            });
    }
}

// --- 9. DOWNLOAD EXCEL REKAP ---
function downloadExcel() {
    let dataSudahInputExcel = [];
    let kontrakSudahInputList = [];
    let indexSudah = 1;

    const checkboxes = document.querySelectorAll('.chk-nasabah:checked');
    
    if (globalDatabaseSnapshot && checkboxes.length > 0) {
        checkboxes.forEach(cb => {
            let key = cb.value;
            let item = globalDatabaseSnapshot[key];
            if (item) {
                if (item.noKontrak) kontrakSudahInputList.push(item.noKontrak.toString().trim());
                dataSudahInputExcel.push({
                    "NO": indexSudah++,
                    "NAMA CUSTOMER": item.namaCustomer,
                    "NO KONTRAK": item.noKontrak || "-",
                    "REMEDIAL / MK2": item.remedialMk2,
                    "JANJI BAYAR": item.tglJb,
                    "DLQ": item.dlq,
                    "DETAIL KASUS (ANSUS)": item.ansus,
                    "PREDIKSI": item.progresDocking,
                    "INPUT OLEH": item.inputBy || "Karyawan"
                });
            }
        });
    }

    let dataBelumInputExcel = [];
    let indexBelum = 1;

    if (dataInput) {
        Object.keys(dataInput).forEach(kolektor => {
            dataInput[kolektor].forEach(nasabahObj => {
                let kontrakClean = (nasabahObj.kontrak || "").toString().trim();
                if (!kontrakSudahInputList.includes(kontrakClean)) {
                    dataBelumInputExcel.push({
                        "NO": indexBelum++,
                        "NAMA CUSTOMER": nasabahObj.nama,
                        "NO KONTRAK": nasabahObj.kontrak,
                        "REMEDIAL / MK2": kolektor,
                        "STATUS KETERANGAN": "BELUM INPUT DATA DOCKING"
                    });
                }
            });
        });
    }

    const workbook = XLSX.utils.book_new();

    if (dataSudahInputExcel.length > 0) {
        const worksheetSudah = XLSX.utils.json_to_sheet(dataSudahInputExcel);
        XLSX.utils.book_append_sheet(workbook, worksheetSudah, "Sudah Input");
    }

    if (dataBelumInputExcel.length > 0) {
        const worksheetBelum = XLSX.utils.json_to_sheet(dataBelumInputExcel);
        XLSX.utils.book_append_sheet(workbook, worksheetBelum, "Belum Input");
    }

    XLSX.writeFile(workbook, "Rekap_Sistem_Ruang_Docking_Pusat.xlsx");
}
// Tambahkan listener untuk mendeteksi saat aplikasi aktif kembali di WebView
document.addEventListener("visibilitychange", function() {
    if (document.visibilityState === "visible") {
        // Paksa Firebase menyambung kembali saat aplikasi dibuka/fokus lagi
        database.goOnline();
        console.log("Aplikasi aktif kembali, menyinkronkan Firebase...");
    } else {
        database.goOffline();
    }
});

