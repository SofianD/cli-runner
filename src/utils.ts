export type PathOfJsFile = `${string}.js`;

export function taggedString(chaines: TemplateStringsArray, ...cles: (string|number)[]) {
  return function cur(...valeurs: (string|number)[]) {
    const dict = valeurs[valeurs.length - 1] || {};
    const resultat = [chaines[0]];
    cles.forEach((cle, index) => {
      resultat.push(
        typeof cle === "number" ? valeurs[cle] : dict[cle],
        chaines[index + 1]
      );
    });

    return resultat.join("");
  };
}
