/**
 * Removes what looks like a person, city or ZIP from text a model wrote in its
 * own words (ADR-009 section 3). Known values (the veteran's own name, city,
 * ZIP) are redacted by piiScrubber; these patterns cover the names and places
 * the app has never seen. Over-removal is the accepted cost: nothing here is
 * pre-ticked and the veteran can type the text back.
 */

const MARK = "[REDACTED]";

const STATE_CODES =
  "AL|AK|AZ|AR|CA|CO|CT|DE|DC|FL|GA|HI|ID|IL|IN|IA|KS|KY|LA|ME|MD|MA|MI|MN|MS|MO|MT|NE|NV|NH|NJ|NM|NY|NC|ND|OH|OK|OR|PA|RI|SC|SD|TN|TX|UT|VT|VA|WA|WV|WI|WY|PR|GU|VI|AE|AP|AA";

const STATE_NAMES =
  "Alabama|Alaska|Arizona|Arkansas|California|Colorado|Connecticut|Delaware|Florida|Georgia|Hawaii|Idaho|Illinois|Indiana|Iowa|Kansas|Kentucky|Louisiana|Maine|Maryland|Massachusetts|Michigan|Minnesota|Mississippi|Missouri|Montana|Nebraska|Nevada|New Hampshire|New Jersey|New Mexico|New York|North Carolina|North Dakota|Ohio|Oklahoma|Oregon|Pennsylvania|Rhode Island|South Carolina|South Dakota|Tennessee|Texas|Utah|Vermont|Virginia|Washington|West Virginia|Wisconsin|Wyoming|Puerto Rico|Guam";

// Abbreviated titles only: the spelled-out ones ("General", "Major",
// "Private") are also ordinary form vocabulary ("General Discharge").
const TITLE_LIST = [
  "Mr",
  "Mrs",
  "Ms",
  "Miss",
  "Dr",
  "Pvt",
  "Pfc",
  "Spc",
  "Cpl",
  "Sgt",
  "Ssg",
  "Sfc",
  "Msg",
  "Sgm",
  "Csm",
  "Ssgt",
  "Tsgt",
  "Msgt",
  "Smsgt",
  "Lcpl",
  "Gysgt",
  "Sgtmaj",
  "Lt",
  "Ltjg",
  "Lcdr",
  "Cdr",
  "Cmdr",
  "Capt",
  "Cpt",
  "Maj",
  "Ltc",
  "Lcol",
  "Col",
  "Brig",
  "Gen",
  "Adm",
  "Ens",
  "Cwo",
  "Rev",
];
const TITLES = [...TITLE_LIST, ...TITLE_LIST.map((t) => t.toUpperCase())].join(
  "|",
);

// Unicode letters, so "José Núñez" is a name like "John Smith"; the lookbehind
// replaces \b, which only knows ASCII word characters.
const START = String.raw`(?<![\p{L}\p{N}])`;
const NAME_WORD = String.raw`\p{Lu}[\p{L}'’-]{1,24}`;
const PLACE_WORD = String.raw`\p{Lu}[\p{L}.'-]{1,20}`;

const TITLED_NAME = new RegExp(
  String.raw`${START}(?:${TITLES})\.?[ \t]+${NAME_WORD}(?:[ \t]+(?:\p{Lu}\.|${NAME_WORD})){0,2}`,
  "gu",
);
const LAST_COMMA_FIRST = new RegExp(
  String.raw`${START}(${NAME_WORD}),[ \t]+(${NAME_WORD})(?:[ \t]+\p{Lu}\b\.?)?`,
  "gu",
);
const MIDDLE_INITIAL_NAME = new RegExp(
  String.raw`${START}(${NAME_WORD})[ \t]+\p{Lu}(\.?)[ \t]+(${NAME_WORD})`,
  "gu",
);
const CITY_STATE_CODE = new RegExp(
  String.raw`${START}(${PLACE_WORD}(?:[ \t]+${PLACE_WORD}){0,2}),[ \t]+(?:${STATE_CODES})\b(?![A-Za-z])`,
  "gu",
);
// Without the comma only codes that are not also ordinary words count
// ("Springfield IL"; never "Platoon OR Squad").
const UNAMBIGUOUS_STATE_CODES = STATE_CODES.split("|")
  .filter(
    (code) =>
      ![
        "AL",
        "AR",
        "CO",
        "DE",
        "HI",
        "ID",
        "IN",
        "LA",
        "MA",
        "ME",
        "OK",
        "OR",
        "PA",
        "VI",
        "PR",
        "GU",
        "AA",
        "AE",
        "AP",
      ].includes(code),
  )
  .join("|");
