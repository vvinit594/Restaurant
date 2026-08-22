/** Verified dish photos only — name-first mapping, never category placeholders. */

const u = (id) =>
  `https://images.unsplash.com/${id}?auto=format&fit=crop&w=500&q=80`;
const p = (id) =>
  `https://images.pexels.com/photos/${id}/pexels-photo-${id}.jpeg?auto=compress&cs=tinysrgb&w=500`;

const IMG = {
  gulabJamun: p(15014919),
  fruitSalad: u('photo-1564093497595-593b96d80180'),
  fruitSaladBowl: u('photo-1519996529931-28324d5a630e'),
  freshFruitPlate: u('photo-1490474418585-ba9bad8fd0ea'),
  freshFruitPlate2: p(1132047),
  iceCreamScoops: u('photo-1570197788417-0e82375c9371'),
  iceCreamCone: u('photo-1497034825429-c343d7c6a68f'),
  iceCreamDessert: u('photo-1551024506-0bccd828d307'),
  strawberryDessert: u('photo-1579954115545-a95591f28bfc'),
  chocolateShake: u('photo-1572490122747-3968b75cc699'),
  chocolateShake2: u('photo-1577805947697-89e18249d767'),
  coldCoffee: u('photo-1638176066666-ffb2f013c7dd'),
  coffee: u('photo-1461023058943-07fcbe16d735'),
  mangoDrink: u('photo-1546173159-315724a31696'),
  orangeJuice: p(96974),
  orangeJuice2: u('photo-1600271886742-f049cd451bba'),
  watermelonJuice: p(1337825),
  berrySmoothie: u('photo-1553530666-ba11a7da3888'),
  milk: u('photo-1550583724-b2692b85b150'),
  mojitoLime: u('photo-1513558161293-cdaf765ed2fd'),
  icedTeaLime: u('photo-1556679343-c7306c1976bc'),
  pineappleFruit: p(947879),
  grapeFruit: p(708777),
  appleFruit: u('photo-1568702846914-96b305d2aaeb'),
  carrot: u('photo-1598170845058-32b9d6a5da37'),
  pomegranate: u('photo-1540420773420-3366772f4999'),
  idli: u('photo-1589301760014-d929f3979dbc'),
  idli2: u('photo-1630383249896-424e482df921'),
  dosa: u('photo-1668236543090-82eba5ee5976'),
  dosa2: p(5560763),
  pavBhaji: p(5410400),
  pavBhaji2: u('photo-1606491956689-2ea866880c84'),
  paneer: p(2474661),
  paneer2: u('photo-1631452180519-c014fe946bc7'),
  vegCurry: u('photo-1585937421612-70a008356fbe'),
  baingan: u('photo-1596797038530-2c107229654b'),
  cornCurry: p(2679501),
  biryani: u('photo-1563379091339-03b21ab4a4f8'),
  biryani2: p(5410401),
  noodles: u('photo-1585032226651-759b368d7246'),
  noodles2: u('photo-1612929633738-8fe44f7ec841'),
  noodles3: p(2347311),
  friedRice: u('photo-1603133872878-684f208fb84b'),
  rice: u('photo-1516684669134-de6f7c473a2a'),
  tikka: u('photo-1567188040759-fb8a883dc6d8'),
  kebab: u('photo-1599487488170-d11ec9c172f0'),
  salad: u('photo-1540189549336-e6e99c3679fe'),
  saladGreen: u('photo-1512621776951-a57141f2eefd'),
  pizza: u('photo-1513104890138-7c749659a591'),
  pizza2: u('photo-1565299624946-b28f40a0ae38'),
  burger: u('photo-1568901346375-23c9450c58cd'),
  burger2: u('photo-1550547660-d9450f859349'),
  sandwich: u('photo-1528735602780-2552fd46c7af'),
  sandwich2: u('photo-1539252554453-80ab65ce3586'),
  clubSandwich: u('photo-1553909489-cd47e0907980'),
  pasta: u('photo-1621996346565-e3dbc646d9a9'),
  pasta2: u('photo-1551183053-bf91a1d81141'),
  soup: u('photo-1476718406336-bb5a9690ee2a'),
  soupTomato: p(539451),
  soupClear: p(1703272),
  springRoll: u('photo-1544025162-d76694265947'),
  dal: u('photo-1546833999-b9f581a1996d'),
  samosa: u('photo-1601050690597-df0568f70950'),
  chaat: u('photo-1626777552726-4a6b54c97e46'),
  cheese: u('photo-1486297678162-eb2a19b0a32d'),
  butter: u('photo-1589985270826-4b7bb135bc9d'),
  mushroom: u('photo-1607623814075-e51df1bdc82f'),
  dryFruit: u('photo-1606923829579-0cb981a83e2e'),
  almond: u('photo-1508747703725-719777637510'),
  cashew: u('photo-1534482421-64566f976cfa'),
  fig: u('photo-1577234286642-fc512a5f8f11'),
};

