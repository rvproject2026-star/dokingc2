// --- 1. INISIALISASI FIREBASE (Wajib Ada di Awal) ---
if (!firebase.apps.length) {
    firebase.initializeApp(firebaseConfig);
}
const database = firebase.database();

let globalDatabaseSnapshot = null;
let userAktif = null;
let dataInput = {};

// --- 2. MUAT DATA DARI FIREBASE SAAT HALAMAN DIBUKA ---
window.addEventListener('DOMContentLoaded', () => {
    // Ambil Master Nasabah dari Firebase
    database.ref('master_nasabah').on('value', (snapshot) => {
        if (snapshot.exists()) {
            dataInput = snapshot.val();
            
            // Isi dropdown kolektor
            const collectorSelect = document.getElementById('collector_select');
            if (collectorSelect) {
                collectorSelect.innerHTML = '<option value="">-- Pilih Nama Kolektor --</option>';
                Object.keys(dataInput).forEach(collector => {
                    let option = document.createElement('option');
                    option.value = collector;
                    option.text = collector;
                    collectorSelect.appendChild(option);
                });
            }
        }
    });

    // Listener Realtime Data Docking Hari Ini
    database.ref('data_docking').on('value', (snapshot) => {
        const dataObjek = snapshot.val();
        globalDatabaseSnapshot = dataObjek;
        
        tampilkanRiwayatSingkat(dataObjek);
        tampilkanTabelOnlinePakSalman(dataObjek);
        
        const currentCollector = document.getElementById('collector_select').value;
        if (currentCollector) {
            filterCustomers(currentCollector);
        }
    });
});

// --- 3. LOGIKA LOGIN FIREBASE AUTH DENGAN EMAIL SEMU ---
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

    btnSubmit.innerText = "MEMVERIFIKASI...";
    btnSubmit.disabled = true;
    errorMsg.style.display = 'none';

    const emailSemu = `${inputNik}@doking.com`;
    const passwordSemu = inputNik; // Asumsi password adalah NIK

    // Pengaman Timeout (6 detik)
    let isFinished = false;
    const timeoutId = setTimeout(() => {
        if (!isFinished) {
            isFinished = true;
            btnSubmit.innerText = "MASUK SISTEM";
            btnSubmit.disabled = false;
            errorMsg.innerText = "Koneksi ke Firebase Timeout. Periksa jaringan Anda.";
            errorMsg.style.display = 'block';
        }
    }, 6000);

    // Proses login ke Firebase Authentication
    firebase.auth().signInWithEmailAndPassword(emailSemu, passwordSemu)
        .then((userCredential) => {
            // Ambil data profil dari Realtime Database berdasarkan NIK
            return database.ref('master_karyawan/' + inputNik).once('value');
        })
        .then((snapshot) => {
            if (isFinished) return;
            isFinished = true;
            clearTimeout(timeoutId);

            btnSubmit.innerText = "MASUK SISTEM";
            btnSubmit.disabled = false;

            if (snapshot.exists()) {
                userAktif = snapshot.val();
                userAktif.nik = inputNik;
                errorMsg.style.display = 'none';
                document.getElementById('password').value = '';

                // Tampilkan data ke profil
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

            btnSubmit.innerText = "MASUK SISTEM";
            btnSubmit.disabled = false;
            
            console.error("Error Login:", error.code, error.message);
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
        switchPage('sectionLogin');
    }).catch((error) => {
        console.error("Gagal logout:", error);
    });
}

// --- 5. FORM LOGIC: FILTER & AUTOFILL NOMOR KONTRAK ---
function filterCustomers(selectedCollector) {
    const customerSelect = document.getElementById('customer_select');
    const noKontrakInput = document.getElementById('no_kontrak');
    customerSelect.innerHTML = '<option value="">-- Pilih Nama Nasabah --</option>';
    noKontrakInput.value = '';

    if (selectedCollector === "" || !dataInput[selectedCollector]) {
        customerSelect.disabled = true;
        return;
    }

    let nasabahSudahInput = [];
    if (globalDatabaseSnapshot) {
        Object.keys(globalDatabaseSnapshot).forEach(key => {
            let item = globalDatabaseSnapshot[key];
            if (item.remedialMk2 === selectedCollector) {
                nasabahSudahInput.push(item.namaCustomer);
            }
        });
    }

    let listTersedia = dataInput[selectedCollector].filter(cust => !nasabahSudahInput.includes(cust.nama));

    if (listTersedia.length === 0) {
        customerSelect.innerHTML = '<option value="">🎉 Semua nasabah kolektor ini sudah selesai!</option>';
        customerSelect.disabled = true;
        return;
    }

    listTersedia.forEach(custObj => {
        let option = document.createElement('option');
        option.value = custObj.nama;
        option.text = custObj.nama;
        customerSelect.appendChild(option);
    });
    customerSelect.disabled = false;
}

function isiOtomatisNoKontrak(namaTerpilih) {
    const collector = document.getElementById('collector_select').value;
    const noKontrakInput = document.getElementById('no_kontrak');
    
    if (!namaTerpilih || !collector || !dataInput[collector]) {
        noKontrakInput.value = '';
        return;
    }

    const dataNasabah = dataInput[collector].find(cust => cust.nama === namaTerpilih);
    if (dataNasabah) {
        noKontrakInput.value = dataNasabah.kontrak;
    } else {
        noKontrakInput.value = '-';
    }
}