const CITY_STATE_NO_COMMA = new RegExp(
  String.raw`${START}${PLACE_WORD}(?:[ \t]+${PLACE_WORD}){0,2}[ \t]+(?:${UNAMBIGUOUS_STATE_CODES})\b(?![A-Za-z])`,
  "gu",
);
const CITY_STATE_NAME = new RegExp(
  String.raw`${START}${PLACE_WORD}(?:[ \t]+${PLACE_WORD}){0,2},[ \t]+(?:${STATE_NAMES})\b`,
  "gu",
);
const ZIP = /(?<![\d-])\d{5}(?:-\d{4})?(?![\d-])/g;
const CAPITALIZED_RUN =
  /\p{Lu}[\p{L}'’-]{2,24}(?:[ \t]+\p{Lu}[\p{L}'’-]{2,24})+/gu;
// A spelled-out rank before a surname ("Sergeant Quindle"); the abbreviated
// ones are in TITLES.
const SPELLED_TITLE_NAME = new RegExp(
  String.raw`${START}(?:Private|Corporal|Sergeant|Lieutenant|Captain|Colonel|Admiral|Commander|Specialist|Ensign|Chaplain|Major|General|Airman|Seaman|Petty Officer)[ \t]+(${NAME_WORD})(?:[ \t]+(${NAME_WORD}))?`,
  "gu",
);

// Words that make a capitalized run a unit, award, school, place of duty or
// phrase of the form rather than a person. A run is a name only when none of
// its words is here.
const NOT_A_NAME = new Set(
  (
    "company battalion regiment brigade division infantry army navy marine marines air force " +
    "fort camp base station squadron wing group command corps detachment headquarters support " +
    "medical medicine center centre school academy college university course training " +
    "special operations forces task joint combined unit united states national guard reserve " +
    "active duty coast space airborne ranger rangers cavalry armor armored artillery engineer " +
    "engineers signal intelligence aviation helicopter transportation logistics maintenance " +
    "ordnance quartermaster chemical military police security civil affairs psychological " +
    "field hospital clinic health care service services branch department of the and for in " +
    "at to from with by not purple heart bronze star silver medal ribbon commendation " +
    "achievement good conduct combat action badge expert infantryman parachutist campaign " +
    "afghanistan iraq vietnam korea kuwait germany japan okinawa honorable general discharge " +
    "separation retirement release character narrative reason completion required " +
    "block remarks continuation continued see item form document page awards decorations " +
    "veteran foreign overseas deployment mobilization operation enduring freedom iraqi new " +
    "dawn inherent resolve global war terrorism southwest asia armed expeditionary northern " +
    "european african middle east pacific atlantic battle fleet carrier strike " +
    "reconnaissance recon sniper scout weapons mortar rifle machine gunner " +
    "driver mechanic cook clerk administration administrative personnel human resources " +
    "readiness mission member requests options selected early transfer enlisted " +
    "reenlistment contract term expiration hardship convenience government drilling " +
    "individual ready inactive standby retired list program tab cross legion merit " +
    "meritorious valor valorous flying distinguished defense humanitarian citation award " +
    "device oak leaf cluster nato qualification qualified marksman sharpshooter pistol " +
    "jump wings pathfinder sere survival evasion resistance escape leadership development " +
    "primary advanced basic noncommissioned nco warrior leader professional education " +
    "instructor drill sergeant recruiter infantry airman soldier sailor coastguardsman " +
    "mine marksmanship excellence overseas deployment ribbon unit presidential " +
    "supply specialist wheeled vehicle motor transport operator drive full completed " +
    "member has first second third inf regt bn div bde hhc btry det hq decorations " +
    "medals badges citations ribbons awarded authorized authorised campaign"
  ).split(" "),
);
const STATE_WORDS = new Set(
  STATE_NAMES.toLowerCase()
    .split("|")
    .flatMap((name) => name.split(" ")),
);

// Compatibility forms (full-width digits and letters) become plain ones and
// every Unicode space, no-break space or line break becomes one plain space, so
// a name or place split across lines or joined by a no-break space is one run.
export const normaliseModelText = (text) =>
  text
    .normalize("NFKC")
    .replace(/[\p{Z}\u0085\t-\r]+/gu, " ")
    .replaceAll(" ,", ",");

const STATE_CODE_SET = new Set(STATE_CODES.split("|"));

const collapse = (text) =>
  text
    .replace(/[ \t]+/g, " ")
    .replaceAll(" ,", ",")
    .trim();

const isVocabulary = (word) =>
  NOT_A_NAME.has(word.toLowerCase()) || STATE_WORDS.has(word.toLowerCase());

export function removeZipCodes(text) {
  return text.replace(ZIP, MARK);
}

// A post, base or station is a duty station on the form, not a home city.
const INSTALLATION_WORDS = new Set(
  "fort camp naval nas nsa uss usns uscgc joint station base".split(" "),
);
const isInstallation = (place) =>
  INSTALLATION_WORDS.has(place.trim().split(/\s+/)[0].toLowerCase());

