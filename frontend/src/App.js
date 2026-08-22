import React, { useState } from 'react';
import Fuse from 'fuse.js';
import { getImageUrl } from './dishImages';
import SiteNavbar from './components/SiteNavbar';
import './App.css';

const CATEGORY_LABELS = {
  south_indian: 'South Indian',
  extras: 'Extras',
  snacks: 'Snacks',
  pav_bhaji: 'Pav Bhaji',
  sandwich: 'Sandwich',
  pizza_burger: 'Pizza & Burger',
  chaat: 'Chaat',
  starters: 'Starters',
  salad: 'Salads',
  main_course: 'Main Course',
  rice: 'Rice',
  chinese_starters: 'Chinese Starters',
  soup: 'Soup',
  chinese_main_course: 'Chinese Main Course',
  chinese_noodles_rice: 'Chinese Noodles & Rice',
  baked_dishes: 'Baked Dishes',
  dessert: 'Desserts',
  lassi: 'Lassi',
  fresh_juices: 'Fresh Juices',
  milkshake: 'Milkshakes',
  falooda: 'Falooda',
  kulfi: 'Kulfi',
  scoops: 'Scoops',
};

const CATEGORY_SEARCH_KEYWORDS = {
  south_indian: ['idli', 'dosa', 'uttapam', 'vada', 'upma', 'sambar', 'chutney'],
  extras: ['butter', 'ghee', 'cheese'],
  snacks: ['bhature', 'samosa', 'vada', 'pakoda', 'toast', 'puri'],
  pav_bhaji: ['pav', 'bhaji', 'butter', 'pulav'],
  sandwich: ['bread', 'toast', 'grill', 'club', 'garlic', 'paneer'],
  pizza_burger: ['pizza', 'burger', 'cheese', 'base', 'bun'],
  chaat: ['puri', 'bhel', 'sev', 'tamarind', 'chutney'],
  starters: ['tikka', 'kabab', 'starter', 'tandoor'],
  salad: ['salad', 'raita', 'curd', 'papad'],
  main_course: ['paneer', 'veg', 'gravy', 'sabzi', 'kofta', 'dal'],
  rice: ['rice', 'biryani', 'pulav', 'khichdi', 'jeera'],
  chinese_starters: ['manchurian', 'crispy', 'chilly', 'dragon', 'roll'],
  soup: ['soup', 'clear', 'hot', 'sour', 'manchow'],
  chinese_main_course: ['hakka', 'schezwan', 'manchurian', 'chow', 'noodles'],
  chinese_noodles_rice: ['fried rice', 'noodles', 'schezwan', 'triple rice'],
  baked_dishes: ['baked', 'macaroni', 'cheese', 'pineapple'],
  dessert: ['sweet', 'jelly', 'ice cream', 'gulab jamun', 'fruit'],
  lassi: ['lassi', 'butter milk', 'sweet', 'salt'],
  fresh_juices: ['juice', 'lime', 'orange', 'apple', 'mango', 'carrot'],
  milkshake: ['milkshake', 'cold coffee', 'vanilla', 'mango', 'dry fruit'],
  falooda: ['falooda', 'kulfi', 'lassi', 'sweet'],
  kulfi: ['kulfi', 'ice cream', 'pista', 'malai'],
  scoops: ['scoop', 'ice cream', 'vanilla', 'chocolate', 'strawberry'],
};

function toSearchTerms(value) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .split(' ')
    .filter(Boolean);
}

function getCategoryLabel(category) {
  return CATEGORY_LABELS[category] || category.replace(/_/g, ' ');
}

function buildIngredients(dish) {
  const nameTerms = toSearchTerms(dish.name);
  const categoryTerms = toSearchTerms(getCategoryLabel(dish.category));
  const keywords = CATEGORY_SEARCH_KEYWORDS[dish.category] || [];

  return Array.from(new Set([...keywords, ...nameTerms, ...categoryTerms]));
}

function normalizeDish(dish) {
  return {
    ...dish,
    categoryLabel: getCategoryLabel(dish.category),
    ingredients: dish.ingredients && dish.ingredients.length > 0 ? dish.ingredients : buildIngredients(dish),
  };
}

