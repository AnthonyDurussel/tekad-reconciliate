// Thème choisi dans l'application (Mantine le garde dans localStorage), lu avant
// le premier rendu pour que le fond d'amorçage ait déjà les bonnes couleurs.
// Fichier et non script en ligne : la CSP de production n'autorise que 'self'.
(function () {
  var scheme = "light";
  try {
    var stored = localStorage.getItem("mantine-color-scheme-value");
    if (stored === "dark") scheme = "dark";
    if (stored === "auto" && matchMedia("(prefers-color-scheme: dark)").matches)
      scheme = "dark";
  } catch (e) {
    // stockage indisponible : thème clair
  }
  document.documentElement.setAttribute("data-mantine-color-scheme", scheme);
})();
