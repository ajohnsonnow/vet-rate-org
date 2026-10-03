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

const NAME_WORD = String.raw`[A-Z][A-Za-z'’-]{1,24}`;
const PLACE_WORD = String.raw`[A-Z][A-Za-z.'-]{1,20}`;

const TITLED_NAME = new RegExp(
  String.raw`\b(?:${TITLES})\.?[ \t]+${NAME_WORD}(?:[ \t]+(?:[A-Z]\.|${NAME_WORD})){0,2}`,
  "g",
);
const LAST_COMMA_FIRST = new RegExp(
  String.raw`\b(${NAME_WORD}),[ \t]+(${NAME_WORD})(?:[ \t]+[A-Z]\b\.?)?`,
  "g",
);
const MIDDLE_INITIAL_NAME = new RegExp(
  String.raw`\b${NAME_WORD}[ \t]+[A-Z]\.[ \t]+${NAME_WORD}`,
  "g",
);
const CITY_STATE_CODE = new RegExp(
  String.raw`\b${PLACE_WORD}(?:[ \t]+${PLACE_WORD}){0,2},[ \t]+(?:${STATE_CODES})\b(?![A-Za-z])`,
  "g",
);
const CITY_STATE_NAME = new RegExp(
  String.raw`\b${PLACE_WORD}(?:[ \t]+${PLACE_WORD}){0,2},[ \t]+(?:${STATE_NAMES})\b`,
  "g",
);
const ZIP = /(?<![\d-])\d{5}(?:-\d{4})?(?![\d-])/g;
const CAPITALIZED_RUN =
  /[A-Z][A-Za-z'’-]{2,24}(?:[ \t]+[A-Z][A-Za-z'’-]{2,24})+/g;

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
    "mine marksmanship excellence overseas deployment ribbon unit presidential"
  ).split(" "),
);
const STATE_WORDS = new Set(
  STATE_NAMES.toLowerCase()
    .split("|")
    .flatMap((name) => name.split(" ")),
);

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

export function removeCityAndState(text) {
  return text.replace(CITY_STATE_CODE, MARK).replace(CITY_STATE_NAME, MARK);
}

export function removeNameShapes(text) {
  return text
    .replace(TITLED_NAME, MARK)
    .replace(LAST_COMMA_FIRST, (match, last, first) =>
      isVocabulary(last) ||
      (isVocabulary(first) && !STATE_WORDS.has(first.toLowerCase()))
        ? match
        : MARK,
    )
    .replace(MIDDLE_INITIAL_NAME, MARK);
}

const SHORT_RUN_WORDS = 3;

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
    for (const part of run.split(/[ \t]+/)) {
      if (isVocabulary(part)) {
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

/**
 * `bare` also removes adjacent capitalized words that are not military, award
 * or place vocabulary ("John Smith"): "prose" at any length (sentences and unit
 * lines), "short" only for two or three words (award, school and deployment
 * names, whose longer titles are capitalized phrases a vocabulary cannot list).
 */
export function removePersonAndPlaceShapes(text, { bare = "none" } = {}) {
  let out = removeNameShapes(removeCityAndState(text));
  out = removeZipCodes(out);
  if (bare === "prose") out = removeBareNames(out, Infinity);
  if (bare === "short") out = removeBareNames(out, SHORT_RUN_WORDS);
  return collapse(out);
}