function App() {
  const [searchText, setSearchText] = useState("");
  const [selectedPriceRange, setSelectedPriceRange] = useState("all");
  const [selectedCategory, setSelectedCategory] = useState("all");

  const scrollToSearch = () => {
    const target = document.getElementById('menu-section');

    if (target) {
      target.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  };

  const priceRangeOptions = [
    { value: "all", label: "All Prices" },
    { value: "under_100", label: "Under ₹100" },
    { value: "under_200", label: "Under ₹200" },
    { value: "under_300", label: "Under ₹300" },
    { value: "under_500", label: "Under ₹500" },
    { value: "under_600", label: "Under ₹600" },
  ];

  const rawDishes = [
    { id: 1, name: "Steam Idli", price: 55, category: "south_indian", image: getImageUrl("south_indian", "Steam Idli") },
    { id: 2, name: "Butter Idli", price: 75, category: "south_indian", image: getImageUrl("south_indian", "Butter Idli") },
    { id: 3, name: "Fry Idli", price: 75, category: "south_indian", image: getImageUrl("south_indian", "Fry Idli") },
    { id: 4, name: "Dahi Idli", price: 75, category: "south_indian", image: getImageUrl("south_indian", "Dahi Idli") },
    { id: 5, name: "Idli Vada", price: 60, category: "south_indian", image: getImageUrl("south_indian", "Idli Vada") },
    { id: 6, name: "Medu Vada", price: 65, category: "south_indian", image: getImageUrl("south_indian", "Medu Vada") },
    { id: 7, name: "Sada Dosa", price: 65, category: "south_indian", image: getImageUrl("south_indian", "Sada Dosa") },
    { id: 8, name: "Masala Dosa", price: 75, category: "south_indian", image: getImageUrl("south_indian", "Masala Dosa") },
    { id: 9, name: "Mysore Sada Dosa", price: 80, category: "south_indian", image: getImageUrl("south_indian", "Mysore Sada Dosa") },
    { id: 10, name: "Mysore Masala Dosa", price: 90, category: "south_indian", image: getImageUrl("south_indian", "Mysore Masala Dosa") },
    { id: 11, name: "Rava Sada Dosa", price: 75, category: "south_indian", image: getImageUrl("south_indian", "Rava Sada Dosa") },
    { id: 12, name: "Rava Masala Dosa", price: 85, category: "south_indian", image: getImageUrl("south_indian", "Rava Masala Dosa") },
    { id: 13, name: "Onion Rava Sada Dosa", price: 80, category: "south_indian", image: getImageUrl("south_indian", "Onion Rava Sada Dosa") },
    { id: 14, name: "Onion Rava Masala Dosa", price: 90, category: "south_indian", image: getImageUrl("south_indian", "Onion Rava Masala Dosa") },
    { id: 15, name: "Paper Sada Dosa", price: 135, category: "south_indian", image: getImageUrl("south_indian", "Paper Sada Dosa") },
    { id: 16, name: "Paper Masala Dosa", price: 155, category: "south_indian", image: getImageUrl("south_indian", "Paper Masala Dosa") },
    { id: 17, name: "Palak Sada Dosa", price: 95, category: "south_indian", image: getImageUrl("south_indian", "Palak Sada Dosa") },
    { id: 18, name: "Palak Masala Dosa", price: 105, category: "south_indian", image: getImageUrl("south_indian", "Palak Masala Dosa") },
    { id: 19, name: "Schezwan Sada Dosa", price: 95, category: "south_indian", image: getImageUrl("south_indian", "Schezwan Sada Dosa") },
    { id: 20, name: "Schezwan Masala Dosa", price: 110, category: "south_indian", image: getImageUrl("south_indian", "Schezwan Masala Dosa") },
    { id: 21, name: "Set Dosa", price: 35, category: "south_indian", image: getImageUrl("south_indian", "Set Dosa") },
    { id: 22, name: "Uttapam", price: 75, category: "south_indian", image: getImageUrl("south_indian", "Uttapam") },
    { id: 23, name: "Onion Uttapam", price: 85, category: "south_indian", image: getImageUrl("south_indian", "Onion Uttapam") },
    { id: 24, name: "Tomato Onion Uttapam", price: 85, category: "south_indian", image: getImageUrl("south_indian", "Tomato Onion Uttapam") },
    { id: 25, name: "Masala Uttapam", price: 85, category: "south_indian", image: getImageUrl("south_indian", "Masala Uttapam") },
    { id: 26, name: "Coconut Uttapam", price: 85, category: "south_indian", image: getImageUrl("south_indian", "Coconut Uttapam") },
    { id: 27, name: "Mix Uttapam", price: 95, category: "south_indian", image: getImageUrl("south_indian", "Mix Uttapam") },
    { id: 28, name: "Paneer Uttapam", price: 130, category: "south_indian", image: getImageUrl("south_indian", "Paneer Uttapam") },
    { id: 29, name: "Cheese Uttapam", price: 130, category: "south_indian", image: getImageUrl("south_indian", "Cheese Uttapam") },
    { id: 30, name: "Mushroom Uttapam", price: 130, category: "south_indian", image: getImageUrl("south_indian", "Mushroom Uttapam") },
    { id: 31, name: "Tomato Omelet", price: 85, category: "south_indian", image: getImageUrl("south_indian", "Tomato Omelet") },
    { id: 32, name: "Upma (9.00 Am To 12.00 Pm)", price: 65, category: "south_indian", image: getImageUrl("south_indian", "Upma (9.00 Am To 12.00 Pm)") },
    { id: 33, name: "Items Prepared in Butter / Ghee", price: 35, category: "extras", image: getImageUrl("extras", "Items Prepared in Butter / Ghee") },
    { id: 34, name: "Items Prepared in Cheese", price: 35, category: "extras", image: getImageUrl("extras", "Items Prepared in Cheese") },
    { id: 35, name: "Veg. Sandwich", price: 50, category: "sandwich", image: getImageUrl("sandwich", "Veg. Sandwich") },
    { id: 36, name: "Chatni Sandwich", price: 45, category: "sandwich", image: getImageUrl("sandwich", "Chatni Sandwich") },
    { id: 37, name: "Veg. Toast Sandwich", price: 60, category: "sandwich", image: getImageUrl("sandwich", "Veg. Toast Sandwich") },
    { id: 38, name: "Cheese Sandwich", price: 85, category: "sandwich", image: getImageUrl("sandwich", "Cheese Sandwich") },
    { id: 39, name: "Veg. Cheese Sandwich", price: 95, category: "sandwich", image: getImageUrl("sandwich", "Veg. Cheese Sandwich") },
    { id: 40, name: "Veg. Cheese Toast Sandwich", price: 105, category: "sandwich", image: getImageUrl("sandwich", "Veg. Cheese Toast Sandwich") },
    { id: 41, name: "Veg. Grill Sandwich", price: 125, category: "sandwich", image: getImageUrl("sandwich", "Veg. Grill Sandwich") },
    { id: 42, name: "Veg. Cheese Grill Sandwich", price: 145, category: "sandwich", image: getImageUrl("sandwich", "Veg. Cheese Grill Sandwich") },
    { id: 43, name: "Garlic Sandwich", price: 70, category: "sandwich", image: getImageUrl("sandwich", "Garlic Sandwich") },
    { id: 44, name: "Garlic Toast Sandwich", price: 80, category: "sandwich", image: getImageUrl("sandwich", "Garlic Toast Sandwich") },
    { id: 45, name: "Club Sandwich", price: 135, category: "sandwich", image: getImageUrl("sandwich", "Club Sandwich") },
    { id: 46, name: "Paneer Sandwich", price: 150, category: "sandwich", image: getImageUrl("sandwich", "Paneer Sandwich") },
    { id: 47, name: "Paneer Toast Sandwich", price: 160, category: "sandwich", image: getImageUrl("sandwich", "Paneer Toast Sandwich") },
    { id: 48, name: "Tomato Omelet Sandwich", price: 95, category: "sandwich", image: getImageUrl("sandwich", "Tomato Omelet Sandwich") },
    { id: 49, name: "Bread Butter Sandwich", price: 50, category: "sandwich", image: getImageUrl("sandwich", "Bread Butter Sandwich") },
    { id: 50, name: "Bread Butter Jam Sandwich", price: 50, category: "sandwich", image: getImageUrl("sandwich", "Bread Butter Jam Sandwich") },
    { id: 51, name: "Toast Butter Sandwich", price: 55, category: "sandwich", image: getImageUrl("sandwich", "Toast Butter Sandwich") },
    { id: 52, name: "Toast Butter Jam Sandwich", price: 55, category: "sandwich", image: getImageUrl("sandwich", "Toast Butter Jam Sandwich") },
    { id: 53, name: "Gateway Special Pav Bhaji (Dry Fruit Topping)", price: 175, category: "pav_bhaji", image: getImageUrl("pav_bhaji", "Gateway Special Pav Bhaji (Dry Fruit Topping)") },
    { id: 54, name: "Pav Bhaji", price: 120, category: "pav_bhaji", image: getImageUrl("pav_bhaji", "Pav Bhaji") },
    { id: 55, name: "Cheese Pav Bhaji", price: 145, category: "pav_bhaji", image: getImageUrl("pav_bhaji", "Cheese Pav Bhaji") },
    { id: 56, name: "Khada Pav Bhaji", price: 140, category: "pav_bhaji", image: getImageUrl("pav_bhaji", "Khada Pav Bhaji") },
    { id: 57, name: "Kadak Pav Bhaji", price: 140, category: "pav_bhaji", image: getImageUrl("pav_bhaji", "Kadak Pav Bhaji") },
    { id: 58, name: "Jain Pav Bhaji", price: 140, category: "pav_bhaji", image: getImageUrl("pav_bhaji", "Jain Pav Bhaji") },
    { id: 59, name: "Mushroom Pav Bhaji", price: 155, category: "pav_bhaji", image: getImageUrl("pav_bhaji", "Mushroom Pav Bhaji") },
    { id: 60, name: "Paneer Pav Bhaji", price: 155, category: "pav_bhaji", image: getImageUrl("pav_bhaji", "Paneer Pav Bhaji") },
    { id: 61, name: "Only Bhaji", price: 105, category: "pav_bhaji", image: getImageUrl("pav_bhaji", "Only Bhaji") },
    { id: 62, name: "Single Pav", price: 15, category: "pav_bhaji", image: getImageUrl("pav_bhaji", "Single Pav") },
    { id: 63, name: "Single Kadak Pav", price: 14, category: "pav_bhaji", image: getImageUrl("pav_bhaji", "Single Kadak Pav") },
    { id: 64, name: "Masala Pav (2 Pcs)", price: 110, category: "pav_bhaji", image: getImageUrl("pav_bhaji", "Masala Pav (2 Pcs)") },
    { id: 65, name: "Tawa Pulav", price: 135, category: "pav_bhaji", image: getImageUrl("pav_bhaji", "Tawa Pulav") },
    { id: 66, name: "Cheese Tawa Pulav", price: 145, category: "pav_bhaji", image: getImageUrl("pav_bhaji", "Cheese Tawa Pulav") },
    { id: 67, name: "Paneer Tawa Pulav", price: 155, category: "pav_bhaji", image: getImageUrl("pav_bhaji", "Paneer Tawa Pulav") },
    { id: 68, name: "Veg. Pizza", price: 150, category: "pizza_burger", image: getImageUrl("pizza_burger", "Veg. Pizza") },
    { id: 69, name: "Cheese Pizza (Only Cheese)", price: 155, category: "pizza_burger", image: getImageUrl("pizza_burger", "Cheese Pizza (Only Cheese)") },
    { id: 70, name: "Jain Pizza", price: 160, category: "pizza_burger", image: getImageUrl("pizza_burger", "Jain Pizza") },
    { id: 71, name: "Mushroom Pizza", price: 165, category: "pizza_burger", image: getImageUrl("pizza_burger", "Mushroom Pizza") },
    { id: 72, name: "Cheese Garlic Pizza", price: 165, category: "pizza_burger", image: getImageUrl("pizza_burger", "Cheese Garlic Pizza") },
    { id: 73, name: "Baby Corn Pizza", price: 170, category: "pizza_burger", image: getImageUrl("pizza_burger", "Baby Corn Pizza") },
    { id: 74, name: "Mushroom Babycorn Pizza", price: 170, category: "pizza_burger", image: getImageUrl("pizza_burger", "Mushroom Babycorn Pizza") },
    { id: 75, name: "Veg. Burger", price: 105, category: "pizza_burger", image: getImageUrl("pizza_burger", "Veg. Burger") },
    { id: 76, name: "Veg. Cheese Burger", price: 110, category: "pizza_burger", image: getImageUrl("pizza_burger", "Veg. Cheese Burger") },
    { id: 77, name: "Gateway Special Chaat", price: 120, category: "chaat", image: getImageUrl("chaat", "Gateway Special Chaat") },
    { id: 78, name: "Bhel Puri", price: 75, category: "chaat", image: getImageUrl("chaat", "Bhel Puri") },
    { id: 79, name: "Sev Puri", price: 75, category: "chaat", image: getImageUrl("chaat", "Sev Puri") },
    { id: 80, name: "Pani Puri", price: 75, category: "chaat", image: getImageUrl("chaat", "Pani Puri") },
    { id: 81, name: "Dahibata Puri", price: 90, category: "chaat", image: getImageUrl("chaat", "Dahibata Puri") },
    { id: 82, name: "Delhi Chaat", price: 100, category: "chaat", image: getImageUrl("chaat", "Delhi Chaat") },
    { id: 83, name: "Agra Ka Bhalla Chaat", price: 100, category: "chaat", image: getImageUrl("chaat", "Agra Ka Bhalla Chaat") },
    { id: 84, name: "Alu Chaat", price: 100, category: "chaat", image: getImageUrl("chaat", "Alu Chaat") },
    { id: 85, name: "Samosa Chaat", price: 90, category: "chaat", image: getImageUrl("chaat", "Samosa Chaat") },
    { id: 86, name: "Angoor Chaat", price: 110, category: "chaat", image: getImageUrl("chaat", "Angoor Chaat") },
    { id: 87, name: "Gateway Tandoor Plater", price: 270, category: "starters", image: getImageUrl("starters", "Gateway Tandoor Plater") },
    { id: 88, name: "Paneer Tikka", price: 200, category: "starters", image: getImageUrl("starters", "Paneer Tikka") },
    { id: 89, name: "Paneer Pahadi Tikka", price: 205, category: "starters", image: getImageUrl("starters", "Paneer Pahadi Tikka") },
    { id: 90, name: "Gobi Tikka", price: 160, category: "starters", image: getImageUrl("starters", "Gobi Tikka") },
    { id: 91, name: "Hara Bhara Kabab", price: 160, category: "starters", image: getImageUrl("starters", "Hara Bhara Kabab") },
    { id: 92, name: "Aalu Tikka", price: 150, category: "starters", image: getImageUrl("starters", "Aalu Tikka") },
    { id: 93, name: "Paneer Malai Tikka", price: 210, category: "starters", image: getImageUrl("starters", "Paneer Malai Tikka") },
    { id: 94, name: "Mushroom Tikka", price: 195, category: "starters", image: getImageUrl("starters", "Mushroom Tikka") },
    { id: 95, name: "Veg. Seekh Kabab", price: 180, category: "starters", image: getImageUrl("starters", "Veg. Seekh Kabab") },
    { id: 96, name: "Cheese Chilly Kabab", price: 220, category: "starters", image: getImageUrl("starters", "Cheese Chilly Kabab") },
    { id: 97, name: "Paneer Chilly Baby Pineapple", price: 195, category: "starters", image: getImageUrl("starters", "Paneer Chilly Baby Pineapple") },
    { id: 98, name: "Green Salad", price: 70, category: "salad", image: getImageUrl("salad", "Green Salad") },
    { id: 99, name: "Katchumber Salad", price: 70, category: "salad", image: getImageUrl("salad", "Katchumber Salad") },
    { id: 100, name: "Green Garden Salad", price: 80, category: "salad", image: getImageUrl("salad", "Green Garden Salad") },
    { id: 101, name: "Finger Salad", price: 80, category: "salad", image: getImageUrl("salad", "Finger Salad") },
    { id: 102, name: "Veg. Salad", price: 80, category: "salad", image: getImageUrl("salad", "Veg. Salad") },
    { id: 103, name: "Boondi Raita", price: 80, category: "salad", image: getImageUrl("salad", "Boondi Raita") },
    { id: 104, name: "Pineapple Raita", price: 80, category: "salad", image: getImageUrl("salad", "Pineapple Raita") },
    { id: 105, name: "Fruit Salad", price: 95, category: "salad", image: getImageUrl("salad", "Fruit Salad") },
    { id: 106, name: "Plain Curd", price: 75, category: "salad", image: getImageUrl("salad", "Plain Curd") },
    { id: 107, name: "Roasted Papad", price: 20, category: "salad", image: getImageUrl("salad", "Roasted Papad") },
    { id: 108, name: "Fried Papad", price: 20, category: "salad", image: getImageUrl("salad", "Fried Papad") },
    { id: 109, name: "Masala Papad", price: 38, category: "salad", image: getImageUrl("salad", "Masala Papad") },
    { id: 110, name: "Gateway Special Veg", price: 230, category: "main_course", image: getImageUrl("main_course", "Gateway Special Veg") },
    { id: 111, name: "Paneer Tikka Masala", price: 200, category: "main_course", image: getImageUrl("main_course", "Paneer Tikka Masala") },
    { id: 112, name: "Paneer Tawa Masala", price: 195, category: "main_course", image: getImageUrl("main_course", "Paneer Tawa Masala") },
    { id: 113, name: "Paneer Butter Masala", price: 180, category: "main_course", image: getImageUrl("main_course", "Paneer Butter Masala") },
    { id: 114, name: "Paneer Naharwala", price: 180, category: "main_course", image: getImageUrl("main_course", "Paneer Naharwala") },
    { id: 115, name: "Paneer Handi", price: 190, category: "main_course", image: getImageUrl("main_course", "Paneer Handi") },
    { id: 116, name: "Paneer Kadai", price: 190, category: "main_course", image: getImageUrl("main_course", "Paneer Kadai") },
    { id: 117, name: "Paneer Zafrani", price: 190, category: "main_course", image: getImageUrl("main_course", "Paneer Zafrani") },
    { id: 118, name: "Paneer Passanda", price: 190, category: "main_course", image: getImageUrl("main_course", "Paneer Passanda") },
    { id: 119, name: "Paneer Tuffani", price: 195, category: "main_course", image: getImageUrl("main_course", "Paneer Tuffani") },
    { id: 120, name: "Paneer Sahi Korma (Sweet)", price: 190, category: "main_course", image: getImageUrl("main_course", "Paneer Sahi Korma (Sweet)") },
    { id: 121, name: "Paneer Dopyaza", price: 190, category: "main_course", image: getImageUrl("main_course", "Paneer Dopyaza") },
    { id: 122, name: "Paneer Multani", price: 190, category: "main_course", image: getImageUrl("main_course", "Paneer Multani") },
    { id: 123, name: "Paneer Kolhapuri", price: 180, category: "main_course", image: getImageUrl("main_course", "Paneer Kolhapuri") },
    { id: 124, name: "Paneer Nawabi", price: 180, category: "main_course", image: getImageUrl("main_course", "Paneer Nawabi") },
    { id: 125, name: "Paneer Chatpata", price: 190, category: "main_course", image: getImageUrl("main_course", "Paneer Chatpata") },
    { id: 126, name: "Veg. Handi", price: 165, category: "main_course", image: getImageUrl("main_course", "Veg. Handi") },
    { id: 127, name: "Veg. Kadai", price: 165, category: "main_course", image: getImageUrl("main_course", "Veg. Kadai") },
    { id: 128, name: "Veg. Tawa Masala", price: 165, category: "main_course", image: getImageUrl("main_course", "Veg. Tawa Masala") },
    { id: 129, name: "Khoya Kaju (Sweet)", price: 195, category: "main_course", image: getImageUrl("main_course", "Khoya Kaju (Sweet)") },
    { id: 130, name: "Kaju Curry", price: 165, category: "main_course", image: getImageUrl("main_course", "Kaju Curry") },
    { id: 131, name: "Kaju Butter Masala", price: 165, category: "main_course", image: getImageUrl("main_course", "Kaju Butter Masala") },
    { id: 132, name: "Stuffed Tomato", price: 165, category: "main_course", image: getImageUrl("main_course", "Stuffed Tomato") },
    { id: 133, name: "Stuffed Capsicum", price: 165, category: "main_course", image: getImageUrl("main_course", "Stuffed Capsicum") },
    { id: 134, name: "Dum Alu Kashmiri (Sweet)", price: 165, category: "main_course", image: getImageUrl("main_course", "Dum Alu Kashmiri (Sweet)") },
    { id: 135, name: "Dum Alu Punjabi (Spicy)", price: 125, category: "main_course", image: getImageUrl("main_course", "Dum Alu Punjabi (Spicy)") },
    { id: 136, name: "Alu Palak", price: 125, category: "main_course", image: getImageUrl("main_course", "Alu Palak") },
    { id: 137, name: "Alu Mutter", price: 125, category: "main_course", image: getImageUrl("main_course", "Alu Mutter") },
    { id: 138, name: "Alu Jeera", price: 125, category: "main_course", image: getImageUrl("main_course", "Alu Jeera") },
    { id: 139, name: "Alu Gobi", price: 125, category: "main_course", image: getImageUrl("main_course", "Alu Gobi") },
    { id: 140, name: "Bhindi Masala", price: 125, category: "main_course", image: getImageUrl("main_course", "Bhindi Masala") },
    { id: 141, name: "Bhindi Fry", price: 125, category: "main_course", image: getImageUrl("main_course", "Bhindi Fry") },
    { id: 142, name: "Chana Masala", price: 125, category: "main_course", image: getImageUrl("main_course", "Chana Masala") },
    { id: 143, name: "Baigan Masala", price: 125, category: "main_course", image: getImageUrl("main_course", "Baigan Masala") },
    { id: 144, name: "Baigan Bhartha", price: 125, category: "main_course", image: getImageUrl("main_course", "Baigan Bhartha") },
    { id: 145, name: "Methi Alu", price: 145, category: "main_course", image: getImageUrl("main_course", "Methi Alu") },
    { id: 146, name: "Methi Malai Mutter (Sweet)", price: 125, category: "main_course", image: getImageUrl("main_course", "Methi Malai Mutter (Sweet)") },
    { id: 147, name: "Methi Mutter Masala", price: 145, category: "main_course", image: getImageUrl("main_course", "Methi Mutter Masala") },
    { id: 148, name: "Mushroom Baby Corn Masala", price: 145, category: "main_course", image: getImageUrl("main_course", "Mushroom Baby Corn Masala") },
    { id: 149, name: "Mushroom Masala", price: 145, category: "main_course", image: getImageUrl("main_course", "Mushroom Masala") },
    { id: 150, name: "Green Peas Masala", price: 145, category: "main_course", image: getImageUrl("main_course", "Green Peas Masala") },
    { id: 151, name: "Navratan Korma (Sweet)", price: 145, category: "main_course", image: getImageUrl("main_course", "Navratan Korma (Sweet)") },
    { id: 152, name: "Malai Kofi (Sweet)", price: 150, category: "main_course", image: getImageUrl("main_course", "Malai Kofi (Sweet)") },
    { id: 153, name: "Kashmiri Kofta (Sweet)", price: 150, category: "main_course", image: getImageUrl("main_course", "Kashmiri Kofta (Sweet)") },
    { id: 154, name: "Nargis Kofta", price: 150, category: "main_course", image: getImageUrl("main_course", "Nargis Kofta") },
    { id: 155, name: "Veg. Kofta", price: 150, category: "main_course", image: getImageUrl("main_course", "Veg. Kofta") },
    { id: 156, name: "Cheese Kofta", price: 165, category: "main_course", image: getImageUrl("main_course", "Cheese Kofta") },
    { id: 157, name: "Kadai Kofta", price: 150, category: "main_course", image: getImageUrl("main_course", "Kadai Kofta") },
    { id: 158, name: "Paneer Kofta", price: 165, category: "main_course", image: getImageUrl("main_course", "Paneer Kofta") },
    { id: 159, name: "Dal Makhni", price: 180, category: "main_course", image: getImageUrl("main_course", "Dal Makhni") },
    { id: 160, name: "Dal Fry Tadka", price: 150, category: "main_course", image: getImageUrl("main_course", "Dal Fry Tadka") },
    { id: 161, name: "Dal Palak", price: 125, category: "main_course", image: getImageUrl("main_course", "Dal Palak") },
    { id: 162, name: "Dal Fry Butter", price: 125, category: "main_course", image: getImageUrl("main_course", "Dal Fry Butter") },
    { id: 163, name: "Dal Fry", price: 110, category: "main_course", image: getImageUrl("main_course", "Dal Fry") },
    { id: 164, name: "Steam Rice", price: 75, category: "rice", image: getImageUrl("rice", "Steam Rice") },
    { id: 165, name: "Jeera Rice", price: 95, category: "rice", image: getImageUrl("rice", "Jeera Rice") },
    { id: 166, name: "Masala Rice", price: 105, category: "rice", image: getImageUrl("rice", "Masala Rice") },
    { id: 167, name: "Curd Rice", price: 115, category: "rice", image: getImageUrl("rice", "Curd Rice") },
    { id: 168, name: "Palak Khichdi (With Papad)", price: 115, category: "rice", image: getImageUrl("rice", "Palak Khichdi (With Papad)") },
    { id: 169, name: "Dal Khichdi (With Papad)", price: 115, category: "rice", image: getImageUrl("rice", "Dal Khichdi (With Papad)") },
    { id: 170, name: "Veg. Dal Khichdi (With Papad)", price: 130, category: "rice", image: getImageUrl("rice", "Veg. Dal Khichdi (With Papad)") },
    { id: 171, name: "Veg. Pulav / Green Peas Pulav", price: 130, category: "rice", image: getImageUrl("rice", "Veg. Pulav / Green Peas Pulav") },
    { id: 172, name: "Kashmiri Pulav (Sweet)", price: 135, category: "rice", image: getImageUrl("rice", "Kashmiri Pulav (Sweet)") },
    { id: 173, name: "Cheese Pulav", price: 155, category: "rice", image: getImageUrl("rice", "Cheese Pulav") },
    { id: 174, name: "Paneer Pulav", price: 155, category: "rice", image: getImageUrl("rice", "Paneer Pulav") },
    { id: 175, name: "Veg. Biryani", price: 130, category: "rice", image: getImageUrl("rice", "Veg. Biryani") },
    { id: 176, name: "Cheese Biryani", price: 155, category: "rice", image: getImageUrl("rice", "Cheese Biryani") },
    { id: 177, name: "Paneer Biryani", price: 155, category: "rice", image: getImageUrl("rice", "Paneer Biryani") },
    { id: 178, name: "Handi Biryani", price: 140, category: "rice", image: getImageUrl("rice", "Handi Biryani") },
    { id: 179, name: "Hyderabad Biryani (Green & Spicy)", price: 145, category: "rice", image: getImageUrl("rice", "Hyderabad Biryani (Green & Spicy)") },
    { id: 180, name: "Paneer Spring Roll", price: 195, category: "chinese_starters", image: getImageUrl("chinese_starters", "Paneer Spring Roll") },
    { id: 181, name: "Veg. Spring Roll", price: 205, category: "chinese_starters", image: getImageUrl("chinese_starters", "Veg. Spring Roll") },
    { id: 182, name: "Pasta Roll", price: 150, category: "chinese_starters", image: getImageUrl("chinese_starters", "Pasta Roll") },
    { id: 183, name: "Veg. Crispy", price: 165, category: "chinese_starters", image: getImageUrl("chinese_starters", "Veg. Crispy") },
    { id: 184, name: "Potato Dragon", price: 160, category: "chinese_starters", image: getImageUrl("chinese_starters", "Potato Dragon") },
    { id: 185, name: "Paneer Crispy", price: 155, category: "chinese_starters", image: getImageUrl("chinese_starters", "Paneer Crispy") },
    { id: 186, name: "Paneer Dragon", price: 215, category: "chinese_starters", image: getImageUrl("chinese_starters", "Paneer Dragon") },
    { id: 187, name: "Veg. Manchurian", price: 215, category: "chinese_starters", image: getImageUrl("chinese_starters", "Veg. Manchurian") },
    { id: 188, name: "Veg. Chilly", price: 140, category: "chinese_starters", image: getImageUrl("chinese_starters", "Veg. Chilly") },
    { id: 189, name: "Paneer Manchurian", price: 180, category: "chinese_starters", image: getImageUrl("chinese_starters", "Paneer Manchurian") },
    { id: 190, name: "Veg. 65", price: 180, category: "chinese_starters", image: getImageUrl("chinese_starters", "Veg. 65") },
    { id: 191, name: "Paneer Chilly", price: 165, category: "chinese_starters", image: getImageUrl("chinese_starters", "Paneer Chilly") },
    { id: 192, name: "Paneer Garlic", price: 185, category: "chinese_starters", image: getImageUrl("chinese_starters", "Paneer Garlic") },
    { id: 193, name: "Paneer 65", price: 185, category: "chinese_starters", image: getImageUrl("chinese_starters", "Paneer 65") },
    { id: 194, name: "Paneer Gold Coin", price: 155, category: "chinese_starters", image: getImageUrl("chinese_starters", "Paneer Gold Coin") },
    { id: 195, name: "Baby Corn Manchurian", price: 165, category: "chinese_starters", image: getImageUrl("chinese_starters", "Baby Corn Manchurian") },
    { id: 196, name: "Paneer Schezwan Dry", price: 185, category: "chinese_starters", image: getImageUrl("chinese_starters", "Paneer Schezwan Dry") },
    { id: 197, name: "Idli Chilly Dry", price: 160, category: "chinese_starters", image: getImageUrl("chinese_starters", "Idli Chilly Dry") },
    { id: 198, name: "Mushroom Chilly Dry", price: 160, category: "chinese_starters", image: getImageUrl("chinese_starters", "Mushroom Chilly Dry") },
    { id: 199, name: "Gobi Manchurian Dry", price: 150, category: "chinese_starters", image: getImageUrl("chinese_starters", "Gobi Manchurian Dry") },
    { id: 200, name: "Tomato Soup", price: 115, category: "soup", image: getImageUrl("soup", "Tomato Soup") },
    { id: 201, name: "Veg. Noodles Soup", price: 115, category: "soup", image: getImageUrl("soup", "Veg. Noodles Soup") },
    { id: 202, name: "Veg. Sweet Corn Soup", price: 115, category: "soup", image: getImageUrl("soup", "Veg. Sweet Corn Soup") },
    { id: 203, name: "Veg. Clear Soup", price: 105, category: "soup", image: getImageUrl("soup", "Veg. Clear Soup") },
    { id: 204, name: "Veg. Mushroom Clear Soup", price: 125, category: "soup", image: getImageUrl("soup", "Veg. Mushroom Clear Soup") },
    { id: 205, name: "Cream of Veg. Soup", price: 115, category: "soup", image: getImageUrl("soup", "Cream of Veg. Soup") },
    { id: 206, name: "Veg. Hot & Sour Soup", price: 110, category: "soup", image: getImageUrl("soup", "Veg. Hot & Sour Soup") },
    { id: 207, name: "Veg. Manchow Soup", price: 115, category: "soup", image: getImageUrl("soup", "Veg. Manchow Soup") },
    { id: 208, name: "Babycorn Soup", price: 120, category: "soup", image: getImageUrl("soup", "Babycorn Soup") },
    { id: 209, name: "Paneer Chilly", price: 185, category: "chinese_main_course", image: getImageUrl("chinese_main_course", "Paneer Chilly") },
    { id: 210, name: "Paneer Hot Garlic", price: 185, category: "chinese_main_course", image: getImageUrl("chinese_main_course", "Paneer Hot Garlic") },
    { id: 211, name: "Paneer Manchurian", price: 185, category: "chinese_main_course", image: getImageUrl("chinese_main_course", "Paneer Manchurian") },
    { id: 212, name: "Paneer Hongkong", price: 185, category: "chinese_main_course", image: getImageUrl("chinese_main_course", "Paneer Hongkong") },
    { id: 213, name: "Paneer Schezwan", price: 185, category: "chinese_main_course", image: getImageUrl("chinese_main_course", "Paneer Schezwan") },
    { id: 214, name: "Paneer 65", price: 185, category: "chinese_main_course", image: getImageUrl("chinese_main_course", "Paneer 65") },
    { id: 215, name: "Veg. Chilly", price: 140, category: "chinese_main_course", image: getImageUrl("chinese_main_course", "Veg. Chilly") },
    { id: 216, name: "Veg. Manchurian", price: 140, category: "chinese_main_course", image: getImageUrl("chinese_main_course", "Veg. Manchurian") },
    { id: 217, name: "Veg. Hot Garlic", price: 150, category: "chinese_main_course", image: getImageUrl("chinese_main_course", "Veg. Hot Garlic") },
    { id: 218, name: "Veg. Hong Kong", price: 150, category: "chinese_main_course", image: getImageUrl("chinese_main_course", "Veg. Hong Kong") },
    { id: 219, name: "Veg. Schezwan", price: 160, category: "chinese_main_course", image: getImageUrl("chinese_main_course", "Veg. Schezwan") },
    { id: 220, name: "Veg. 65", price: 160, category: "chinese_main_course", image: getImageUrl("chinese_main_course", "Veg. 65") },
    { id: 221, name: "Chinese Choupsey", price: 155, category: "chinese_main_course", image: getImageUrl("chinese_main_course", "Chinese Choupsey") },
    { id: 222, name: "Mushroom Manchurian", price: 165, category: "chinese_main_course", image: getImageUrl("chinese_main_course", "Mushroom Manchurian") },
    { id: 223, name: "Mushroom Schezwan", price: 165, category: "chinese_main_course", image: getImageUrl("chinese_main_course", "Mushroom Schezwan") },
    { id: 224, name: "American Choupsey (Sweet)", price: 180, category: "chinese_main_course", image: getImageUrl("chinese_main_course", "American Choupsey (Sweet)") },
    { id: 225, name: "Veg. Fried Rice", price: 135, category: "chinese_noodles_rice", image: getImageUrl("chinese_noodles_rice", "Veg. Fried Rice") },
    { id: 226, name: "Chinese Bhel", price: 140, category: "chinese_noodles_rice", image: getImageUrl("chinese_noodles_rice", "Chinese Bhel") },
    { id: 227, name: "Veg. Schezwan Fried Rice", price: 150, category: "chinese_noodles_rice", image: getImageUrl("chinese_noodles_rice", "Veg. Schezwan Fried Rice") },
    { id: 228, name: "Veg. Ginger Garlic Rice", price: 150, category: "chinese_noodles_rice", image: getImageUrl("chinese_noodles_rice", "Veg. Ginger Garlic Rice") },
    { id: 229, name: "Mushroom Fried Rice", price: 160, category: "chinese_noodles_rice", image: getImageUrl("chinese_noodles_rice", "Mushroom Fried Rice") },
    { id: 230, name: "Mushroom Schezwan Fried Rice", price: 160, category: "chinese_noodles_rice", image: getImageUrl("chinese_noodles_rice", "Mushroom Schezwan Fried Rice") },
    { id: 231, name: "Veg. Triple Rice", price: 170, category: "chinese_noodles_rice", image: getImageUrl("chinese_noodles_rice", "Veg. Triple Rice") },
    { id: 232, name: "Veg. Triple Schezwan Rice", price: 175, category: "chinese_noodles_rice", image: getImageUrl("chinese_noodles_rice", "Veg. Triple Schezwan Rice") },
    { id: 233, name: "Singapore Fried Rice", price: 155, category: "chinese_noodles_rice", image: getImageUrl("chinese_noodles_rice", "Singapore Fried Rice") },
    { id: 234, name: "Combination Rice", price: 160, category: "chinese_noodles_rice", image: getImageUrl("chinese_noodles_rice", "Combination Rice") },
    { id: 235, name: "Combination Schezwan Fried Rice", price: 160, category: "chinese_noodles_rice", image: getImageUrl("chinese_noodles_rice", "Combination Schezwan Fried Rice") },
    { id: 236, name: "Paneer Fried Rice", price: 180, category: "chinese_noodles_rice", image: getImageUrl("chinese_noodles_rice", "Paneer Fried Rice") },
    { id: 237, name: "Noodles Fried Rice", price: 155, category: "chinese_noodles_rice", image: getImageUrl("chinese_noodles_rice", "Noodles Fried Rice") },
    { id: 238, name: "Manchurian Fried Rice", price: 155, category: "chinese_noodles_rice", image: getImageUrl("chinese_noodles_rice", "Manchurian Fried Rice") },
    { id: 239, name: "Corn Capsicum Fried Rice", price: 160, category: "chinese_noodles_rice", image: getImageUrl("chinese_noodles_rice", "Corn Capsicum Fried Rice") },
    { id: 240, name: "Veg. Hakka Noodles", price: 150, category: "chinese_noodles_rice", image: getImageUrl("chinese_noodles_rice", "Veg. Hakka Noodles") },
    { id: 241, name: "Crispy Noodles", price: 150, category: "chinese_noodles_rice", image: getImageUrl("chinese_noodles_rice", "Crispy Noodles") },
    { id: 242, name: "Veg. Schezwan Noodles", price: 170, category: "chinese_noodles_rice", image: getImageUrl("chinese_noodles_rice", "Veg. Schezwan Noodles") },
    { id: 243, name: "Hongkong Noodles", price: 170, category: "chinese_noodles_rice", image: getImageUrl("chinese_noodles_rice", "Hongkong Noodles") },
    { id: 244, name: "Veg. Triple Schezwan Noodles", price: 195, category: "chinese_noodles_rice", image: getImageUrl("chinese_noodles_rice", "Veg. Triple Schezwan Noodles") },
    { id: 245, name: "Baked Macorni", price: 190, category: "baked_dishes", image: getImageUrl("baked_dishes", "Baked Macorni") },
    { id: 246, name: "Baked Veg.", price: 190, category: "baked_dishes", image: getImageUrl("baked_dishes", "Baked Veg.") },
    { id: 247, name: "Baked Veg. With Pineapple", price: 200, category: "baked_dishes", image: getImageUrl("baked_dishes", "Baked Veg. With Pineapple") },
    { id: 248, name: "Baked Macorni With Pineapple", price: 200, category: "baked_dishes", image: getImageUrl("baked_dishes", "Baked Macorni With Pineapple") },
    { id: 249, name: "Baked Cheese Mushroom", price: 200, category: "baked_dishes", image: getImageUrl("baked_dishes", "Baked Cheese Mushroom") },
    { id: 250, name: "Gulab Jamun", price: 70, category: "dessert", image: getImageUrl("dessert", "Gulab Jamun") },
    { id: 251, name: "Fruit Salad", price: 120, category: "dessert", image: getImageUrl("dessert", "Fruit Salad") },
    { id: 252, name: "Fresh Fruit Plate", price: 145, category: "dessert", image: getImageUrl("dessert", "Fresh Fruit Plate") },
    { id: 253, name: "Fruit Salad With Ice Cream", price: 140, category: "dessert", image: getImageUrl("dessert", "Fruit Salad With Ice Cream") },
    { id: 254, name: "Jelly", price: 95, category: "dessert", image: getImageUrl("dessert", "Jelly") },
    { id: 255, name: "Fruit Jelly", price: 105, category: "dessert", image: getImageUrl("dessert", "Fruit Jelly") },
    { id: 256, name: "Jelly With Ice Cream", price: 125, category: "dessert", image: getImageUrl("dessert", "Jelly With Ice Cream") },
    { id: 257, name: "Vanilla With Hot Chocolate", price: 125, category: "dessert", image: getImageUrl("dessert", "Vanilla With Hot Chocolate") },
    { id: 258, name: "Gateway Special Lassi", price: 115, category: "lassi", image: getImageUrl("lassi", "Gateway Special Lassi") },
    { id: 259, name: "Sweet Lassi", price: 65, category: "lassi", image: getImageUrl("lassi", "Sweet Lassi") },
    { id: 260, name: "Salt Lassi", price: 65, category: "lassi", image: getImageUrl("lassi", "Salt Lassi") },
    { id: 261, name: "Mango Lassi", price: 95, category: "lassi", image: getImageUrl("lassi", "Mango Lassi") },
    { id: 262, name: "Butter Milk", price: 45, category: "lassi", image: getImageUrl("lassi", "Butter Milk") },
    { id: 263, name: "Fresh Lime Juice", price: 60, category: "fresh_juices", image: getImageUrl("fresh_juices", "Fresh Lime Juice") },
    { id: 264, name: "Ginger Lemon Juice", price: 70, category: "fresh_juices", image: getImageUrl("fresh_juices", "Ginger Lemon Juice") },
    { id: 265, name: "Mosambi Juice", price: 85, category: "fresh_juices", image: getImageUrl("fresh_juices", "Mosambi Juice") },
    { id: 266, name: "Orange Juice", price: 85, category: "fresh_juices", image: getImageUrl("fresh_juices", "Orange Juice") },
    { id: 267, name: "Water Melon Juice", price: 85, category: "fresh_juices", image: getImageUrl("fresh_juices", "Water Melon Juice") },
    { id: 268, name: "Pineapple Juice", price: 85, category: "fresh_juices", image: getImageUrl("fresh_juices", "Pineapple Juice") },
    { id: 269, name: "Ganga Jamuna", price: 90, category: "fresh_juices", image: getImageUrl("fresh_juices", "Ganga Jamuna") },
    { id: 270, name: "Mastani", price: 90, category: "fresh_juices", image: getImageUrl("fresh_juices", "Mastani") },
    { id: 271, name: "Crocodile Juice", price: 90, category: "fresh_juices", image: getImageUrl("fresh_juices", "Crocodile Juice") },
    { id: 272, name: "Grape Juice", price: 100, category: "fresh_juices", image: getImageUrl("fresh_juices", "Grape Juice") },
    { id: 273, name: "Apple Juice", price: 100, category: "fresh_juices", image: getImageUrl("fresh_juices", "Apple Juice") },
    { id: 274, name: "Pomegranate Juice", price: 100, category: "fresh_juices", image: getImageUrl("fresh_juices", "Pomegranate Juice") },
    { id: 275, name: "Mango Juice (Pulp)", price: 140, category: "fresh_juices", image: getImageUrl("fresh_juices", "Mango Juice (Pulp)") },
    { id: 276, name: "Carrot Juice", price: 85, category: "fresh_juices", image: getImageUrl("fresh_juices", "Carrot Juice") },
    { id: 277, name: "Chikoo Milkshake", price: 105, category: "milkshake", image: getImageUrl("milkshake", "Chikoo Milkshake") },
    { id: 278, name: "Banana Milkshake", price: 105, category: "milkshake", image: getImageUrl("milkshake", "Banana Milkshake") },
    { id: 279, name: "Apple Milkshake", price: 130, category: "milkshake", image: getImageUrl("milkshake", "Apple Milkshake") },
    { id: 280, name: "Sitafal Milkshake", price: 145, category: "milkshake", image: getImageUrl("milkshake", "Sitafal Milkshake") },
    { id: 281, name: "Fresh Strawberry Milkshake", price: 145, category: "milkshake", image: getImageUrl("milkshake", "Fresh Strawberry Milkshake") },
    { id: 282, name: "Mango Milkshake (Pulp)", price: 140, category: "milkshake", image: getImageUrl("milkshake", "Mango Milkshake (Pulp)") },
    { id: 283, name: "Vanilla Milkshake", price: 105, category: "milkshake", image: getImageUrl("milkshake", "Vanilla Milkshake") },
    { id: 284, name: "Cold Coffee", price: 105, category: "milkshake", image: getImageUrl("milkshake", "Cold Coffee") },
    { id: 285, name: "Dry Fruit Milkshake", price: 195, category: "milkshake", image: getImageUrl("milkshake", "Dry Fruit Milkshake") },
    { id: 286, name: "Badam Milkshake", price: 195, category: "milkshake", image: getImageUrl("milkshake", "Badam Milkshake") },
    { id: 287, name: "Kaju Milkshake", price: 195, category: "milkshake", image: getImageUrl("milkshake", "Kaju Milkshake") },
    { id: 288, name: "Anjeer Milkshake", price: 195, category: "milkshake", image: getImageUrl("milkshake", "Anjeer Milkshake") },
    { id: 289, name: "Kaju Anjeer Milkshake", price: 195, category: "milkshake", image: getImageUrl("milkshake", "Kaju Anjeer Milkshake") },
    { id: 290, name: "Gateway Special Falooda", price: 170, category: "falooda", image: getImageUrl("falooda", "Gateway Special Falooda") },
    { id: 291, name: "Royal Falooda", price: 120, category: "falooda", image: getImageUrl("falooda", "Royal Falooda") },
    { id: 292, name: "Kesar Falooda", price: 130, category: "falooda", image: getImageUrl("falooda", "Kesar Falooda") },
    { id: 293, name: "Kulfi Falooda", price: 135, category: "falooda", image: getImageUrl("falooda", "Kulfi Falooda") },
    { id: 294, name: "Malai Kulfi", price: 55, category: "kulfi", image: getImageUrl("kulfi", "Malai Kulfi") },
    { id: 295, name: "Kesar Pista Kulfi", price: 65, category: "kulfi", image: getImageUrl("kulfi", "Kesar Pista Kulfi") },
    { id: 296, name: "Pista Kulfi", price: 65, category: "kulfi", image: getImageUrl("kulfi", "Pista Kulfi") },
    { id: 297, name: "3 In 1 Kulfi", price: 75, category: "kulfi", image: getImageUrl("kulfi", "3 In 1 Kulfi") },
    { id: 298, name: "Matka Kulfi", price: 75, category: "kulfi", image: getImageUrl("kulfi", "Matka Kulfi") },
    { id: 299, name: "Vanilla Scoop", price: 105, category: "scoops", image: getImageUrl("scoops", "Vanilla Scoop") },
    { id: 300, name: "Kesar Pista Scoop", price: 130, category: "scoops", image: getImageUrl("scoops", "Kesar Pista Scoop") },
    { id: 301, name: "Butter Scotch Scoop", price: 115, category: "scoops", image: getImageUrl("scoops", "Butter Scotch Scoop") },
    { id: 302, name: "Chocolate Scoop", price: 115, category: "scoops", image: getImageUrl("scoops", "Chocolate Scoop") },
    { id: 303, name: "Strawberry Scoop", price: 110, category: "scoops", image: getImageUrl("scoops", "Strawberry Scoop") },
  ];

  const dishes = rawDishes.map(normalizeDish);

  const categories = [
    { id: "all", label: "All Items" },
    { id: "south_indian", label: "South Indian" },
    { id: "extras", label: "Extras" },
    { id: "snacks", label: "Snacks" },
    { id: "pav_bhaji", label: "Pav Bhaji" },
    { id: "sandwich", label: "Sandwich" },
    { id: "pizza_burger", label: "Pizza & Burger" },
    { id: "chaat", label: "Chaat" },
    { id: "starters", label: "Starters" },
    { id: "salad", label: "Salads" },
    { id: "main_course", label: "Main Course" },
    { id: "rice", label: "Rice" },
    { id: "chinese_starters", label: "Chinese Starters" },
    { id: "soup", label: "Soup" },
    { id: "chinese_main_course", label: "Chinese Main Course" },
    { id: "chinese_noodles_rice", label: "Chinese Noodles & Rice" },
    { id: "baked_dishes", label: "Baked Dishes" },
    { id: "dessert", label: "Desserts" },
    { id: "lassi", label: "Lassi" },
    { id: "fresh_juices", label: "Fresh Juices" },
    { id: "milkshake", label: "Milkshakes" },
    { id: "falooda", label: "Falooda" },
    { id: "kulfi", label: "Kulfi" },
    { id: "scoops", label: "Scoops" },
  ];

  const matchesPriceRange = (price) => {
    switch (selectedPriceRange) {
      case "under_100":
        return price <= 100;
      case "under_200":
        return price <= 200;
      case "under_300":
        return price <= 300;
      case "under_500":
        return price <= 500;
      case "under_600":
        return price <= 600;
      case "all":
      default:
        return true;
    }
  };

  const fuse = new Fuse(dishes, {
    keys: ['name', 'categoryLabel', 'ingredients'],
    threshold: 0.35,
    ignoreLocation: true,
    includeScore: true,
    minMatchCharLength: 2,
    isCaseSensitive: false,
  });

  const filteredBySearch = searchText.trim()
    ? fuse.search(searchText.trim()).map((result) => result.item)
    : dishes;

  const filteredItems = filteredBySearch.filter((item) => {
    const matchesPrice = matchesPriceRange(item.price);
    const matchesCategory = selectedCategory === "all" || item.category === selectedCategory;

    return matchesPrice && matchesCategory;
  });

  return (
    <div className="app">
      <SiteNavbar />
      <HeroSection onExploreMenu={scrollToSearch} />
      <main id="menu-section" className="menu-container">
        <SearchAndFilter
          searchText={searchText}
          setSearchText={setSearchText}
          selectedPriceRange={selectedPriceRange}
          setSelectedPriceRange={setSelectedPriceRange}
          priceRangeOptions={priceRangeOptions}
        />
        <CategoryFilter
          categories={categories}
          selectedCategory={selectedCategory}
          setSelectedCategory={setSelectedCategory}
        />
        <ResultCount count={filteredItems.length} />
        <MenuGrid items={filteredItems} />
      </main>
    </div>
  );
}

function HeroSection({ onExploreMenu }) {
  return (
    <section className="hero-section">
      <video className="hero-video-bg" autoPlay loop muted playsInline>
        <source src="/hero-food.mp4" type="video/mp4" />
      </video>

      <div className="hero-dark-overlay">
        <img
          src="/dilyum-logo.png"
          alt="DilYum - Dil Bole Yum"
          className="hero-center-logo"
          onError={(e) => {
            e.currentTarget.style.display = 'none';
          }}
        />

        <p className="hero-subtitle">
          Authentic Indian Flavors • Live Kitchen • Scan & Order Smart
        </p>

        <button type="button" className="hero-explore-btn" onClick={onExploreMenu}>
          Explore Food Menu & Restaurants →
        </button>

        <div className="hero-feature-row" aria-label="App highlights">
          <div className="feature-pill">
            <strong>300+</strong>
            <span>menu items</span>
          </div>
          <div className="feature-pill">
            <strong>Fuzzy</strong>
            <span>search enabled</span>
          </div>
          <div className="feature-pill">
            <strong>Mobile</strong>
            <span>friendly layout</span>
          </div>
        </div>
      </div>
    </section>
  );
}

function SearchAndFilter({ searchText, setSearchText, selectedPriceRange, setSelectedPriceRange, priceRangeOptions }) {
  return (
    <div className="search-filter-card">
      <div className="search-input-wrapper">
        <span className="search-icon" aria-hidden="true">🔍</span>
        <input
          type="text"
          className="main-search-input"
          placeholder="Search dishes, categories, or ingredients (e.g. paneer, butter)..."
          value={searchText}
          onChange={(e) => setSearchText(e.target.value)}
        />
        {searchText ? (
          <button type="button" className="clear-btn" onClick={() => setSearchText('')} aria-label="Clear search">
            ✕
          </button>
        ) : null}
      </div>

      <div className="filter-dropdown-wrapper">
        <select
          className="price-select"
          value={selectedPriceRange}
          onChange={(e) => setSelectedPriceRange(e.target.value)}
          aria-label="Price range"
        >
          {priceRangeOptions.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </div>
    </div>
  );
}

function CategoryFilter({ categories, selectedCategory, setSelectedCategory }) {
  return (
    <div className="category-scroll-strip">
      {categories.map((cat) => (
        <button
          key={cat.id}
          type="button"
          className={`cat-pill ${selectedCategory === cat.id ? 'active' : ''}`}
          onClick={() => setSelectedCategory(cat.id)}
        >
          {cat.label}
        </button>
      ))}
    </div>
  );
}

function ResultCount({ count }) {
  return (
    <div className="results-info">
      <span>
        Showing <strong>{count}</strong> delicious item{count === 1 ? '' : 's'}
      </span>
    </div>
  );
}

function MenuGrid({ items }) {
  if (items.length === 0) {
    return (
      <div className="empty-state">
        <p className="empty-icon">🔍</p>
        <p className="empty-text">No dishes found matching your criteria.</p>
        <p className="empty-subtext">Try adjusting your search or filters!</p>
      </div>
    );
  }

  return (
    <div className="dish-grid">
      {items.map((item) => (
        <DishCard key={item.id} item={item} />
      ))}
    </div>
  );
}

function DishCard({ item }) {
  const [isOpen, setIsOpen] = React.useState(false);
  const ingredients = item.ingredients ?? [];
  const fallbackImage = "https://images.unsplash.com/photo-1585937421612-70a008356fbe?auto=format&fit=crop&w=500&q=80";

  React.useEffect(() => {
    if (!isOpen) return;
    const onKeyDown = (e) => {
      if (e.key === 'Escape') setIsOpen(false);
    };
    document.addEventListener('keydown', onKeyDown);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKeyDown);
      document.body.style.overflow = prevOverflow;
    };
  }, [isOpen]);

  return (
    <>
      <div className="dish-card" onClick={() => setIsOpen(true)}>
        <div className="dish-img-wrapper">
          <img
            src={item.image || fallbackImage}
            alt={item.name}
            loading="lazy"
            onError={(e) => {
              e.target.src = fallbackImage;
            }}
          />
        </div>

        <div className="dish-content">
          <div className="dish-header">
            <h3 className="dish-title">{item.name}</h3>
            <span className="dish-price">₹{item.price}</span>
          </div>

          <div className="dish-tags">
            {ingredients.slice(0, 3).map((ing, idx) => (
              <span key={idx} className="tag-badge">{ing}</span>
            ))}
            {ingredients.length > 3 && (
              <span className="tag-badge">+{ingredients.length - 3} more</span>
            )}
          </div>
        </div>
      </div>

      {isOpen && (
        <div
          className="dish-modal-overlay"
          onClick={() => setIsOpen(false)}
          role="presentation"
        >
          <div
            className="dish-modal"
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
            aria-label={item.name}
          >
            <button
              type="button"
              className="dish-modal-close"
              onClick={() => setIsOpen(false)}
              aria-label="Close"
            >
              ×
            </button>

            <img
              src={item.image || fallbackImage}
              alt={item.name}
              className="dish-modal-img"
              onError={(e) => {
                e.target.src = fallbackImage;
              }}
            />

            <div className="dish-modal-body">
              <div className="dish-modal-header">
                <h3 className="dish-modal-name">{item.name}</h3>
                <div className="card-price">₹{item.price}</div>
              </div>

              <p className="ingredients-label">Ingredients:</p>
              <div className="ingredients-list">
                {ingredients.length > 0 ? (
                  ingredients.map((ing, idx) => (
                    <span key={idx} className="ingredient-full">{ing}</span>
                  ))
                ) : (
                  <span className="ingredient-full">No ingredients listed</span>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

export default App;