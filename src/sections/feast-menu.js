/*
 * The hero's Tamil wedding saapadu, in traditional serving order.
 *
 * Layout follows custom: leaf tip to the diner's left; salt, pickle and the sweet
 * at the tip; kosambari, pachadi, poriyals, kootu and avial along the top;
 * vadai, appalam and jangiri toward the stem; rice in the centre with the
 * kuzhambu, rasam and payasam katoris around it; curd rice served last.
 * Sizes are in proportion to a ~55 cm wedding leaf: the rice is the centre of the
 * meal, whole items are close to life size, and no two side dishes are the same
 * spoonful.
 *
 * x, y: centre as % of the leaf (as seen by the diner); w: width as % of leaf length.
 * kind: 'heap' (shaped from the photo's outline) or 'bowl' (steel katori).
 * shape: 'whole' for solid items with a round cross-section (default: a spooned heap).
 * h: height relative to width.
 * gloss: 0 dry … 1 wet/oily.
 * relief: strength of the fine surface relief taken from the photo (default 2.6; lower for pale, even foods).
 * bumps: strength of the piece-level bumps baked into the shape (default 1; lower where grains are too fine to model).
 * Shapes are baked from the photos by scripts/cutout.mjs: run `npm run relief` after changing kind, shape, flat or bumps.
 */
export const MENU = [
  { id: 'salt', en: 'Salt', ta: 'உப்பு', x: 12, y: 46, w: 3.6, kind: 'heap', h: 0.3, gloss: 0.3 },
  { id: 'pickle', en: 'Mango pickle', ta: 'மாங்காய் ஊறுகாய்', x: 18.5, y: 34, w: 6.6, kind: 'heap', h: 0.2, gloss: 0.85 },
  { id: 'payasam', en: 'Paal payasam', ta: 'பால் பாயசம்', x: 19.5, y: 64, w: 8.5, kind: 'bowl', gloss: 0.6 },
  { id: 'kosambari', en: 'Kosambari', ta: 'கோசம்பரி', x: 26.5, y: 28, w: 8.2, kind: 'heap', h: 0.19, gloss: 0.35 },
  { id: 'pachadi', en: 'Thayir pachadi', ta: 'தயிர் பச்சடி', x: 35, y: 24.5, w: 7.6, kind: 'heap', h: 0.1, gloss: 0.7, relief: 1.8 },
  { id: 'poriyal', en: 'Beans poriyal', ta: 'பீன்ஸ் பொரியல்', x: 43.6, y: 25.5, w: 9.2, kind: 'heap', h: 0.2, gloss: 0.3 },
  { id: 'cabbage', en: 'Cabbage poriyal', ta: 'முட்டைகோஸ் பொரியல்', x: 52.8, y: 23, w: 8.4, kind: 'heap', h: 0.2, gloss: 0.3 },
  { id: 'kootu', en: 'Chow chow kootu', ta: 'சௌசௌ கூட்டு', x: 61.4, y: 25.5, w: 8, kind: 'heap', h: 0.13, gloss: 0.55 },
  { id: 'avial', en: 'Avial', ta: 'அவியல்', x: 70, y: 28, w: 8.8, kind: 'heap', h: 0.18, gloss: 0.5 },
  { id: 'vadai', en: 'Medu vadai', ta: 'மெது வடை', x: 83, y: 32, w: 14.5, kind: 'heap', shape: 'whole', h: 0.14, gloss: 0.45 },
  { id: 'appalam', en: 'Appalam', ta: 'அப்பளம்', x: 84.5, y: 68, w: 14.5, kind: 'heap', h: 0.025, gloss: 0.2, flat: true },
  { id: 'jangiri', en: 'Jangiri', ta: 'ஜாங்கிரி', x: 75.5, y: 47, w: 11.5, kind: 'heap', shape: 'whole', h: 0.07, gloss: 0.9 },
  { id: 'banana', en: 'Banana', ta: 'வாழைப்பழம்', x: 29, y: 46.5, w: 16, kind: 'heap', shape: 'whole', h: 0.13, gloss: 0.4 },
  { id: 'rice', en: 'Rice, paruppu & ghee', ta: 'சாதம் பருப்பு நெய்', x: 47.5, y: 64, w: 19.5, kind: 'heap', h: 0.24, gloss: 0.45, relief: 0.9, bumps: 0.3 },
  { id: 'sambar', en: 'Sambar', ta: 'சாம்பார்', x: 31, y: 68, w: 10, kind: 'bowl', gloss: 0.7 },
  { id: 'vathal', en: 'Vathal kuzhambu', ta: 'வத்தல் குழம்பு', x: 72.5, y: 70, w: 9.2, kind: 'bowl', gloss: 0.9 },
  { id: 'rasam', en: 'Rasam', ta: 'ரசம்', x: 62.5, y: 76, w: 9.6, kind: 'bowl', gloss: 0.8 },
  { id: 'curdrice', en: 'Curd rice', ta: 'தயிர் சாதம்', x: 60.5, y: 50, w: 9, kind: 'heap', h: 0.22, gloss: 0.35, relief: 1.8 },
];

// Dishes that get rising steam once they land
export const HOT = new Set(['rice', 'sambar', 'rasam', 'vathal', 'payasam']);