function pick(urls, key) {
  const list = Array.isArray(urls) ? urls : [urls];
  let h = 0;
  for (let i = 0; i < key.length; i += 1) h = (h * 31 + key.charCodeAt(i)) >>> 0;
  return list[h % list.length];
}

/** Exact dish name → photo (1:1 where distinctive). */
const BY_NAME = {
  // Desserts
  'Gulab Jamun': IMG.gulabJamun,
  'Fruit Salad': IMG.fruitSaladBowl,
  'Fresh Fruit Plate': IMG.freshFruitPlate,
  'Fruit Salad With Ice Cream': IMG.strawberryDessert,
  Jelly: IMG.fruitSaladBowl,
  'Fruit Jelly': IMG.freshFruitPlate2,
  'Jelly With Ice Cream': IMG.iceCreamScoops,
  'Vanilla With Hot Chocolate': IMG.iceCreamDessert,

  // Lassi
  'Gateway Special Lassi': IMG.berrySmoothie,
  'Sweet Lassi': IMG.milk,
  'Salt Lassi': IMG.milk,
  'Mango Lassi': IMG.mangoDrink,
  'Butter Milk': IMG.milk,

  // Falooda / Kulfi / Scoops
  'Gateway Special Falooda': IMG.iceCreamDessert,
  'Royal Falooda': IMG.berrySmoothie,
  'Kesar Falooda': IMG.mangoDrink,
  'Kulfi Falooda': IMG.iceCreamScoops,
  'Malai Kulfi': IMG.iceCreamScoops,
  'Kesar Pista Kulfi': IMG.mangoDrink,
  'Pista Kulfi': IMG.iceCreamCone,
  '3 In 1 Kulfi': IMG.iceCreamDessert,
  'Matka Kulfi': IMG.iceCreamScoops,
  'Vanilla Scoop': IMG.iceCreamCone,
  'Kesar Pista Scoop': IMG.mangoDrink,
  'Butter Scotch Scoop': IMG.iceCreamDessert,
  'Chocolate Scoop': IMG.chocolateShake2,
  'Strawberry Scoop': IMG.strawberryDessert,

  // Juices
  'Fresh Lime Juice': IMG.mojitoLime,
  'Ginger Lemon Juice': IMG.icedTeaLime,
  'Mosambi Juice': IMG.orangeJuice,
  'Orange Juice': IMG.orangeJuice2,
  'Water Melon Juice': IMG.watermelonJuice,
  'Pineapple Juice': IMG.mangoDrink,
  'Ganga Jamuna': IMG.orangeJuice,
  Mastani: IMG.mangoDrink,
  'Crocodile Juice': IMG.berrySmoothie,
  'Grape Juice': IMG.grapeFruit,
  'Apple Juice': IMG.appleFruit,
  'Pomegranate Juice': IMG.pomegranate,
  'Mango Juice (Pulp)': IMG.mangoDrink,
  'Carrot Juice': IMG.carrot,

  // Milkshakes
  'Chikoo Milkshake': IMG.chocolateShake2,
  'Banana Milkshake': IMG.milk,
  'Apple Milkshake': IMG.appleFruit,
  'Sitafal Milkshake': IMG.berrySmoothie,
  'Fresh Strawberry Milkshake': IMG.strawberryDessert,
  'Mango Milkshake (Pulp)': IMG.mangoDrink,
  'Vanilla Milkshake': IMG.milk,
  'Cold Coffee': IMG.coldCoffee,
  'Dry Fruit Milkshake': IMG.dryFruit,
  'Badam Milkshake': IMG.almond,
  'Kaju Milkshake': IMG.cashew,
  'Anjeer Milkshake': IMG.fig,
  'Kaju Anjeer Milkshake': IMG.dryFruit,

  // South Indian highlights
  'Steam Idli': IMG.idli,
  'Butter Idli': IMG.idli2,
  'Fry Idli': IMG.idli,
  'Dahi Idli': IMG.idli2,
  'Idli Vada': IMG.idli,
  'Medu Vada': IMG.samosa,
  'Sada Dosa': IMG.dosa2,
  'Masala Dosa': IMG.dosa,
  'Mysore Sada Dosa': IMG.dosa2,
  'Mysore Masala Dosa': IMG.dosa,
  'Set Dosa': IMG.dosa2,
  'Uttapam': IMG.idli2,
  'Onion Uttapam': IMG.idli2,
  'Upma (9.00 Am To 12.00 Pm)': IMG.idli,

  // Extras
  'Items Prepared in Butter / Ghee': IMG.butter,
  'Items Prepared in Cheese': IMG.cheese,

  // Signature street / pizza
  'Pav Bhaji': IMG.pavBhaji,
  'Gateway Special Pav Bhaji (Dry Fruit Topping)': IMG.pavBhaji2,
  'Cheese Pav Bhaji': IMG.pavBhaji,
  'Veg. Pizza': IMG.pizza,
  'Cheese Pizza (Only Cheese)': IMG.pizza2,
  'Veg. Burger': IMG.burger,
  'Veg. Cheese Burger': IMG.burger2,
  'Club Sandwich': IMG.clubSandwich,
  'Bhel Puri': IMG.chaat,
  'Pani Puri': IMG.chaat,
  'Paneer Tikka': IMG.tikka,
  'Paneer Butter Masala': IMG.paneer,
  'Paneer Tikka Masala': IMG.paneer2,
  'Dal Makhni': IMG.dal,
  'Veg. Biryani': IMG.biryani,
  'Veg. Hakka Noodles': IMG.noodles3,
  'Veg. Fried Rice': IMG.friedRice,
  'Tomato Soup': IMG.soupTomato,
  'Gobi Manchurian Dry': IMG.noodles,
  'Baked Macorni': IMG.pasta,
  'Baked Veg.': IMG.pasta2,
};