export function removeCityAndState(text) {
  return text
    .replace(CITY_STATE_CODE, (match, place) =>
      isInstallation(place) ? match : MARK,
    )
    .replace(CITY_STATE_NAME, MARK)
    .replace(CITY_STATE_NO_COMMA, MARK);
}

// Words that follow a spelled-out rank in ordinary form text ("Sergeant
// Major", "General Court Martial"), so they are not a surname.
const RANK_FOLLOWERS = new Set(
  (
    "major first staff master chief senior petty officer class warrant general lieutenant " +
    "sergeant corporal command gunnery technical tech court martial orders order counsel " +
    "population conditions purpose second third fourth fifth sixth colonel captain commander " +
    "admiral ensign specialist private airman seaman junior grade lower upper half rear vice " +
    "basic"
  ).split(" "),
);

const isRankFollower = (word) =>
  isVocabulary(word) || RANK_FOLLOWERS.has(word.toLowerCase());

function removeSpelledTitleNames(text) {
  return text.replace(SPELLED_TITLE_NAME, (match, first, second) => {
    if (isRankFollower(first)) return match;
    if (second && isRankFollower(second)) return `${MARK} ${second}`;
    return MARK;
  });
}

export function removeNameShapes(text) {
  return removeSpelledTitleNames(text.replace(TITLED_NAME, MARK))
    .replace(LAST_COMMA_FIRST, (match, last, first) =>
      isVocabulary(last) ||
      STATE_CODE_SET.has(first) ||
      (isVocabulary(first) && !STATE_WORDS.has(first.toLowerCase()))
        ? match
        : MARK,
    )
    .replace(MIDDLE_INITIAL_NAME, MARK);
}

// A ship's name ("USS Abraham Lincoln") reads like a person's but is a duty
// station; the words after the prefix are kept.
const VESSEL_PREFIXES = new Set(["USS", "USNS", "USCGC", "HMS"]);

const SHORT_RUN_WORDS = 5;

// Within a run of capitalized words, a stretch of two or more words none of
// which is vocabulary reads as a person ("Zorblax Quindle Award" loses the two
// names and keeps "Award").
function removeBareNames(text, maxWords) {
  return text.replace(CAPITALIZED_RUN, (run) => {
    const out = [];
    let pending = [];
    const flush = () => {
      const isName = pending.length >= 2 && pending.length <= maxWords;
      out.push(...(isName ? [MARK] : pending));
      pending = [];
    };
    let afterVessel = false;
    for (const part of run.split(/[ \t]+/)) {
      if (afterVessel) {
        out.push(part);
      } else if (VESSEL_PREFIXES.has(part)) {
        flush();
        out.push(part);
        afterVessel = true;
      } else if (isVocabulary(part)) {
        flush();
        out.push(part);
      } else {
        pending.push(part);
      }
    }
    flush();
    return out.join(" ");
  });
}

// Parser text: a "Last, First M" name is removed only beside the label of a box
// that holds a person (before it or after it), because an ordinary run of
// capitalised words in parser text is a course, an award or a unit.
const PERSON_LABEL = String.raw`(?:NAME|SIGNATURE|NEAREST[ \t]{1,5}RELATIVE|SOCIAL[ \t]{1,5}SECURITY|SSN|DATE[ \t]{1,5}OF[ \t]{1,5}BIRTH)`;
const LABEL_BEFORE_NAME = new RegExp(
  String.raw`(${START}${PERSON_LABEL}(?:[ \t]{0,3}\([^)\n]{0,60}\))?[ \t:.-]{0,5})[\p{L}'’-]{2,24},[ \t]+[\p{L}'’-]{2,24}(?:[ \t]+\p{L}\b\.?)?`,
  "giu",
);
const NAME_BEFORE_LABEL = new RegExp(
  String.raw`${START}[\p{L}'’-]{2,24},[ \t]+[\p{L}'’-]{2,24}(?:[ \t]+\p{L}\b\.?)?([ \t:.-]{0,5}${PERSON_LABEL}(?![\p{L}\p{N}]))`,
  "giu",
);

export function removeLabelledNames(text) {
  return text
    .replace(LABEL_BEFORE_NAME, (_match, label) => `${label}${MARK}`)
    .replace(NAME_BEFORE_LABEL, (_match, label) => `${MARK}${label}`);
}

/**
 * `bare` also removes adjacent capitalized words that are not military, award
 * or place vocabulary ("John Smith"): "prose" at any length (sentences and unit
 * lines), "short" only for two to five words (award, school and deployment
 * names, whose longer titles are capitalized phrases a vocabulary cannot list).
 */
export function removePersonAndPlaceShapes(text, { bare = "none" } = {}) {
  let out = removeNameShapes(removeCityAndState(normaliseModelText(text)));
  out = removeZipCodes(out);
  if (bare === "prose") out = removeBareNames(out, Infinity);
  if (bare === "short") out = removeBareNames(out, SHORT_RUN_WORDS);
  return collapse(out);
}
