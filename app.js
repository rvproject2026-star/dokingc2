// --- LOGIKA LOGIN FIREBASE AUTH DENGAN EMAIL SEMU ---
function prosesLogin(event) {
    event.preventDefault();
    
    const inputNik = document.getElementById('password').value.trim();
    const errorMsg = document.getElementById('errorMsg');
    const btnSubmit = document.querySelector('.btn-submit');
    
    if (!inputNik) return;

    btnSubmit.innerText = "VERIFIKASI...";
    btnSubmit.disabled = true;

    // 1. Format NIK menjadi Email Semu di balik layar
    const emailSemu = `${inputNik}@doking.com`;
    
    // Asumsi password sama dengan NIK. Jika ada field password terpisah, sesuaikan variabelnya.
    const password = inputNik; 

    // 2. Login resmi menggunakan Firebase Auth
    firebase.auth().signInWithEmailAndPassword(emailSemu, password)
        .then((userCredential) => {
            // 3. Jika otentikasi berhasil, ambil data profil karyawan berdasarkan NIK
            return database.ref('master_karyawan/' + inputNik).once('value');
        })
        .then((snapshot) => {
            btnSubmit.innerText = "MASUK SISTEM";
            btnSubmit.disabled = false;

            if (snapshot.exists()) {
                userAktif = snapshot.val();
                userAktif.nik = inputNik; // Simpan NIK aktif
                errorMsg.style.display = 'none';
                document.getElementById('password').value = '';

                // Tampilkan data ke card profil
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
                alert("⚠️ Akun terverifikasi, tetapi data profil tidak ditemukan di database!");
            }
        })
        .catch((error) => {
            btnSubmit.innerText = "MASUK SISTEM";
            btnSubmit.disabled = false;
            console.error("Auth error:", error.code, error.message);
            errorMsg.innerText = "NIK atau password salah / tidak terdaftar!";
            errorMsg.style.display = 'block';
        });
}

// --- LOGOUT MANAGEMENT ---
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
