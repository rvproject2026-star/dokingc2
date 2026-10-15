function prosesLogin(event) {
    event.preventDefault();
    
    const inputNik = document.getElementById('password').value.trim();
    const errorMsg = document.getElementById('errorMsg');
    const btnSubmit = document.querySelector('.btn-submit');
    
    if (!inputNik) {
        alert("Masukkan NIK terlebih dahulu!");
        return;
    }

    // Ubah tampilan tombol saat memproses
    btnSubmit.innerText = "VERIFIKASI...";
    btnSubmit.disabled = true;
    errorMsg.style.display = 'none';

    const emailSemu = `${inputNik}@doking.com`;
    const passwordSemu = inputNik; // Asumsi password adalah NIK

    // 1. Verifikasi Auth
    firebase.auth().signInWithEmailAndPassword(emailSemu, passwordSemu)
        .then((userCredential) => {
            console.log("Auth berhasil, mengambil profil...");
            // 2. Ambil data profil dari database
            return database.ref('master_karyawan/' + inputNik).once('value');
        })
        .then((snapshot) => {
            // Reset tombol
            btnSubmit.innerText = "MASUK SISTEM";
            btnSubmit.disabled = false;

            if (snapshot.exists()) {
                userAktif = snapshot.val();
                userAktif.nik = inputNik;
                
                // Tampilkan profil ke layar
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
                // Jika NIK ada di Auth tapi tidak ada di Realtime Database
                alert("⚠️ Login Auth berhasil, tetapi NIK " + inputNik + " belum didaftarkan di 'master_karyawan' Realtime Database!");
            }
        })
        .catch((error) => {
            // Selalu kembalikan tombol ke keadaan awal jika terjadi error
            btnSubmit.innerText = "MASUK SISTEM";
            btnSubmit.disabled = false;
            
            console.error("Detail Error Login:", error.code, error.message);
            
            if (error.code === 'auth/user-not-found' || error.code === 'auth/wrong-password') {
                errorMsg.innerText = "NIK atau password tidak terdaftar!";
            } else if (error.code === 'auth/invalid-email') {
                errorMsg.innerText = "Format NIK tidak valid!";
            } else {
                errorMsg.innerText = "Gagal login: " + error.message;
            }
            errorMsg.style.display = 'block';
        });
}