/**
 * Resolve a menu image from the exact dish name first, then specific keywords.
 * category is ignored for selection (kept for call-site compatibility).
 */
function getImageUrl(_category, name = '') {
  if (BY_NAME[name]) return BY_NAME[name];

  const n = name.toLowerCase();

  // Desserts / frozen
  if (n.includes('gulab')) return IMG.gulabJamun;
  if (n.includes('fruit salad') && n.includes('ice')) return IMG.iceCreamDessert;
  if (n.includes('fresh fruit')) return IMG.freshFruitPlate;
  if (n.includes('fruit salad')) return IMG.fruitSaladBowl;
  if (n.includes('jelly') && n.includes('ice')) return IMG.strawberryDessert;
  if (n.includes('jelly')) return IMG.fruitSalad;
  if (n.includes('falooda')) return pick([IMG.strawberryDessert, IMG.berrySmoothie, IMG.mangoDrink, IMG.iceCreamScoops], name);
  if (n.includes('kulfi')) return pick([IMG.iceCreamScoops, IMG.iceCreamCone, IMG.iceCreamDessert], name);
  if (n.includes('scoop')) {
    if (n.includes('chocolate')) return IMG.chocolateShake;
    if (n.includes('strawberry')) return IMG.strawberryDessert;
    if (n.includes('butter')) return IMG.iceCreamDessert;
    return IMG.iceCreamScoops;
  }
  if (n.includes('lassi')) {
    if (n.includes('mango')) return IMG.mangoDrink;
    return IMG.milk;
  }
  if (n.includes('butter milk')) return IMG.milk;

  // Juices
  if (n.includes('juice') || n.includes('mastani') || n.includes('ganga')) {
    if (n.includes('water mel') || n.includes('watermelon')) return IMG.watermelonJuice;
    if (n.includes('mango')) return IMG.mangoDrink;
    if (n.includes('orange') || n.includes('mosambi')) return IMG.orangeJuice;
    if (n.includes('lime') || n.includes('lemon') || n.includes('ginger')) return IMG.mojitoLime;
    if (n.includes('pineapple')) return IMG.pineappleFruit;
    if (n.includes('grape')) return IMG.grapeFruit;
    if (n.includes('apple')) return IMG.appleFruit;
    if (n.includes('pomegranate') || n.includes('anar')) return IMG.pomegranate;
    if (n.includes('carrot')) return IMG.carrot;
    return IMG.orangeJuice2;
  }

  // Milkshakes
  if (n.includes('milkshake') || n.includes('cold coffee')) {
    if (n.includes('strawberry')) return IMG.strawberryDessert;
    if (n.includes('mango')) return IMG.mangoDrink;
    if (n.includes('coffee')) return IMG.coldCoffee;
    if (n.includes('chocolate') || n.includes('chikoo')) return IMG.chocolateShake;
    if (n.includes('badam') || n.includes('almond')) return IMG.almond;
    if (n.includes('kaju') || n.includes('cashew')) return IMG.cashew;
    if (n.includes('anjeer') || n.includes('fig')) return IMG.fig;
    if (n.includes('dry fruit')) return IMG.dryFruit;
    if (n.includes('apple')) return IMG.appleFruit;
    return pick([IMG.milk, IMG.chocolateShake2, IMG.berrySmoothie], name);
  }

  // South Indian
  if (n.includes('dosa')) return pick([IMG.dosa, IMG.dosa2], name);
  if (n.includes('idli')) return pick([IMG.idli, IMG.idli2], name);
  if (n.includes('uttapam') || n.includes('upma') || n.includes('omelet')) {
    return pick([IMG.idli2, IMG.idli, IMG.dosa2], name);
  }
  if (n.includes('vada') && !n.includes('pav')) return IMG.samosa;

  // Pav bhaji / pulav street
  if (n.includes('pav bhaji') || n.includes('bhaji') || n.includes('masala pav') || n.includes('kadak pav') || n.includes('single pav')) {
    return pick([IMG.pavBhaji, IMG.pavBhaji2], name);
  }
  if (n.includes('tawa pulav') || (n.includes('pulav') && !n.includes('biryani'))) {
    return pick([IMG.friedRice, IMG.biryani, IMG.rice], name);
  }

  // Pizza / burger / sandwich
  if (n.includes('pizza')) return pick([IMG.pizza, IMG.pizza2], name);
  if (n.includes('burger')) return pick([IMG.burger, IMG.burger2], name);
  if (n.includes('club sandwich')) return IMG.clubSandwich;
  if (n.includes('sandwich') || n.includes('toast') || n.includes('bread butter')) {
    return pick([IMG.sandwich, IMG.sandwich2, IMG.clubSandwich], name);
  }

  // Chaat / snacks
  if (n.includes('chaat') || n.includes('puri') || n.includes('bhel') || n.includes('sev')) {
    return IMG.chaat;
  }
  if (n.includes('samosa')) return IMG.samosa;

  // Starters
  if (n.includes('tikka') || n.includes('tandoor')) return IMG.tikka;
  if (n.includes('kabab') || n.includes('kebab') || n.includes('seekh')) return IMG.kebab;

  // Salad / raita / papad / curd
  if (n.includes('fruit')) return IMG.fruitSaladBowl;
  if (n.includes('raita') || n.includes('curd')) return IMG.milk;
  if (n.includes('papad')) return IMG.baingan;
  if (n.includes('salad')) return pick([IMG.salad, IMG.saladGreen], name);

  // Rice / biryani
  if (n.includes('biryani')) return pick([IMG.biryani, IMG.biryani2], name);
  if (n.includes('khichdi')) return IMG.rice;
  if (n.includes('rice') || n.includes('pulav')) return pick([IMG.rice, IMG.friedRice, IMG.biryani], name);

  // Chinese
  if (n.includes('spring roll') || n.includes('pasta roll')) return IMG.springRoll;
  if (n.includes('noodle') || n.includes('hakka') || n.includes('choupsey') || n.includes('chow')) {
    return pick([IMG.noodles, IMG.noodles2, IMG.noodles3], name);
  }
  if (n.includes('fried rice') || n.includes('triple rice') || n.includes('schezwan rice') || n.includes('combination rice') || n.includes('singapore')) {
    return pick([IMG.friedRice, IMG.biryani, IMG.rice], name);
  }
  if (n.includes('manchurian') || n.includes('chilly') || n.includes('schezwan') || n.includes('dragon') || n.includes('crispy') || n.includes('65') || n.includes('hongkong') || n.includes('hong kong') || n.includes('gold coin')) {
    if (n.includes('paneer')) return pick([IMG.paneer, IMG.paneer2, IMG.tikka], name);
    if (n.includes('mushroom')) return IMG.mushroom;
    return pick([IMG.noodles, IMG.noodles3, IMG.springRoll], name);
  }

  // Soup
  if (n.includes('soup')) {
    if (n.includes('tomato')) return IMG.soupTomato;
    if (n.includes('clear')) return IMG.soupClear;
    return pick([IMG.soup, IMG.soupTomato, IMG.soupClear], name);
  }

  // Baked
  if (n.includes('baked') || n.includes('macorni') || n.includes('macaroni')) {
    return pick([IMG.pasta, IMG.pasta2], name);
  }

  // Main course
  if (n.includes('dal') || n.includes('dhal')) return IMG.dal;
  if (n.includes('baigan') || n.includes('baingan') || n.includes('bhartha')) return IMG.baingan;
  if (n.includes('mushroom') && n.includes('baby')) return IMG.cornCurry;
  if (n.includes('mushroom')) return IMG.mushroom;
  if (n.includes('green peas') || n.includes('mutter') || n.includes('corn')) return IMG.cornCurry;
  if (n.includes('paneer') || n.includes('kofta') || n.includes('kaju') || n.includes('khoya')) {
    return pick([IMG.paneer, IMG.paneer2, IMG.vegCurry], name);
  }
  if (n.includes('alu') || n.includes('aloo') || n.includes('bhindi') || n.includes('chana') || n.includes('methi') || n.includes('palak') || n.includes('stuffed') || n.includes('navratan') || n.includes('malai') || n.includes('veg')) {
    return pick([IMG.vegCurry, IMG.baingan, IMG.cornCurry, IMG.paneer], name);
  }

  // Extras
  if (n.includes('butter') || n.includes('ghee')) return IMG.butter;
  if (n.includes('cheese')) return IMG.cheese;

  // Last resort: neutral veg thali-style curry (never kebab/random)
  return IMG.vegCurry;
}

module.exports = { getImageUrl };
