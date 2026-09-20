// Sätter samma betyg på alla böcker i en serie. Användning: node tools/rate-series.js
// Betyg som redan finns i data/ratings.json skrivs inte över.
const fs = require('fs');
const path = require('path');
const dataDir = path.join(__dirname, '..', 'data');

const RATINGS = {
  5: `Reborn as a Demonic Tree|The Path of Ascension|The Primal Hunter|Arcane Ascension|Battle Mage Farmer|Books of the Ancestor|Broken Empire|Codex Alera|Eisenhorn|Diablo|Geoff Watts Agile Mastery|He Who Fights with Monsters|Infinite Realm|Iron Druid Chronicles|Kingkiller Chronicle|Malazan Book of the Fallen Series|Mark of the Fool|Monster Hunter Memoirs|Monster Hunter|Ravenor|Saga of the Forgotten Warrior|Red Queen's War|Space Marine Conquests: Warhammer 40,000|Speedrunning the Multiverse|Spellmonger|Spellmonger Cadet Series|The Bad Guys|The Good Guys|The Grim Guys|The Horus Heresy|The Legend of Randidly Ghosthound|The Dresden Files|The Cycle of Galand|The Stormlight Archive|Spellmonger: Legacy and Secrets|The Mistborn Saga|The Order|The Realm Between|Weapons and Wielders|The Wheel of Time|The Cycle of the Scour Series`,
  4: `The Shroud of Prophecy|The Paladin Trilogy|The Library Trilogy|The Licanius Trilogy|The Cinder Spires|The Dark Tower|The Book of the Ice|Shattered Legacy|Savage Awakening|Riftwar Saga|My Demonic Farm|Minute Mage|Life in Exile|Mercy Thompson|Legends of the Tainted|King's Dark Tidings|Ink & Sigil|Dragonvein|Hell Mode|Past Life Hero|Game: Online (Dark Herbalist)|Arachnomancer|Black Ocean: Galaxy Outlaws|Blade's Rest|Class Shift|Small-Town Crafter|Wax and Wayne|The Keeper Origins|World of Warcraft`,
  3: `Towers & Rifts|World of Magic|Tower of Power|The War of Broken Mirrors|The Skyward Series|The Hungering Saga|The Hollows|The Godling Chronicles|The Divine Dungeon|Rune Seeker|The Connected System|Real Time Dungeon|Player Reached the Top|Nomad Healer|Natural Laws Apocalypse|Miss Peregrine's Peculiar Children|Jane Yellowrock|For the Loot|Dungeon World|Arcane Kingdom Online|How I Became the World's Strongest Warrior`,
};

const books = JSON.parse(fs.readFileSync(path.join(dataDir, 'books.json'), 'utf8')).books;
const ratingsFile = path.join(dataDir, 'ratings.json');
const ratings = JSON.parse(fs.readFileSync(ratingsFile, 'utf8'));

const bySeries = {};
for (const [stars, list] of Object.entries(RATINGS)) {
  for (const name of list.split('|')) {
    if (bySeries[name] && bySeries[name] !== Number(stars)) console.log(`Konflikt: ${name} har både ${bySeries[name]} och ${stars}`);
    bySeries[name] = Number(stars);
  }
}

const seriesInData = new Set(books.map((b) => b.series).filter(Boolean));
console.log('Serier du nämnt som inte finns i datan:', Object.keys(bySeries).filter((n) => !seriesInData.has(n)));
console.log('Serier i datan som du inte betygsatt:', [...seriesInData].filter((n) => !(n in bySeries)));

let set = 0;
for (const b of books) {
  if (b.series in bySeries && !(b.asin in ratings)) { ratings[b.asin] = bySeries[b.series]; set++; }
}
fs.writeFileSync(ratingsFile, JSON.stringify(ratings, null, 1) + '\n');
const unrated = books.filter((b) => !(b.asin in ratings));
console.log(`Satte ${set} betyg. Kvar utan betyg: ${unrated.length}`);
console.log(unrated.map((b) => `${b.title} (${b.author || '?'})`).join('\n'));
