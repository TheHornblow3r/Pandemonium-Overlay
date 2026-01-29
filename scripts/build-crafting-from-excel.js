const xlsx = require('xlsx');
const fs = require('fs');

const wb = xlsx.readFile('Crafting.xlsx');
const ws = wb.Sheets[wb.SheetNames[0]];
const rows = xlsx.utils.sheet_to_json(ws, { header: 1 });

let currentCategory = null;
let currentItem = null;
let currentBase = null;

const crafts = {};

rows.forEach(row => {
  const [colA, colB, colC] = row;

  // CATEGORY
  if (colA && !colB && !colC) {
    currentCategory = colA.trim();
    currentItem = null;
    currentBase = null;
    return;
  }

  // ITEM HEADER
  if (colA && colB) {
    currentItem = colA.trim();
    currentBase = colB.trim();

    const key = `${currentCategory} ${currentItem}`;
    if (!crafts[key]) {
      crafts[key] = {
        category: currentCategory,
        item: currentItem,
        base: currentBase,
        ingredients: new Set(),
        mods: new Set()
      };
    }

    // first mod on item header row
    if (colC) {
      crafts[key].mods.add(colC.trim());
    }
    return;
  }

  // INGREDIENT / MOD ROW
  if (colB && currentItem) {
    const key = `${currentCategory} ${currentItem}`;

    crafts[key].ingredients.add(colB.trim());

    if (colC) {
      crafts[key].mods.add(colC.trim());
    }
  }
});

// Convert Sets → Arrays
Object.values(crafts).forEach(c => {
  c.ingredients = [...c.ingredients];
  c.mods = [...c.mods];
});

// Save final JSON
fs.writeFileSync(
  'crafting.json',
  JSON.stringify(crafts, null, 2)
);

console.log(`Built ${Object.keys(crafts).length} crafts`);
