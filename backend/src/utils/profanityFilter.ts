// ===========================================
//            PROFANITY FILTER CLASS
// ===========================================

// UTILITÀ FILTRO VOLGARITÀ PER PULIRE CONTENUTO RECENSIONI
class ProfanityFilter {
  private readonly strictWords: Set<string>;
  private readonly moderateWords: Set<string>;
  private readonly mildWords: Set<string>;
  private readonly whitelistedWords: Set<string>;

  constructor() {
    // ===========================================
    //           WORD LISTS INITIALIZATION
    // ===========================================

    // INIZIALIZZA LISTE PAROLE - IN PRODUZIONE, CARICA DA DATABASE O FILE CONFIG
    this.strictWords = new Set([
      // AGGIUNGI PAROLE VOLGARITÀ SEVERE - QUESTE VERRANNO COMPLETAMENTE BLOCCATE
      "fuck",
      "shit",
      "damn",
      "bitch",
      "asshole",
      "bastard",
      "crap",
      "piss",
      "hell",
      "cock",
      "dick",
      "pussy",
      // DA COMPLETARE
    ]);

    this.moderateWords = new Set([
      // AGGIUNGI PAROLE MODERATE - QUESTE VERRANNO SOSTITUITE CON ASTERISCHI
      "stupid",
      "idiot",
      "moron",
      "dumb",
      "retard",
      "gay",
      "sucks",
      "hate",
      "awful",
      "terrible",
      "worst",
      // DA COMPLETARE
    ]);

    this.mildWords = new Set([
      // AGGIUNGI PAROLE LIEVI - QUESTE VERRANNO SEGNALATE MA NON FILTRATE
      "bad",
      "poor",
      "disappointing",
      "useless",
      "pathetic",
      // DA COMPLETARE
    ]);

    this.whitelistedWords = new Set([
      // PAROLE CHE POTREBBERO SCATENARE FALSI POSITIVI
      "classic",
      "bass",
      "glass",
      "grass",
      "pass",
      "mass",
      "assess",
      "assist",
      "assume",
      "assignment",
      "association",
      // DA COMPLETARE
    ]);
  }

  // ===========================================
  //             PUBLIC METHODS
  // ===========================================

  // PULISCI TESTO FILTRANDO VOLGARITÀ
  clean(text: string): string {
    if (!text || typeof text !== "string") {
      return text;
    }

    let cleanedText = text.toLowerCase();

    // RIMUOVI PUNTEGGIATURA E SPAZI ECCESSIVI
    cleanedText = this.normalizeText(cleanedText);

    // APPLICA FILTRAGGIO
    cleanedText = this.filterStrictWords(cleanedText);
    cleanedText = this.filterModerateWords(cleanedText);

    // RIPRISTINA MAIUSCOLE ORIGINALI PER PAROLE NON FILTRATE
    return this.restoreCase(text, cleanedText);
  }

  // CONTROLLA SE TESTO CONTIENE VOLGARITÀ
  containsProfanity(text: string): boolean {
    if (!text || typeof text !== "string") {
      return false;
    }

    const normalizedText = this.normalizeText(text.toLowerCase());

    // CONTROLLA PAROLE SEVERE
    for (const word of this.strictWords) {
      if (this.containsWord(normalizedText, word)) {
        return true;
      }
    }

    return false;
  }

  // OTTIENI LIVELLO SEVERITÀ VOLGARITÀ
  getSeverityLevel(text: string): "clean" | "mild" | "moderate" | "strict" {
    if (!text || typeof text !== "string") {
      return "clean";
    }

    const normalizedText = this.normalizeText(text.toLowerCase());

    // CONTROLLA PAROLE SEVERE PRIMA
    for (const word of this.strictWords) {
      if (this.containsWord(normalizedText, word)) {
        return "strict";
      }
    }

    // CONTROLLA PAROLE MODERATE
    for (const word of this.moderateWords) {
      if (this.containsWord(normalizedText, word)) {
        return "moderate";
      }
    }

    // CONTROLLA PAROLE LIEVI
    for (const word of this.mildWords) {
      if (this.containsWord(normalizedText, word)) {
        return "mild";
      }
    }

    return "clean";
  }

  // OTTIENI ANALISI DETTAGLIATA DEL TESTO
  analyze(text: string): {
    isClean: boolean;
    severity: "clean" | "mild" | "moderate" | "strict";
    flaggedWords: string[];
    cleanedText: string;
    shouldBlock: boolean;
  } {
    if (!text || typeof text !== "string") {
      return {
        isClean: true,
        severity: "clean",
        flaggedWords: [],
        cleanedText: text,
        shouldBlock: false,
      };
    }

    const severity = this.getSeverityLevel(text);
    const flaggedWords = this.getFlaggedWords(text);
    const cleanedText = this.clean(text);
    const shouldBlock = severity === "strict";

    return {
      isClean: severity === "clean",
      severity,
      flaggedWords,
      cleanedText,
      shouldBlock,
    };
  }

  // ===========================================
  //            PRIVATE METHODS
  // ===========================================

  // NORMALIZZA TESTO PER ELABORAZIONE
  private normalizeText(text: string): string {
    return text
      .replace(/[^\w\s]/g, " ") // SOSTITUISCI PUNTEGGIATURA CON SPAZI
      .replace(/\s+/g, " ") // COLLASSA SPAZI MULTIPLI
      .replace(/(\w)\1{2,}/g, "$1$1") // RIDUCI CARATTERI RIPETUTI (aaa -> aa)
      .trim();
  }