// --- 6. PENGIRIMAN DATA KE FIREBASE ---
function kirimKeFirebase(event) {
    event.preventDefault();
    const btn = document.getElementById('btnSubmit');
    btn.disabled = true;
    btn.innerText = "Mengirim...";

    const collector = document.getElementById('collector_select').value;
    const customerName = document.getElementById('customer_select').value;
    const nomorKontrak = document.getElementById('no_kontrak').value;
    
    let objekData = {
        namaCustomer: customerName,
        noKontrak: nomorKontrak || "-",
        remedialMk2: collector,
        progresDocking: document.getElementById('prediksi_sukses').value,
        tglJb: document.getElementById('tgl_prediksi_jb').value,
        dlq: document.getElementById('deliquency').value.toUpperCase(),
        ansus: document.getElementById('detail_kasus').value,
        inputBy: userAktif ? userAktif.nama : "Karyawan"
    };

    database.ref('data_docking').push(objekData, function(error) {
        btn.disabled = false;
        btn.innerText = "Kirim Laporan";
        if (error) {
            alert("Gagal mengirim data: " + error.message);
        } else {
            alert("Data " + customerName + " berhasil tersimpan!");
            document.getElementById('updateForm').reset();
            document.getElementById('customer_select').innerHTML = '<option value="">-- Pilih Kolektor Dahulu --</option>';
            document.getElementById('customer_select').disabled = true;
        }
    });
}

// --- 7. UPLOAD MASTER NASABAH DARI EXCEL (FLEKSIBEL) ---
function uploadMasterExcelKeFirebase() {
    const fileInput = document.getElementById('excelMasterFile');
    if (fileInput.files.length === 0) {
        alert("Silakan pilih file Excel terlebih dahulu!");
        return;
    }

    const file = fileInput.files[0];
    const reader = new FileReader();

    reader.onload = function(e) {
        try {
            const data = new Uint8Array(e.target.result);
            const workbook = XLSX.read(data, { type: 'array' });
            const firstSheetName = workbook.SheetNames[0];
            const worksheet = workbook.Sheets[firstSheetName];
            
            // Menggunakan header: 1 atau mendeteksi baris header secara otomatis
            const rows = XLSX.utils.sheet_to_json(worksheet, { defval: "" });
            
            if (rows.length === 0) {
                alert("File Excel kosong atau format tidak terbaca!");
                return;
            }

            let structuredData = {};

            rows.forEach(row => {
                // Menangkap berbagai kemungkinan penulisan header di Excel
                let kolektor = (row["KOLEKTOR"] || row["Kolektor"] || row["kolektor"] || "").toString().trim().toUpperCase();
                let namaCust = (row["NAMA CUSTOMER"] || row["Nama Customer"] || row["NAMA"] || row["Nama"] || "").toString().trim().toUpperCase();
                let noKontrak = (row["NO KONTRAK"] || row["No Kontrak"] || row["NO. KONTRAK"] || row["KONTRAK"] || row["Kontrak"] || row["kontrak"] || "").toString().trim();

                if (kolektor && namaCust) {
                    if (!structuredData[kolektor]) {
                        structuredData[kolektor] = [];
                    }
                    structuredData[kolektor].push({
                        nama: namaCust,
                        kontrak: noKontrak || "-"
                    });
                }
            });

            if (Object.keys(structuredData).length === 0) {
                alert("Gagal membaca data. Pastikan baris judul Excel menggunakan: KOLEKTOR, NAMA CUSTOMER, NO KONTRAK.");
                return;
            }

            database.ref('master_nasabah').set(structuredData, (error) => {
                if (error) {
                    alert("Gagal menyimpan ke Firebase: " + error.message);
                } else {
                    alert("✅ Berhasil! Master data nasabah telah diperbarui di Firebase.");
                    fileInput.value = "";
                }
            });

        } catch (err) {
            console.error(err);
            alert("Terjadi kesalahan saat membaca file Excel: " + err.message);
        }
    };

    reader.readAsArrayBuffer(file);
}

// --- 8. TABEL LIVE HISTORY & CONTROL PANEL PAK SALMAN ---
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
            <td><strong>${item.namaCustomer}</strong></td>
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
                        <th>TGL PREDIKSI JB</th>
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
        database.ref('data_docking').remove()
            .then(() => {
                alert("Data laporan docking berhasil dibersihkan.");
            })
            .catch((error) => {
                alert("Gagal menghapus data: " + error.message);
            });
    }
}

// --- 9. DOWNLOAD EXCEL REKAP ---
function downloadExcel() {
    let dataSudahInputExcel = [];
    let nasabahSudahInputNamaOnly = [];
    let indexSudah = 1;

    const checkboxes = document.querySelectorAll('.chk-nasabah:checked');
    
    if (globalDatabaseSnapshot && checkboxes.length > 0) {
        checkboxes.forEach(cb => {
            let key = cb.value;
            let item = globalDatabaseSnapshot[key];
            if (item) {
                nasabahSudahInputNamaOnly.push(item.namaCustomer);
                dataSudahInputExcel.push({
                    "NO": indexSudah++,
                    "NAMA CUSTOMER": item.namaCustomer,
                    "NO KONTRAK": item.noKontrak || "-",
                    "REMEDIAL / MK2": item.remedialMk2,
                    "TGL JB": item.tglJb,
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

    Object.keys(dataInput).forEach(kolektor => {
        dataInput[kolektor].forEach(nasabahObj => {
            if (!nasabahSudahInputNamaOnly.includes(nasabahObj.nama)) {
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

    if (dataSudahInputExcel.length === 0 && dataBelumInputExcel.length === 0) {
        alert("Tidak ada data rekapitulasi yang dapat diekspor saat ini.");
        return;
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
