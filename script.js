// ======================================================
// WEBCRAFT — SYSTEM ZAMÓWIEŃ I KONTAKTU
// ======================================================


// ======================================================
// ADRES E-MAIL WEBCRAFT
// ======================================================

const WEBCRAFT_EMAIL = "paweladominik4@gmail.com";


// ======================================================
// OTWIERANIE OKNA ZAMÓWIENIA
// ======================================================

function openOrder(packageName) {

    const modal = document.getElementById("orderModal");
    const packageSelect = document.getElementById("package");

    if (!modal) {
        alert("Błąd: nie znaleziono okna zamówienia.");
        return;
    }

    modal.classList.add("active");

    if (packageSelect && packageName) {
        packageSelect.value = packageName;
    }
}


// ======================================================
// ZAMYKANIE OKNA
// ======================================================

function closeOrder() {

    const modal = document.getElementById("orderModal");

    if (modal) {
        modal.classList.remove("active");
    }
}


// ======================================================
// KLIKNIĘCIE POZA OKNEM
// ======================================================

document.addEventListener("click", function(event) {

    const modal = document.getElementById("orderModal");

    if (!modal) {
        return;
    }

    if (event.target === modal) {
        closeOrder();
    }

});


// ======================================================
// ESC — ZAMYKANIE
// ======================================================

document.addEventListener("keydown", function(event) {

    if (event.key === "Escape") {
        closeOrder();
    }

});


// ======================================================
// KONTAKT — GOTOWA WIADOMOŚĆ W GMAILU
// ======================================================

function openGmail() {

    const subject =
        "Kontakt — WebCraft";

    const body =
`Dzień dobry,

chciałbym/chciałabym skontaktować się w sprawie strony internetowej.

Proszę o kontakt.

Pozdrawiam`;


    const gmailUrl =
        "https://mail.google.com/mail/?view=cm&fs=1" +
        "&to=" +
        encodeURIComponent(WEBCRAFT_EMAIL) +
        "&su=" +
        encodeURIComponent(subject) +
        "&body=" +
        encodeURIComponent(body);


    window.open(gmailUrl, "_blank");
}


// ======================================================
// WYSYŁANIE ZAMÓWIENIA
// ======================================================

function sendOrder() {

    const packageSelect =
        document.getElementById("package");

    const paymentSelect =
        document.getElementById("payment");

    const ageCheckbox =
        document.getElementById("age");


    // ==================================================
    // SPRAWDZENIE FORMULARZA
    // ==================================================

    if (
        !packageSelect ||
        !paymentSelect ||
        !ageCheckbox
    ) {

        alert("Błąd formularza zamówienia.");

        return;
    }


    // ==================================================
    // SPRAWDZENIE WIEKU
    // ==================================================

    if (!ageCheckbox.checked) {

        alert(
            "Musisz potwierdzić, że masz ukończone 18 lat."
        );

        return;
    }


    // ==================================================
    // POBRANIE DANYCH
    // ==================================================

    const selectedPackage =
        packageSelect.value;

    const selectedPayment =
        paymentSelect.value;


    // ==================================================
    // CENY
    // ==================================================

    const prices = {

        START: 149,

        PRO: 299,

        PREMIUM: 499

    };


    const price =
        prices[selectedPackage];


    // ==================================================
    // TEMAT
    // ==================================================

    const subject =
        "Zamówienie WebCraft - " +
        selectedPackage;


    // ==================================================
    // TREŚĆ WIADOMOŚCI
    // ==================================================

    const body =
`Dzień dobry,

chcę zamówić stronę internetową.

Pakiet: ${selectedPackage}
Cena: ${price} zł
Metoda płatności: ${selectedPayment}

Potwierdzam, że mam ukończone 18 lat.

Proszę o kontakt w sprawie realizacji zamówienia.

Pozdrawiam`;


    // ==================================================
    // OTWARCIE GMAILA
    // ==================================================

    const gmailUrl =
        "https://mail.google.com/mail/?view=cm&fs=1" +
        "&to=" +
        encodeURIComponent(WEBCRAFT_EMAIL) +
        "&su=" +
        encodeURIComponent(subject) +
        "&body=" +
        encodeURIComponent(body);


    window.open(gmailUrl, "_blank");

}