  // CONTROLLA SE TESTO CONTIENE UNA PAROLA SPECIFICA
  private containsWord(text: string, word: string): boolean {
    // SALTA SE PAROLA È IN WHITELIST
    if (this.whitelistedWords.has(word)) {
      return false;
    }

    // CREA REGEX CONFINE PAROLA
    const regex = new RegExp(`\\b${this.escapeRegex(word)}\\b`, "i");

    // CONTROLLA ANCHE SOSTITUZIONI COMUNI
    const substitutions = this.getCommonSubstitutions(word);
    for (const substitution of substitutions) {
      const subRegex = new RegExp(
        `\\b${this.escapeRegex(substitution)}\\b`,
        "i"
      );
      if (subRegex.test(text)) {
        return true;
      }
    }

    return regex.test(text);
  }

  // FILTRA PAROLE SEVERE
  private filterStrictWords(text: string): string {
    let filteredText = text;

    for (const word of this.strictWords) {
      if (this.whitelistedWords.has(word)) continue;

      const regex = new RegExp(`\\b${this.escapeRegex(word)}\\b`, "gi");
      filteredText = filteredText.replace(regex, "[BLOCKED]");

      // FILTRA ANCHE SOSTITUZIONI COMUNI
      const substitutions = this.getCommonSubstitutions(word);
      for (const substitution of substitutions) {
        const subRegex = new RegExp(
          `\\b${this.escapeRegex(substitution)}\\b`,
          "gi"
        );
        filteredText = filteredText.replace(subRegex, "[BLOCKED]");
      }
    }

    return filteredText;
  }

  // FILTRA PAROLE MODERATE (SOSTITUISCI CON ASTERISCHI)
  private filterModerateWords(text: string): string {
    let filteredText = text;

    for (const word of this.moderateWords) {
      if (this.whitelistedWords.has(word)) continue;

      const regex = new RegExp(`\\b${this.escapeRegex(word)}\\b`, "gi");
      filteredText = filteredText.replace(regex, (match) => {
        return (
          match.charAt(0) +
          "*".repeat(match.length - 2) +
          match.charAt(match.length - 1)
        );
      });
    }

    return filteredText;
  }

  // OTTIENI SOSTITUZIONI CARATTERI COMUNI PER UNA PAROLA
  private getCommonSubstitutions(word: string): string[] {
    const substitutions = [];

    // SOSTITUZIONI CARATTERI COMUNI
    const charMap: Record<string, string[]> = {
      a: ["@", "4"],
      e: ["3"],
      i: ["1", "!"],
      o: ["0"],
      s: ["$", "5"],
      t: ["7"],
      l: ["1"],
      g: ["9"],
    };

    // GENERA SOSTITUZIONI
    let substituted = word;
    for (const [char, replacements] of Object.entries(charMap)) {
      if (word.includes(char)) {
        for (const replacement of replacements) {
          substitutions.push(
            substituted.replace(new RegExp(char, "g"), replacement)
          );
        }
      }
    }

    // AGGIUNGI VERSIONE CON CARATTERI RIPETUTI
    substitutions.push(word.split("").join("*")); // f*u*c*k
    substitutions.push(word.split("").join(" ")); // f u c k

    return substitutions;
  }

  // OTTIENI LISTA PAROLE SEGNALATE NEL TESTO
  private getFlaggedWords(text: string): string[] {
    const flagged: string[] = [];
    const normalizedText = this.normalizeText(text.toLowerCase());

    const allWords = [
      ...this.strictWords,
      ...this.moderateWords,
      ...this.mildWords,
    ];

    for (const word of allWords) {
      if (this.containsWord(normalizedText, word)) {
        flagged.push(word);
      }
    }

    return [...new Set(flagged)]; // RIMUOVI DUPLICATI
  }

  // RIPRISTINA MAIUSCOLE ORIGINALI PER PARTI NON FILTRATE
  private restoreCase(original: string, filtered: string): string {
    // IMPLEMENTAZIONE SEMPLICE - IN PRODUZIONE, QUESTO POTREBBE ESSERE PIÙ SOFISTICATO
    const originalWords = original.split(/\s+/);
    const filteredWords = filtered.split(/\s+/);

    if (originalWords.length !== filteredWords.length) {
      return filtered; // STRUTTURA CAMBIATA TROPPO, RITORNA VERSIONE FILTRATA
    }

    const result = filteredWords.map((filteredWord, index) => {
      const originalWord = originalWords[index];

      // SE PAROLA NON È STATA FILTRATA (NESSUN MARCATORE SPECIALE), RIPRISTINA MAIUSCOLE ORIGINALI
      if (!filteredWord.includes("[BLOCKED]") && !filteredWord.includes("*")) {
        return originalWord;
      }

      return filteredWord;
    });

    return result.join(" ");
  }

  // ESCAPE CARATTERI SPECIALI REGEX
  private escapeRegex(string: string): string {
    return string.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  }
}

// ===========================================
//               EXPORTS
// ===========================================

// ISTANZA SINGLETON
export const profanityFilter = new ProfanityFilter();

// TESTING O ISTANZE PERSONALIZZATE
export { ProfanityFilter };
