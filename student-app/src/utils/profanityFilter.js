/**
 * Profanity Filter Utility (English & Filipino / Tagalog)
 * Multi-layer profanity detection, masking/censoring, and flagging for student feedback.
 */

function createFlexiblePattern(word) {
  const charMap = {
    'a': '[a@4*]',
    'b': '[b8*]',
    'c': '[c*]',
    'd': '[d*]',
    'e': '[e3*]',
    'f': '[f*]',
    'g': '[g9*]',
    'h': '[h*]',
    'i': '[i1!|*]',
    'j': '[j*]',
    'k': '[k*]',
    'l': '[l1|*]',
    'm': '[m*]',
    'n': '[n*]',
    'o': '[o0*]',
    'p': '[p*]',
    'q': '[q*]',
    'r': '[r*]',
    's': '[s$5*]',
    't': '[t+*]',
    'u': '[u*]',
    'v': '[v*]',
    'w': '[w*]',
    'x': '[x*]',
    'y': '[y*]',
    'z': '[z2*]'
  };

  const isAlpha = /^[a-zA-Z]+$/.test(word);

  let pattern;
  if (isAlpha) {
    pattern = word
      .split('')
      .map(ch => {
        const lower = ch.toLowerCase();
        const mapped = charMap[lower] || `[${ch}]`;
        return `${mapped}+`;
      })
      .join('[\\s._-]*');
  } else {
    // For words with numbers or symbols like 8080, y@w@, p*ta, g@go
    pattern = word
      .split('')
      .map(ch => {
        const lower = ch.toLowerCase();
        if (charMap[lower]) {
          return `${charMap[lower]}+`;
        }
        return `[\\${ch}]+`;
      })
      .join('[\\s._-]*');
  }

  // Flexible boundary matching that supports leading/trailing symbols, digits, and whitespace
  const leftBoundary = '(?:^|(?<=[^a-zA-Z0-9]))';
  const rightBoundary = '(?:(?=[^a-zA-Z0-9])|$)';
  const suffix = isAlpha ? '(s|es|ed|ing|er|head|ka|mo|nyo|a|o)?' : '';

  return new RegExp(`${leftBoundary}${pattern}${suffix}${rightBoundary}`, 'gi');
}

const PROFANE_WORDS = [
  // English
  'fuck', 'fucker', 'fucking', 'fuckhead', 'motherfucker', 'fck',
  'shit', 'bullshit', 'shitty', 'dipshit', 'shet', 'sht',
  'bitch',
  'asshole', 'bastard', 'cunt', 'dick', 'pussy',
  'slut', 'whore', 'twat', 'dumbass', 'jackass',
  'fag', 'faggot', 'nigger', 'nigga',
  'stfu', 'wtf',

  // Filipino / Tagalog / Taglish
  'gago', 'gaga', 'tangina', 'putangina', 'tanginamo', 'tangena', 'ptngna',
  'puta', 'tarantado', 'kupal', 'pakyu', 'fuckyou', 'hinayupak',
  'bwisit', 'buwisit', 'leche', 'letse', 'ulol', 'punyeta',
  'inutil', 'pakshet', 'pakshit', 'burat', 'kantot', 'kantutan',
  'pekpek', 'bayag', 'jakol', 'tamod', 'peste', 'yawa', 'lintik',
  'bobo', 'tanga',
  'ogag', 'engot', 'ungas', 'hudas', 'pokpok', 'timawa', 'salbahe',
  'patayin',

  // Visayan / Bisaya / Regional dialects
  'buang', 'boang', 'ywa', 'minatay', 'patay', 'patyon',
  'bugo', 'bogo', 'bugok', 'bogok', 'lapuk',
  'bilat', 'oten', 'kayat', 'ukininam',

  // Leetspeak / Symbol variations
  '8080', 'y@w@', 'p*ta', 'g@go'
];

const PROFANE_PHRASES = [
  /\btang\s+ina\b/gi,
  /\bputang\s+ina\b/gi,
  /\btng\s+ina\b/gi,
  /(?:^|(?<=[^a-zA-Z0-9]))tng\s+[!i1|]na(?:(?=[^a-zA-Z0-9])|$)/gi,
  /\bina\s+mo\b/gi,
  /\bpak\s+yu\b/gi,
  /\bhindi\s+marunong\s+gago\b/gi,
  /\bhayop\s+ka\b/gi,
  /\bimong\s+mama\b/gi,
  /\bimong\s+papa\b/gi,
  /\bkuwang\s*[- ]*kuwang\b/gi,
  /\bpisting\s+yawa\b/gi,
  /\bbwisit\s+kaayo\b/gi,
  /\bmamatay\s+ka\b/gi,
  /\bpatay\s+ka\b/gi,
  /\bkill\s+your(?:self|\s*self)\b/gi
];

const COMPILED_PATTERNS = PROFANE_WORDS.map(word => ({
  word,
  regex: createFlexiblePattern(word)
}));

/**
 * Mask a matched profane word or phrase
 * Example: 'gago' -> 'g***', 'tangina' -> 't******'
 */
function maskWord(matched) {
  if (!matched) return '';
  const first = matched[0];
  return first + '*'.repeat(Math.max(1, matched.length - 1));
}

/**
 * Check if text contains profanity
 * @param {string} text - User input string
 * @returns {{ hasProfanity: boolean, words: string[] }}
 */
export function checkProfanity(text) {
  if (!text || typeof text !== 'string') {
    return { hasProfanity: false, words: [] };
  }

  const detected = new Set();

  // 1. Check phrases
  for (const regex of PROFANE_PHRASES) {
    regex.lastIndex = 0;
    const match = text.match(regex);
    if (match) {
      match.forEach(m => detected.add(m.trim()));
    }
  }

  // 2. Check compiled word patterns
  for (const { regex } of COMPILED_PATTERNS) {
    regex.lastIndex = 0;
    const matches = text.match(regex);
    if (matches) {
      matches.forEach(m => detected.add(m.trim()));
    }
  }

  return {
    hasProfanity: detected.size > 0,
    words: Array.from(detected)
  };
}

/**
 * Replace profane words/phrases with masked asterisks
 * @param {string} text - User input string
 * @returns {string} - Censored text
 */
export function censorProfanity(text) {
  if (!text || typeof text !== 'string') return text;

  let censored = text;

  for (const regex of PROFANE_PHRASES) {
    regex.lastIndex = 0;
    censored = censored.replace(regex, (match) => maskWord(match));
  }

  for (const { regex } of COMPILED_PATTERNS) {
    regex.lastIndex = 0;
    censored = censored.replace(regex, (match) => maskWord(match));
  }

  return censored;
}
