Gotowy plik "script.js"

// ======================================================
// WEBCRAFT — SYSTEM ZAMÓWIEŃ
// ======================================================


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
// ESC — ZAMYKANIE OKNA
// ======================================================

document.addEventListener("keydown", function(event) {

    if (event.key === "Escape") {
        closeOrder();
    }

});


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


    // Sprawdzenie formularza

    if (
        !packageSelect ||
        !paymentSelect ||
        !ageCheckbox
    ) {

        alert("Błąd formularza zamówienia.");

        return;
    }


    // Sprawdzenie wieku

    if (!ageCheckbox.checked) {

        alert(
            "Musisz potwierdzić, że masz ukończone 18 lat."
        );

        return;
    }


    // Pobranie danych

    const selectedPackage =
        packageSelect.value;

    const selectedPayment =
        paymentSelect.value;


    // Ceny

    const prices = {

        START: 149,

        PRO: 299,

        PREMIUM: 499

    };


    const price =
        prices[selectedPackage];


    // Temat wiadomości

    const subject =
        "Zamówienie WebCraft - " +
        selectedPackage;


    // Treść wiadomości

    const body =
`Dzień dobry,

chcę zamówić stronę internetową.

Pakiet: ${selectedPackage}
Cena: ${price} zł
Płatność: ${selectedPayment}

Potwierdzam, że mam ukończone 18 lat.

Proszę o kontakt w sprawie realizacji zamówienia.

Pozdrawiam`;


    // ==================================================
    // KOMUNIKAT DLA KLIENTA
    // ==================================================

    const message =
        "Aby wysłać zamówienie, upewnij się, że jesteś " +
        "zalogowany/a do Gmaila na urządzeniu, z którego " +
        "korzystasz ze strony.\n\n" +
        "Po kliknięciu OK otworzymy Gmaila z przygotowaną " +
        "wiadomością do wysłania.";


    alert(message);


    // ==================================================
    // OTWARCIE GMAILA
    // ==================================================

    const gmailUrl =
        "https://mail.google.com/mail/?view=cm&fs=1" +
        "&to=" +
        encodeURIComponent("paweladominik4@gmail.com") +
        "&su=" +
        encodeURIComponent(subject) +
        "&body=" +
        encodeURIComponent(body);


    window.open(gmailUrl, "_blank");

}